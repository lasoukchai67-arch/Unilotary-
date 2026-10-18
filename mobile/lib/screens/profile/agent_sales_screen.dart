import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../state/app_data.dart';
import '../../state/cart.dart';
import '../../theme.dart';
import '../../utils/phone.dart';
import '../../widgets/cart_editor.dart';
import '../../widgets/common.dart';
import '../../widgets/money_text.dart';
import '../buy/buy_screen.dart';

/// "ຂາຍແທນລູກຄ້າ": agents sell tickets paid from their own wallet.
class AgentSalesScreen extends StatefulWidget {
  const AgentSalesScreen({super.key});

  @override
  State<AgentSalesScreen> createState() => _AgentSalesScreenState();
}

class _AgentSalesScreenState extends State<AgentSalesScreen> {
  /// Separate from the customer's own cart.
  final _cart = Cart();
  final _buyerPhone = TextEditingController();
  final _phoneKey = GlobalKey<FormFieldState<String>>();
  AgentSummary? _summary;
  ApiException? _summaryError;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadSummary();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final draws = context.read<DrawState>();
      if (!draws.loaded) draws.refresh();
    });
  }

  @override
  void dispose() {
    _cart.dispose();
    _buyerPhone.dispose();
    super.dispose();
  }

  Future<void> _loadSummary() async {
    try {
      final s = await context.read<LotteryApi>().agentSummary();
      if (mounted) setState(() => _summary = s);
    } on ApiException catch (e) {
      if (mounted) setState(() => _summaryError = e);
    }
  }

  Future<void> _sell(Draw draw) async {
    if (!(_phoneKey.currentState?.validate() ?? true) || _busy) return;
    final phoneText = _buyerPhone.text.trim();
    final buyer = phoneText.isEmpty ? null : normalizePhone(phoneText);
    await checkout(
      context,
      cart: _cart,
      onBusy: (busy) {
        if (mounted) setState(() => _busy = busy);
      },
      submit: (key) => context.read<LotteryApi>().agentSale(
            drawId: draw.id,
            buyerPhone: buyer,
            lines: _cart.toPurchaseLines(),
            idempotencyKey: key,
          ),
    );
    if (mounted && _cart.isEmpty) {
      _buyerPhone.clear();
      await _loadSummary();
    }
  }

  @override
  Widget build(BuildContext context) {
    final drawState = context.watch<DrawState>();
    final draw = drawState.current;

    return Scaffold(
      appBar: AppBar(title: const Text(S.agentSales)),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _SummaryCard(summary: _summary, error: _summaryError),
                const SizedBox(height: 12),
                TextFormField(
                  key: _phoneKey,
                  controller: _buyerPhone,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s\-]')),
                  ],
                  decoration: const InputDecoration(
                    labelText: S.buyerPhoneOptional,
                    prefixIcon: Icon(Icons.phone_rounded),
                  ),
                  validator: (v) {
                    final text = (v ?? '').trim();
                    if (text.isEmpty) return null;
                    return isValidLaoPhone(text) ? null : S.phoneInvalid;
                  },
                ),
                const SizedBox(height: 4),
                const Text(
                  S.agentPaidFromWallet,
                  style: TextStyle(color: Brand.grey, fontSize: 13),
                ),
                const SizedBox(height: 12),
                if (draw == null)
                  drawState.error != null
                      ? ErrorView(
                          error: drawState.error!,
                          onRetry: drawState.refresh,
                        )
                      : const EmptyView(text: S.noCurrentDraw)
                else ...[
                  Text(
                    S.drawNo(draw.drawNo),
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Brand.deepGreen,
                    ),
                  ),
                  const SizedBox(height: 8),
                  CartEditor(cart: _cart, rules: draw.rules),
                ],
              ],
            ),
          ),
          ListenableBuilder(
            listenable: _cart,
            builder: (context, _) => CheckoutBar(
              total: _cart.total,
              lines: _cart.lines.length,
              busy: _busy,
              label: S.agentSell,
              onPressed: draw != null &&
                      draw.isOpen &&
                      _cart.canCheckout(draw.rules) &&
                      !_busy
                  ? () => _sell(draw)
                  : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary, required this.error});

  final AgentSummary? summary;
  final ApiException? error;

  @override
  Widget build(BuildContext context) {
    final s = summary;
    if (s == null) {
      return Card(
        child: error != null ? ErrorView(error: error!) : const LoadingView(),
      );
    }
    Widget cell(String label, Widget value) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: Brand.grey, fontSize: 13)),
              DefaultTextStyle.merge(
                style: const TextStyle(fontWeight: FontWeight.w700),
                child: value,
              ),
            ],
          ),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              S.agentSummary,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: Brand.deepGreen,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                cell(S.agentSalesTotal, MoneyText(s.sales)),
                cell(
                  S.agentTickets,
                  Text('${s.tickets}', style: const TextStyle(fontFeatures: tabular)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                cell(S.commissionPending, MoneyText(s.commissionPending)),
                cell(S.commissionSettled, MoneyText(s.commissionSettled)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
