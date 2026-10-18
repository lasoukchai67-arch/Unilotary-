import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../utils/phone.dart';
import '../../widgets/common.dart';
import '../../widgets/digit_tiles.dart';
import '../../widgets/money_text.dart';
import '../../widgets/status_chip.dart';

/// Ticket with its lines, prizes and verification QR code.
class TicketDetailScreen extends StatefulWidget {
  const TicketDetailScreen({
    super.key,
    required this.ticket,
    this.justPurchased = false,
  });

  final Ticket ticket;

  /// Shows the "purchase successful" banner.
  final bool justPurchased;

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  late Ticket _ticket = widget.ticket;

  @override
  void initState() {
    super.initState();
    // List responses may be trimmed; fetch the full ticket if needed.
    if (widget.ticket.lines.isEmpty) _reload();
  }

  Future<void> _reload() async {
    try {
      final t = await context.read<LotteryApi>().ticket(_ticket.id);
      if (mounted) setState(() => _ticket = t);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    }
  }

  String _shareText() {
    final lines = _ticket.lines
        .map((l) => '${l.number} = ${formatKip(l.amount)}')
        .join('\n');
    return S.shareTicketText(
      ticketNo: _ticket.ticketNo,
      drawNo: _ticket.drawNo,
      lines: lines,
      total: formatKip(_ticket.totalAmount),
      verifyCode: _ticket.verifyCode,
    );
  }

  Future<void> _share() async {
    try {
      await SharePlus.instance.share(
        ShareParams(text: _shareText(), subject: _ticket.ticketNo),
      );
    } on Exception {
      if (mounted) showSnack(context, S.errorGeneric, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = _ticket;
    return Scaffold(
      appBar: AppBar(
        title: Text(t.ticketNo),
        actions: [
          IconButton(
            tooltip: S.share,
            onPressed: _share,
            icon: const Icon(Icons.share_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: Brand.deepGreen,
        onRefresh: _reload,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (widget.justPurchased) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Brand.mint,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle_rounded, color: Brand.deepGreen),
                    SizedBox(width: 10),
                    Text(
                      S.purchaseSuccess,
                      key: ValueKey('purchase-success'),
                      style: TextStyle(
                        color: Brand.deepGreen,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            S.drawNo(t.drawNo),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Brand.deepGreen,
                            ),
                          ),
                        ),
                        StatusChip.ticket(t.status),
                      ],
                    ),
                    const Divider(height: 24),
                    InfoRow(
                      label: S.ticketNo,
                      value: SelectableText(
                        t.ticketNo,
                        style: const TextStyle(fontFeatures: tabular),
                      ),
                    ),
                    InfoRow(
                      label: S.purchasedAt,
                      value: Text(formatDateTime(t.createdAt)),
                    ),
                    if (t.buyerPhone != null)
                      InfoRow(
                        label: S.buyerPhone,
                        value: Text(formatPhone(t.buyerPhone!)),
                      ),
                    InfoRow(
                      label: S.total,
                      value: MoneyText(
                        t.totalAmount,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    if (t.totalWin > 0)
                      InfoRow(
                        label: S.totalWin,
                        value: MoneyText(
                          t.totalWin,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Brand.gold,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SectionTitle(S.lines),
            Card(
              child: Column(
                children: [
                  for (var i = 0; i < t.lines.length; i++) ...[
                    if (i > 0) const Divider(indent: 16, endIndent: 16),
                    _LineRow(line: t.lines[i]),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    QrImageView(
                      data: t.qrPayload,
                      size: 200,
                      backgroundColor: Brand.white,
                      semanticsLabel: '${S.ticketNo} ${t.ticketNo}',
                      eyeStyle: const QrEyeStyle(
                        eyeShape: QrEyeShape.square,
                        color: Brand.deepGreen,
                      ),
                      dataModuleStyle: const QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square,
                        color: Brand.text,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${S.verifyCode}: ${t.verifyCode}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                        fontFeatures: tabular,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      S.showQrHint,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Brand.grey, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _share,
              icon: const Icon(Icons.share_rounded),
              label: const Text(S.share),
            ),
          ],
        ),
      ),
    );
  }
}

class _LineRow extends StatelessWidget {
  const _LineRow({required this.line});

  final TicketLine line;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          DigitTiles(line.number, size: 26),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MoneyText(
                  line.amount,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                Text(
                  '${S.digitsLabel(line.digits)} · ${S.payoutLabel(line.payoutRate)}',
                  style: const TextStyle(color: Brand.grey, fontSize: 12),
                ),
              ],
            ),
          ),
          if (line.isWinner)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  S.winAmount,
                  style: TextStyle(color: Brand.gold, fontSize: 12),
                ),
                MoneyText(
                  line.winAmount,
                  style: const TextStyle(
                    color: Brand.gold,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
