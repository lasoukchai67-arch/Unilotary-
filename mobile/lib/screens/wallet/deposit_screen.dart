import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../config.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../state/app_data.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../widgets/common.dart';
import '../../widgets/money_text.dart';

/// Deposit: amount → payment QR → poll every 3 s until it is settled.
class DepositScreen extends StatefulWidget {
  const DepositScreen({super.key, this.pollInterval = const Duration(seconds: 3)});

  final Duration pollInterval;

  @override
  State<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends State<DepositScreen> {
  static const _presets = [50000, 100000, 200000, 500000];

  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  Deposit? _deposit;
  bool _busy = false;
  Timer? _poll;

  @override
  void dispose() {
    _poll?.cancel();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (!(_formKey.currentState?.validate() ?? false) || _busy) return;
    final amount = parseAmount(_amount.text)!;
    setState(() => _busy = true);
    try {
      final deposit = await context.read<LotteryApi>().createDeposit(amount);
      if (!mounted) return;
      setState(() => _deposit = deposit);
      _startPolling();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _startPolling() {
    _poll?.cancel();
    if (_deposit?.isPending != true) return;
    _poll = Timer.periodic(widget.pollInterval, (_) => _check());
  }

  Future<void> _check() async {
    final current = _deposit;
    if (current == null || !current.isPending) {
      _poll?.cancel();
      return;
    }
    try {
      final updated = await context.read<LotteryApi>().deposit(current.id);
      if (!mounted) return;
      _apply(updated);
    } on ApiException {
      // Transient errors: keep polling.
    }
  }

  void _apply(Deposit updated) {
    setState(() => _deposit = updated);
    if (!updated.isPending) {
      _poll?.cancel();
      if (updated.status == DepositStatus.success) {
        context.read<WalletState>().refresh();
      }
    }
  }

  Future<void> _simulate(bool success) async {
    final current = _deposit;
    if (current == null) return;
    try {
      final updated = await context
          .read<LotteryApi>()
          .simulateDeposit(current.id, success: success);
      if (mounted) _apply(updated);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    }
  }

  void _restart() {
    _poll?.cancel();
    setState(() => _deposit = null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(S.depositTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_deposit == null) _form() else _payment(_deposit!),
          ],
        ),
      ),
    );
  }

  Widget _form() {
    return Form(
      key: _formKey,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                key: const ValueKey('deposit-amount'),
                controller: _amount,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: const TextStyle(fontSize: 22, fontFeatures: tabular),
                decoration: const InputDecoration(
                  labelText: S.amount,
                  suffixText: S.kip,
                ),
                validator: (v) =>
                    parseAmount(v ?? '') == null ? S.amountInvalid : null,
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final p in _presets)
                    ActionChip(
                      label: Text(formatAmountShort(p)),
                      onPressed: () => setState(() => _amount.text = '$p'),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _busy ? null : _create,
                icon: _busy
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 3),
                      )
                    : const Icon(Icons.qr_code_2_rounded),
                label: const Text(S.depositCreate),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _payment(Deposit d) {
    final (statusText, statusColor, statusIcon) = switch (d.status) {
      DepositStatus.pending =>
        (S.depositWaiting, Brand.midGreen, Icons.hourglass_top_rounded),
      DepositStatus.success =>
        (S.depositSuccess, Brand.deepGreen, Icons.check_circle_rounded),
      DepositStatus.failed => (S.depositFailed, Brand.red, Icons.error_rounded),
      DepositStatus.expired =>
        (S.depositExpired, Brand.grey, Icons.timer_off_rounded),
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            MoneyText(
              d.amount,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: Brand.deepGreen,
              ),
            ),
            const SizedBox(height: 12),
            if (d.isPending && d.qrPayload.isNotEmpty) ...[
              Center(
                child: QrImageView(
                  data: d.qrPayload,
                  size: 240,
                  backgroundColor: Brand.white,
                  semanticsLabel: S.depositScan,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                S.depositScan,
                textAlign: TextAlign.center,
                style: TextStyle(color: Brand.grey),
              ),
              if (d.expiresAt != null)
                Text(
                  '${S.depositExpiresAt}: ${formatDateTime(d.expiresAt!)}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Brand.grey, fontSize: 13),
                ),
            ],
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (d.isPending)
                  const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                else
                  Icon(statusIcon, color: statusColor),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    statusText,
                    key: const ValueKey('deposit-status'),
                    style: TextStyle(
                      color: statusColor,
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                ),
              ],
            ),
            if (d.isPending && AppConfig.devTools) ...[
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => _simulate(true),
                icon: const Icon(Icons.bug_report_outlined),
                label: const Text(S.simulateSuccess),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => _simulate(false),
                icon: const Icon(Icons.bug_report_outlined),
                label: const Text(S.simulateFailed),
              ),
            ],
            if (!d.isPending) ...[
              const SizedBox(height: 16),
              if (d.status == DepositStatus.success)
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text(S.ok),
                )
              else
                FilledButton(
                  onPressed: _restart,
                  child: const Text(S.depositAgain),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
