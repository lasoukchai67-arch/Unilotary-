import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../widgets/money_text.dart';
import '../../widgets/paged_list.dart';
import '../../widgets/status_chip.dart';

class WithdrawalsScreen extends StatelessWidget {
  const WithdrawalsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = context.read<LotteryApi>();
    return Scaffold(
      appBar: AppBar(title: const Text(S.withdrawalsTitle)),
      body: PagedListView<Withdrawal>(
        fetch: (before) => api.withdrawals(limit: 20, before: before),
        emptyText: S.noWithdrawals,
        itemBuilder: (context, w) => Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: MoneyText(
                        w.amount,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 17,
                        ),
                      ),
                    ),
                    StatusChip.withdrawal(w.status),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${w.bankName} · ${w.accountNo} · ${w.accountName}',
                  style: const TextStyle(fontFeatures: tabular),
                ),
                Text(
                  formatDateTime(w.createdAt),
                  style: const TextStyle(color: Brand.grey, fontSize: 13),
                ),
                if (w.note != null && w.note!.isNotEmpty)
                  Text(
                    w.note!,
                    style: const TextStyle(color: Brand.red, fontSize: 13),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
