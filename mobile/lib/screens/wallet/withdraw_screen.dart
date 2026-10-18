import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../state/app_data.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../widgets/common.dart';
import '../../widgets/pin_dialog.dart';

/// Bank options. "Other" lets the user type the bank name.
const banks = ['BCEL', 'LDB', 'JDB', 'APB', _other];
const _other = 'Other';

class WithdrawScreen extends StatefulWidget {
  const WithdrawScreen({super.key});

  @override
  State<WithdrawScreen> createState() => _WithdrawScreenState();
}

class _WithdrawScreenState extends State<WithdrawScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otherBank = TextEditingController();
  final _accountNo = TextEditingController();
  final _accountName = TextEditingController();
  final _amount = TextEditingController();
  String _bank = banks.first;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<WalletState>().refresh();
    });
  }

  @override
  void dispose() {
    _otherBank.dispose();
    _accountNo.dispose();
    _accountName.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false) || _busy) return;
    final pin = await showPinDialog(context);
    if (pin == null || !mounted) return;

    setState(() => _busy = true);
    try {
      await context.read<LotteryApi>().withdraw(
            amount: parseAmount(_amount.text)!,
            bankName: _bank == _other ? _otherBank.text.trim() : _bank,
            accountNo: _accountNo.text.trim(),
            accountName: _accountName.text.trim(),
            pin: pin,
          );
      if (!mounted) return;
      await context.read<WalletState>().refresh();
      if (!mounted) return;
      showSnack(context, S.withdrawRequested);
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = context.watch<WalletState>().wallet?.balance;
    return Scaffold(
      appBar: AppBar(title: const Text(S.withdrawTitle)),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (balance != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    '${S.balance}: ${formatKip(balance)}',
                    style: const TextStyle(
                      color: Brand.deepGreen,
                      fontWeight: FontWeight.w700,
                      fontFeatures: tabular,
                    ),
                  ),
                ),
              DropdownButtonFormField<String>(
                initialValue: _bank,
                decoration: const InputDecoration(labelText: S.bank),
                items: [
                  for (final b in banks)
                    DropdownMenuItem(
                      value: b,
                      child: Text(b == _other ? S.bankOther : b),
                    ),
                ],
                onChanged: (v) => setState(() => _bank = v ?? banks.first),
              ),
              if (_bank == _other) ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _otherBank,
                  decoration: const InputDecoration(labelText: S.bank),
                  validator: (v) =>
                      (v ?? '').trim().isEmpty ? S.required : null,
                ),
              ],
              const SizedBox(height: 12),
              TextFormField(
                controller: _accountNo,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9\-\s]')),
                ],
                style: const TextStyle(fontFeatures: tabular),
                decoration: const InputDecoration(labelText: S.accountNo),
                validator: (v) =>
                    (v ?? '').trim().length < 4 ? S.required : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _accountName,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(labelText: S.accountName),
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? S.required : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _amount,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: const TextStyle(fontSize: 20, fontFeatures: tabular),
                decoration: const InputDecoration(
                  labelText: S.amount,
                  suffixText: S.kip,
                ),
                validator: (v) {
                  final a = parseAmount(v ?? '');
                  if (a == null) return S.amountInvalid;
                  if (balance != null && a > balance) {
                    return S.amountExceedsBalance;
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _busy ? null : _submit,
                icon: _busy
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 3),
                      )
                    : const Icon(Icons.send_rounded),
                label: const Text(S.withdrawSubmit),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
