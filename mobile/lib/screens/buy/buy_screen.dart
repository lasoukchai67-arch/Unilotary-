import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../state/app_data.dart';
import '../../state/auth_state.dart';
import '../../state/cart.dart';
import '../../state/events.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../widgets/banners.dart';
import '../../widgets/cart_editor.dart';
import '../../widgets/common.dart';
import '../../widgets/countdown.dart';
import '../../widgets/money_text.dart';
import '../kyc/kyc_screen.dart';
import '../tickets/ticket_detail_screen.dart';
import '../wallet/deposit_screen.dart';

/// Number entry, cart and checkout for the signed-in customer.
class BuyScreen extends StatefulWidget {
  const BuyScreen({super.key});

  @override
  State<BuyScreen> createState() => _BuyScreenState();
}

class _BuyScreenState extends State<BuyScreen> {
  bool _paying = false;

  Future<void> _pay(Draw draw) async {
    final auth = context.read<AuthState>();
    final cart = context.read<Cart>();
    final user = auth.user;
    if (user == null || _paying) return;

    if (!user.isKycVerified) {
      await _kycRequired();
      return;
    }
    if (!draw.isOpen) {
      showSnack(context, S.drawNotOpen, error: true);
      return;
    }
    if (!cart.canCheckout(draw.rules)) return;

    final confirmed = await confirmDialog(
      context,
      title: S.confirmPurchase,
      message: S.confirmPurchaseBody(cart.lines.length, formatKip(cart.total)),
      confirmLabel: S.pay,
    );
    if (!confirmed || !mounted) return;

    await checkout(
      context,
      cart: cart,
      onBusy: (busy) {
        if (mounted) setState(() => _paying = busy);
      },
      submit: (key) => context.read<LotteryApi>().purchase(
            drawId: draw.id,
            lines: cart.toPurchaseLines(),
            idempotencyKey: key,
          ),
    );
  }

  Future<void> _kycRequired() async {
    final go = await confirmDialog(
      context,
      title: S.kycRequiredTitle,
      message: S.kycRequiredBody,
      confirmLabel: S.goToKyc,
    );
    if (go && mounted) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const KycScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final drawState = context.watch<DrawState>();
    final draw = drawState.current;
    final cart = context.watch<Cart>();

    if (draw == null) {
      if (drawState.error != null) {
        return ErrorView(error: drawState.error!, onRetry: drawState.refresh);
      }
      if (!drawState.loaded) return const LoadingView();
      return const EmptyView(
        text: S.noCurrentDraw,
        icon: Icons.event_busy_rounded,
      );
    }

    final canPay = draw.isOpen && cart.canCheckout(draw.rules) && !_paying;

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            color: Brand.deepGreen,
            onRefresh: drawState.refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              children: [
                _DrawBanner(draw: draw, offset: drawState.serverOffset),
                const SizedBox(height: 12),
                CartEditor(cart: cart, rules: draw.rules),
                const ResponsibleGamingFooter(),
              ],
            ),
          ),
        ),
        CheckoutBar(
          total: cart.total,
          lines: cart.lines.length,
          busy: _paying,
          label: S.pay,
          onPressed: canPay ? () => _pay(draw) : null,
        ),
      ],
    );
  }
}

/// Runs a purchase with the cart's Idempotency-Key and handles every
/// contract error. Shared by the customer and agent screens.
///
/// After a network error or 5xx the outcome is unknown, so the same key is
/// offered for a retry: the server replays the original result instead of
/// charging twice.
Future<void> checkout(
  BuildContext context, {
  required Cart cart,
  required ValueChanged<bool> onBusy,
  required Future<PurchaseResult> Function(String idempotencyKey) submit,
}) async {
  final wallet = context.read<WalletState>();
  final ticketEvents = context.read<TicketEvents>();
  final navigator = Navigator.of(context);

  while (true) {
    final PurchaseResult result;
    onBusy(true);
    try {
      result = await submit(cart.idempotencyKey);
    } on ApiException catch (e) {
      onBusy(false);
      if (!context.mounted) return;
      if (e.isRetryable) {
        final retry = await confirmDialog(
          context,
          title: S.connectionLost,
          message: S.retryPayment,
          confirmLabel: S.retry,
        );
        if (retry && context.mounted) continue;
        return; // The key is kept: pressing pay later is still a retry.
      }
      cart.completeAttempt();
      await _handlePurchaseError(context, cart, e);
      return;
    }

    onBusy(false);
    cart.checkedOut();
    ticketEvents.changed();
    if (result.balanceAfter != null) {
      wallet.setBalance(result.balanceAfter!);
    } else {
      unawaited(wallet.refresh());
    }
    await navigator.push(
      MaterialPageRoute<void>(
        builder: (_) =>
            TicketDetailScreen(ticket: result.ticket, justPurchased: true),
      ),
    );
    return;
  }
}

Future<void> _handlePurchaseError(
  BuildContext context,
  Cart cart,
  ApiException e,
) async {
  final auth = context.read<AuthState>();
  final drawState = context.read<DrawState>();
  switch (e.code) {
    case ErrorCode.numberLimit:
      cart.setLimits(e.numberLimits);
      await _showNumberLimits(context, e);
    case ErrorCode.userNotAllowed:
      // KYC, self-exclusion or a suspended account: reload to know which.
      await auth.refreshUser().catchError((_) {});
      if (!context.mounted) return;
      final user = auth.user;
      if (user != null && !user.isKycVerified) {
        final go = await confirmDialog(
          context,
          title: S.kycRequiredTitle,
          message: e.message,
          confirmLabel: S.goToKyc,
        );
        if (go && context.mounted) {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const KycScreen()),
          );
        }
      } else {
        await showMessageDialog(
          context,
          title: S.purchaseNotAllowed,
          message: e.message,
        );
      }
    case ErrorCode.insufficientBalance:
      final deposit = await confirmDialog(
        context,
        title: S.insufficientBalance,
        message: e.message,
        confirmLabel: S.deposit,
      );
      if (deposit && context.mounted) {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const DepositScreen()),
        );
      }
    case ErrorCode.drawNotOpen:
      await drawState.refresh();
      if (context.mounted) showError(context, e);
    default:
      showError(context, e);
  }
}

Future<void> _showNumberLimits(BuildContext context, ApiException e) {
  final details = e.numberLimits;
  return showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text(S.numberLimitTitle),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(e.message),
            const SizedBox(height: 12),
            for (final d in details)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    SizedBox(
                      width: 72,
                      child: Text(
                        d.number,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                          fontFeatures: tabular,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        switch (d.reason) {
                          NumberLimitReason.closed => S.limitClosed,
                          NumberLimitReason.full =>
                            d.remaining == null || d.remaining! <= 0
                                ? S.limitFullNone
                                : S.limitFull(formatKip(d.remaining!)),
                          NumberLimitReason.norule => S.limitNoRule,
                          NumberLimitReason.unknown => S.errorGeneric,
                        },
                        style: const TextStyle(color: Brand.red),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
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

class _DrawBanner extends StatelessWidget {
  const _DrawBanner({required this.draw, required this.offset});

  final Draw draw;
  final Duration offset;

  @override
  Widget build(BuildContext context) {
    final short = MediaQuery.sizeOf(context).height < 760;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: short ? 6 : 10),
      decoration: BoxDecoration(
        color: Brand.deepGreen,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Text(
            S.drawNo(draw.drawNo),
            style: const TextStyle(
              color: Brand.white,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Align(
              alignment: Alignment.centerRight,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: draw.isOpen
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            '${S.closesIn} ',
                            style: TextStyle(color: Brand.mintSurface),
                          ),
                          Countdown(
                            target: draw.salesCloseAt,
                            serverOffset: offset,
                            style: const TextStyle(
                              color: Brand.mint,
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      )
                    : const Text(
                        S.drawNotOpen,
                        style: TextStyle(color: Brand.mintSurface, fontSize: 12),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sticky bottom bar with the total and the pay button.
class CheckoutBar extends StatelessWidget {
  const CheckoutBar({
    super.key,
    required this.total,
    required this.lines,
    required this.busy,
    required this.label,
    required this.onPressed,
  });

  final int total;
  final int lines;
  final bool busy;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Brand.white,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${S.total} ($lines ${S.lines})',
                      style: const TextStyle(color: Brand.grey, fontSize: 13),
                    ),
                    MoneyText(
                      total,
                      key: const ValueKey('cart-total'),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Brand.deepGreen,
                      ),
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                key: const ValueKey('pay'),
                onPressed: onPressed,
                icon: busy
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 3),
                      )
                    : const Icon(Icons.payments_rounded),
                label: Text(label),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
