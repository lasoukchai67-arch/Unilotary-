import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../state/app_data.dart';
import '../../state/events.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../widgets/banners.dart';
import '../../widgets/common.dart';
import '../../widgets/countdown.dart';
import '../../widgets/digit_tiles.dart';
import '../../widgets/money_text.dart';
import '../../widgets/status_chip.dart';
import '../../widgets/ticket_tile.dart';
import '../tickets/ticket_detail_screen.dart';
import '../wallet/deposit_screen.dart';
import '../wallet/withdraw_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Ticket>? _recent;
  ApiException? _recentError;
  late final TicketEvents _ticketEvents;

  @override
  void initState() {
    super.initState();
    _ticketEvents = context.read<TicketEvents>()..addListener(_loadRecent);
    _loadRecent();
  }

  @override
  void dispose() {
    _ticketEvents.removeListener(_loadRecent);
    super.dispose();
  }

  Future<void> _loadRecent() async {
    try {
      final page = await context.read<LotteryApi>().tickets(limit: 5);
      if (!mounted) return;
      setState(() {
        _recent = page.items;
        _recentError = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _recentError = e);
    }
  }

  Future<void> _refresh() async {
    await Future.wait([
      context.read<WalletState>().refresh(),
      context.read<DrawState>().refresh(),
      context.read<NotificationState>().refresh(),
      _loadRecent(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: Brand.deepGreen,
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        children: [
          const _BalanceCard(),
          const SizedBox(height: 14),
          const _CurrentDrawCard(),
          const SectionTitle(S.lastResult),
          const _LastResultCard(),
          SectionTitle(
            S.recentTickets,
            trailing: TextButton(
              onPressed: () => context.read<ShellTabs>().go(ShellTabs.tickets),
              child: const Text(S.seeAll),
            ),
          ),
          ..._recentTickets(),
          const ResponsibleGamingFooter(),
        ],
      ),
    );
  }

  List<Widget> _recentTickets() {
    if (_recentError != null && _recent == null) {
      return [ErrorView(error: _recentError!, onRetry: _loadRecent)];
    }
    final recent = _recent;
    if (recent == null) return const [LoadingView()];
    if (recent.isEmpty) {
      return const [
        Card(
          child: EmptyView(
            text: S.noTickets,
            icon: Icons.receipt_long_outlined,
          ),
        ),
      ];
    }
    return [
      for (final t in recent)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TicketTile(
            ticket: t,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => TicketDetailScreen(ticket: t),
              ),
            ),
          ),
        ),
    ];
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard();

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletState>();
    final w = wallet.wallet;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          colors: [Brand.deepGreen, Brand.midGreen],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(S.balance, style: TextStyle(color: Brand.mintSurface)),
          const SizedBox(height: 6),
          if (w == null && wallet.error != null)
            Text(
              errorMessage(wallet.error!),
              style: const TextStyle(color: Brand.white),
            )
          else if (w == null)
            const SizedBox(
              height: 36,
              child: Align(
                alignment: Alignment.centerLeft,
                child: CircularProgressIndicator(color: Brand.mint),
              ),
            )
          else ...[
            MoneyText(
              w.balance,
              key: const ValueKey('home-balance'),
              style: const TextStyle(
                color: Brand.white,
                fontSize: 30,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (w.held > 0)
              Text(
                '${S.held}: ${formatKip(w.held)}',
                style: const TextStyle(
                  color: Brand.mintSurface,
                  fontFeatures: tabular,
                ),
              ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const DepositScreen(),
                    ),
                  ),
                  icon: const Icon(Icons.qr_code_2_rounded),
                  label: const Text(S.deposit),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Brand.white,
                    side: const BorderSide(color: Brand.mintSurface),
                  ),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const WithdrawScreen(),
                    ),
                  ),
                  icon: const Icon(Icons.account_balance_rounded),
                  label: const Text(S.withdraw),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CurrentDrawCard extends StatelessWidget {
  const _CurrentDrawCard();

  @override
  Widget build(BuildContext context) {
    final drawState = context.watch<DrawState>();
    final draw = drawState.current;

    Widget body;
    if (draw == null) {
      if (!drawState.loaded && drawState.error == null) {
        body = const LoadingView();
      } else if (drawState.error != null) {
        body = ErrorView(error: drawState.error!, onRetry: drawState.refresh);
      } else {
        body = const EmptyView(
          text: S.noCurrentDraw,
          icon: Icons.event_busy_rounded,
        );
      }
      return Card(child: body);
    }

    final countdownStyle = const TextStyle(
      fontSize: 28,
      fontWeight: FontWeight.w700,
      color: Brand.deepGreen,
    );

    Widget timing;
    switch (draw.status) {
      case DrawStatus.open:
        timing = _Timing(
          label: S.closesIn,
          child: Countdown(
            target: draw.salesCloseAt,
            serverOffset: drawState.serverOffset,
            style: countdownStyle,
            onFinished: drawState.refresh,
          ),
        );
      case DrawStatus.scheduled:
        timing = _Timing(
          label: S.opensIn,
          child: Countdown(
            target: draw.salesOpenAt,
            serverOffset: drawState.serverOffset,
            style: countdownStyle,
            onFinished: drawState.refresh,
          ),
        );
      default:
        timing = const Text(
          S.salesClosed,
          style: TextStyle(fontWeight: FontWeight.w700, color: Brand.grey),
        );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    S.drawNo(draw.drawNo),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: Brand.deepGreen,
                    ),
                  ),
                ),
                StatusChip.draw(draw.status),
              ],
            ),
            Text(
              '${S.drawDate}: ${formatIsoDate(draw.drawDate)}',
              style: const TextStyle(color: Brand.grey),
            ),
            const SizedBox(height: 12),
            timing,
            if (draw.rules.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final r in draw.rules)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Brand.mintSurface,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${S.digitsLabel(r.digits)} ${S.payoutLabel(r.payoutRate)}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Brand.deepGreen,
                          fontFeatures: tabular,
                        ),
                      ),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 60,
              child: FilledButton.icon(
                key: const ValueKey('home-buy'),
                onPressed: draw.isOpen
                    ? () => context.read<ShellTabs>().go(ShellTabs.buy)
                    : null,
                icon: const Icon(Icons.dialpad_rounded, size: 26),
                label: const Text(
                  S.buyNow,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Timing extends StatelessWidget {
  const _Timing({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Brand.grey)),
          child,
        ],
      );
}

class _LastResultCard extends StatelessWidget {
  const _LastResultCard();

  @override
  Widget build(BuildContext context) {
    final drawState = context.watch<DrawState>();
    final draw = drawState.lastResult;
    if (draw == null || draw.resultNumber == null) {
      return Card(
        child: drawState.loaded
            ? const EmptyView(text: S.noResultYet, icon: Icons.hourglass_empty)
            : const LoadingView(),
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(
              '${S.drawNo(draw.drawNo)} · ${formatIsoDate(draw.drawDate)}',
              style: const TextStyle(color: Brand.grey),
            ),
            const SizedBox(height: 10),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: DigitTiles(
                draw.resultNumber!,
                key: const ValueKey('last-result'),
                size: 46,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
