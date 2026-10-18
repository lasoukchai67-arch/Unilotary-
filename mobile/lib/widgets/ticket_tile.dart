import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../models/ticket.dart';
import '../theme.dart';
import '../utils/format.dart';
import 'money_text.dart';
import 'status_chip.dart';

/// Ticket summary row used on the home and tickets screens.
class TicketTile extends StatelessWidget {
  const TicketTile({super.key, required this.ticket, this.onTap});

  final Ticket ticket;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final numbers = ticket.lines.map((l) => l.number).join(', ');
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      ticket.ticketNo,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontFeatures: tabular,
                      ),
                    ),
                  ),
                  StatusChip.ticket(ticket.status),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${S.drawNo(ticket.drawNo)} · ${formatDateTime(ticket.createdAt)}',
                style: const TextStyle(color: Brand.grey, fontSize: 13),
              ),
              if (numbers.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  '${S.number}: $numbers',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontFeatures: tabular),
                ),
              ],
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: MoneyText(
                      ticket.totalAmount,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  if (ticket.totalWin > 0)
                    Row(
                      children: [
                        const Icon(
                          Icons.emoji_events_rounded,
                          size: 18,
                          color: Brand.gold,
                        ),
                        const SizedBox(width: 4),
                        MoneyText(
                          ticket.totalWin,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Brand.gold,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
