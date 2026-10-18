import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../models/models.dart';
import '../theme.dart';

/// Small coloured status pill.
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    required this.color,
    this.icon,
  });

  factory StatusChip.ticket(TicketStatus s) => switch (s) {
        TicketStatus.active => const StatusChip(
            label: S.statusActive,
            color: Brand.midGreen,
            icon: Icons.schedule_rounded,
          ),
        TicketStatus.won => const StatusChip(
            label: S.statusWon,
            color: Brand.gold,
            icon: Icons.emoji_events_rounded,
          ),
        TicketStatus.lost => const StatusChip(
            label: S.statusLost,
            color: Brand.grey,
          ),
        TicketStatus.paid => const StatusChip(
            label: S.statusPaid,
            color: Brand.deepGreen,
            icon: Icons.check_circle_rounded,
          ),
        TicketStatus.cancelled => const StatusChip(
            label: S.statusCancelled,
            color: Brand.red,
            icon: Icons.block_rounded,
          ),
      };

  factory StatusChip.draw(DrawStatus s) => switch (s) {
        DrawStatus.scheduled =>
          const StatusChip(label: S.drawScheduled, color: Brand.grey),
        DrawStatus.open =>
          const StatusChip(label: S.drawOpen, color: Brand.midGreen),
        DrawStatus.closed =>
          const StatusChip(label: S.drawClosed, color: Brand.gold),
        DrawStatus.resulted =>
          const StatusChip(label: S.drawResulted, color: Brand.deepGreen),
        DrawStatus.cancelled =>
          const StatusChip(label: S.drawCancelled, color: Brand.red),
      };

  factory StatusChip.withdrawal(WithdrawalStatus s) => switch (s) {
        WithdrawalStatus.requested =>
          const StatusChip(label: S.wdRequested, color: Brand.gold),
        WithdrawalStatus.approved =>
          const StatusChip(label: S.wdApproved, color: Brand.midGreen),
        WithdrawalStatus.paid =>
          const StatusChip(label: S.wdPaid, color: Brand.deepGreen),
        WithdrawalStatus.rejected =>
          const StatusChip(label: S.wdRejected, color: Brand.red),
        WithdrawalStatus.failed =>
          const StatusChip(label: S.wdFailed, color: Brand.red),
      };

  factory StatusChip.kyc(KycStatus s) => switch (s) {
        KycStatus.unsubmitted =>
          const StatusChip(label: S.kycUnsubmitted, color: Brand.grey),
        KycStatus.pending =>
          const StatusChip(label: S.kycPending, color: Brand.gold),
        KycStatus.verified => const StatusChip(
            label: S.kycVerified,
            color: Brand.midGreen,
            icon: Icons.verified_rounded,
          ),
        KycStatus.rejected =>
          const StatusChip(label: S.kycRejected, color: Brand.red),
      };

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    // Slightly darker text than the tint keeps small labels readable.
    final textColor = Color.lerp(color, Colors.black, 0.2)!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 15, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
