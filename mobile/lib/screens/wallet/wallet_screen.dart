import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../state/app_data.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../widgets/common.dart';
import '../../widgets/money_text.dart';
import '../../widgets/paged_list.dart';
import 'deposit_screen.dart';
import 'withdraw_screen.dart';
import 'withdrawals_screen.dart';

/// Balance, actions and the transaction history (infinite scroll).
class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = context.read<LotteryApi>();
    return PagedListView<WalletTx>(
      fetch: (before) => api.transactions(limit: 20, before: before),
      onRefresh: context.read<WalletState>().refresh,
      emptyText: S.noTransactions,
      header: const _WalletHeader(),
      itemBuilder: (context, tx) => _TxTile(tx: tx),
    );
  }
}

class _WalletHeader extends StatelessWidget {
  const _WalletHeader();

  void _open(BuildContext context, Widget screen) => Navigator.of(context)
      .push(MaterialPageRoute<void>(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    final w = context.watch<WalletState>().wallet;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(S.balance, style: TextStyle(color: Brand.grey)),
                const SizedBox(height: 4),
                w == null
                    ? const Text('—', style: TextStyle(fontSize: 30))
                    : MoneyText(
                        w.balance,
                        key: const ValueKey('wallet-balance'),
                        style: const TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w700,
                          color: Brand.deepGreen,
                        ),
                      ),
                const SizedBox(height: 4),
                Text(
                  '${S.held}: ${formatKip(w?.held ?? 0)}',
                  style: const TextStyle(
                    color: Brand.grey,
                    fontFeatures: tabular,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () =>
                            _open(context, const DepositScreen()),
                        icon: const Icon(Icons.qr_code_2_rounded),
                        label: const Text(S.deposit),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () =>
                            _open(context, const WithdrawScreen()),
                        icon: const Icon(Icons.account_balance_rounded),
                        label: const Text(S.withdraw),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () =>
                        _open(context, const WithdrawalsScreen()),
                    icon: const Icon(Icons.history_rounded),
                    label: const Text(S.withdrawalsTitle),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SectionTitle(S.transactions),
      ],
    );
  }
}

class _TxTile extends StatelessWidget {
  const _TxTile({required this.tx});

  final WalletTx tx;

  (String, IconData) get _kind => switch (tx.type) {
        WalletTxType.deposit => (S.txDeposit, Icons.south_west_rounded),
        WalletTxType.withdraw => (S.txWithdraw, Icons.north_east_rounded),
        WalletTxType.purchase =>
          (S.txPurchase, Icons.confirmation_number_outlined),
        WalletTxType.payout => (S.txPayout, Icons.emoji_events_outlined),
        WalletTxType.refund => (S.txRefund, Icons.undo_rounded),
        WalletTxType.commission => (S.txCommission, Icons.handshake_outlined),
        WalletTxType.adjust => (S.txAdjust, Icons.tune_rounded),
      };

  @override
  Widget build(BuildContext context) {
    final (label, icon) = _kind;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Brand.mintSurface,
          foregroundColor: Brand.deepGreen,
          child: Icon(icon),
        ),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          [
            formatDateTime(tx.createdAt),
            if (tx.note != null && tx.note!.isNotEmpty) tx.note!,
          ].join(' · '),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            MoneyText(
              tx.amount,
              signed: true,
              colorize: true,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            Text(
              formatKip(tx.balanceAfter),
              style: const TextStyle(
                color: Brand.grey,
                fontSize: 12,
                fontFeatures: tabular,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
