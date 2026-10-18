import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../api/lottery_api.dart';
import '../l10n/strings.dart';
import '../state/app_data.dart';
import '../state/auth_state.dart';
import '../state/events.dart';
import '../theme.dart';
import '../utils/format.dart';
import '../widgets/common.dart';
import '../widgets/digit_tiles.dart';
import 'demo_mode.dart';

const _bannerBg = Color(0xFFFFE7A8);
const _bannerText = Color(0xFF5C3B00);

/// Puts the always-visible demo strip above the whole app. The app below is
/// laid out in the remaining space (status-bar padding is consumed by the
/// strip), so the strip never covers any button.
class DemoFrame extends StatelessWidget {
  const DemoFrame({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Column(
      children: [
        Material(
          color: _bannerBg,
          child: Padding(
            padding: EdgeInsets.only(top: top),
            child: const DemoBanner(),
          ),
        ),
        Expanded(
          // Own semantics container: a route's BlockSemantics would otherwise
          // hide the banner from screen readers.
          child: Semantics(
            container: true,
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              child: child,
            ),
          ),
        ),
      ],
    );
  }
}

class DemoBanner extends StatelessWidget {
  const DemoBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: S.demoBanner,
      excludeSemantics: true,
      child: const SizedBox(
        key: ValueKey('demo-banner'),
        width: double.infinity,
        height: 22,
        child: Center(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                S.demoBanner,
                maxLines: 1,
                style: TextStyle(
                  fontFamily: AppFonts.lao,
                  fontFamilyFallback: AppFonts.fallback,
                  color: _bannerText,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                  decoration: TextDecoration.none,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Login-screen hint: any phone works; the documented agent phone.
class DemoLoginHint extends StatelessWidget {
  const DemoLoginHint({super.key, required this.onUseAgentPhone});

  final VoidCallback onUseAgentPhone;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('demo-login-hint'),
      padding: const EdgeInsets.fromLTRB(12, 10, 4, 4),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF6DC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2B64B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            S.demoLoginHint,
            style: TextStyle(color: _bannerText, fontSize: 13),
          ),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Text(
                S.demoAgentHint,
                style: TextStyle(color: _bannerText, fontSize: 13),
              ),
              TextButton(
                key: const ValueKey('demo-use-agent'),
                onPressed: onUseAgentPhone,
                child: const Text(
                  S.demoAgentPhone,
                  style: TextStyle(fontWeight: FontWeight.w700, fontFeatures: tabular),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// "ເຄື່ອງມືສາທິດ" section on the profile screen (demo mode only).
class DemoToolsCard extends StatefulWidget {
  const DemoToolsCard({super.key});

  @override
  State<DemoToolsCard> createState() => _DemoToolsCardState();
}

class _DemoToolsCardState extends State<DemoToolsCard> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refreshAll() async {
    final auth = context.read<AuthState>();
    final wallet = context.read<WalletState>();
    final draws = context.read<DrawState>();
    final notifications = context.read<NotificationState>();
    context.read<TicketEvents>().changed();
    await Future.wait([
      auth.refreshUser().catchError((_) {}),
      wallet.refresh(),
      draws.refresh(),
      notifications.refresh(),
    ]);
  }

  Future<void> _settle() async {
    DemoSettleResult? result;
    await _run(() async {
      result = await context.read<LotteryApi>().demoSettleDraw();
      await _refreshAll();
    });
    // Shown after the busy spinner is cleared.
    final r = result;
    if (r != null && mounted) await _showSettlement(r);
  }

  Future<void> _topUp() => _run(() async {
        await context.read<LotteryApi>().demoTopUp();
        await _refreshAll();
        if (mounted) showSnack(context, S.demoToppedUp);
      });

  Future<void> _reset() async {
    final ok = await confirmDialog(
      context,
      title: S.demoReset,
      message: S.demoResetConfirm,
      confirmLabel: S.demoReset,
      destructive: true,
    );
    if (!ok || !mounted) return;
    await _run(() async {
      final auth = context.read<AuthState>();
      await context.read<LotteryApi>().demoReset();
      await auth.logout();
    });
  }

  Future<void> _showSettlement(DemoSettleResult r) {
    final String you;
    if (r.yourTickets == 0) {
      you = S.demoNoTickets;
    } else if (r.yourPendingWin > 0) {
      you = S.demoYouWonPending(formatKip(r.yourPendingWin));
    } else if (r.yourWin > 0) {
      you = S.demoYouWon(formatKip(r.yourWin));
    } else {
      you = S.demoYouLost;
    }
    final won = r.yourWin > 0 || r.yourPendingWin > 0;
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(S.demoSettleTitle(r.drawNo)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: DigitTiles(
                r.resultNumber,
                key: const ValueKey('demo-result'),
                size: 36,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              you,
              key: const ValueKey('demo-settle-you'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: won ? Brand.deepGreen : Brand.text,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              S.demoWinners(r.winners, formatKip(r.totalWin)),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Brand.grey),
            ),
            Text(
              S.demoNextDraw(r.nextDrawNo),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Brand.grey),
            ),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(S.ok),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      key: const ValueKey('demo-tools'),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Color(0xFFE2B64B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: const Color(0xFFFFF6DC),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
            child: Row(
              children: [
                const Icon(Icons.science_outlined, color: _bannerText),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    S.demoTools,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: _bannerText,
                    ),
                  ),
                ),
                if (_busy)
                  const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  ),
              ],
            ),
          ),
          ListTile(
            key: const ValueKey('demo-settle'),
            enabled: !_busy,
            leading: const Icon(Icons.casino_outlined),
            title: const Text(S.demoSettle),
            subtitle: const Text(S.demoSettleHint),
            onTap: _settle,
          ),
          const Divider(),
          ListTile(
            key: const ValueKey('demo-topup'),
            enabled: !_busy,
            leading: const Icon(Icons.savings_outlined),
            title: const Text(S.demoTopUp),
            subtitle: const Text(S.demoTopUpHint),
            onTap: _topUp,
          ),
          const Divider(),
          ListTile(
            key: const ValueKey('demo-reset'),
            enabled: !_busy,
            leading: const Icon(Icons.restart_alt_rounded, color: Brand.red),
            title: const Text(S.demoReset, style: TextStyle(color: Brand.red)),
            subtitle: const Text(S.demoResetHint),
            onTap: _reset,
          ),
        ],
      ),
    );
  }
}
