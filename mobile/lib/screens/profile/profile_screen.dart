import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../state/app_data.dart';
import '../../state/auth_state.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../utils/phone.dart';
import '../../widgets/banners.dart';
import '../../widgets/common.dart';
import '../../widgets/pin_dialog.dart';
import '../../widgets/status_chip.dart';
import '../kyc/kyc_screen.dart';
import 'agent_sales_screen.dart';
import 'change_pin_screen.dart';
import 'notifications_screen.dart';

/// Self-exclusion periods offered to the user.
const selfExclusionOptions = [1, 7, 30, 90];

String _roleLabel(UserRole role) => switch (role) {
      UserRole.customer => S.roleCustomer,
      UserRole.agent => S.roleAgent,
      UserRole.admin => S.roleAdmin,
      UserRole.finance => S.roleFinance,
      UserRole.auditor => S.roleAuditor,
    };

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  void _open(BuildContext context, Widget screen) => Navigator.of(context)
      .push(MaterialPageRoute<void>(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    final unread = context.watch<NotificationState>().unread;
    if (user == null) return const Scaffold(body: LoadingView());
    final excluded = user.isSelfExcluded(DateTime.now());

    return Scaffold(
      appBar: AppBar(title: const Text(S.profile)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 28,
                    backgroundColor: Brand.mint,
                    foregroundColor: Brand.deepGreen,
                    child: Icon(Icons.person_rounded, size: 32),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (user.fullName != null)
                          Text(
                            user.fullName!,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 17,
                            ),
                          ),
                        Text(
                          formatPhone(user.phone),
                          key: const ValueKey('profile-phone'),
                          style: const TextStyle(fontFeatures: tabular),
                        ),
                        if (user.role != UserRole.customer)
                          Text(
                            '${S.role}: ${_roleLabel(user.role)}',
                            style: const TextStyle(color: Brand.grey),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: const Text(S.kycStatus),
                  trailing: StatusChip.kyc(user.kyc),
                  onTap: () => _open(context, const KycScreen()),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.notifications_outlined),
                  title: const Text(S.notifications),
                  trailing: Badge(
                    isLabelVisible: unread > 0,
                    label: Text('$unread'),
                    child: const Icon(Icons.chevron_right_rounded),
                  ),
                  onTap: () => _open(context, const NotificationsScreen()),
                ),
                if (user.isAgent) ...[
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.storefront_outlined),
                    title: const Text(S.agentSales),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => _open(context, const AgentSalesScreen()),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.password_rounded),
                  title: const Text(S.changePin),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => _open(context, const ChangePinScreen()),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.savings_outlined),
                  title: const Text(S.dailyCap),
                  subtitle: Text(
                    user.dailySpendCap == null
                        ? S.dailyCapNone
                        : formatKip(user.dailySpendCap!),
                    style: const TextStyle(fontFeatures: tabular),
                  ),
                  trailing: const Icon(Icons.edit_outlined),
                  onTap: () => _editDailyCap(context, user),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.pause_circle_outline_rounded),
                  title: const Text(S.selfExclusion),
                  subtitle: Text(
                    excluded
                        ? S.selfExcludedUntil(
                            formatDateTime(user.selfExcludedUntil!),
                          )
                        : S.selfExclusionHint,
                    style: TextStyle(color: excluded ? Brand.red : null),
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => _selfExclude(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.description_outlined),
                  title: const Text(S.licenses),
                  onTap: () => showLicensePage(
                    context: context,
                    applicationName: S.appName,
                  ),
                ),
                const Divider(),
                ListTile(
                  key: const ValueKey('logout'),
                  leading: const Icon(Icons.logout_rounded, color: Brand.red),
                  title: const Text(
                    S.logout,
                    style: TextStyle(color: Brand.red),
                  ),
                  onTap: () => _logout(context),
                ),
              ],
            ),
          ),
          const ResponsibleGamingFooter(),
        ],
      ),
    );
  }

  Future<void> _logout(BuildContext context) async {
    final ok = await confirmDialog(
      context,
      title: S.logout,
      message: S.logoutConfirm,
      confirmLabel: S.logout,
      destructive: true,
    );
    if (ok && context.mounted) await context.read<AuthState>().logout();
  }

  Future<void> _editDailyCap(BuildContext context, User user) async {
    final cap = await showDialog<_CapChoice>(
      context: context,
      builder: (_) => _DailyCapDialog(initial: user.dailySpendCap),
    );
    if (cap == null || !context.mounted) return;
    final pin = await showPinDialog(context, title: S.dailyCap);
    if (pin == null || !context.mounted) return;
    try {
      final updated = await context
          .read<LotteryApi>()
          .updateSettings(dailySpendCap: cap.value, pin: pin);
      if (!context.mounted) return;
      context.read<AuthState>().updateUser(updated);
      showSnack(context, S.dailyCapSaved);
    } on ApiException catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  Future<void> _selfExclude(BuildContext context) async {
    final days = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(
                S.selfExclusion,
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
              ),
            ),
            for (final d in selfExclusionOptions)
              ListTile(
                title: Text(S.daysOption(d)),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => Navigator.of(ctx).pop(d),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (days == null || !context.mounted) return;

    final confirmed = await confirmDialog(
      context,
      title: S.selfExclusionConfirmTitle,
      message: S.selfExclusionConfirmBody(days),
      confirmLabel: S.confirm,
      destructive: true,
    );
    if (!confirmed || !context.mounted) return;

    final pin = await showPinDialog(context, title: S.selfExclusion);
    if (pin == null || !context.mounted) return;
    try {
      final updated = await context
          .read<LotteryApi>()
          .selfExclude(days: days, pin: pin);
      if (!context.mounted) return;
      context.read<AuthState>().updateUser(updated);
      showSnack(context, S.selfExclusionDone);
    } on ApiException catch (e) {
      if (context.mounted) showError(context, e);
    }
  }
}

/// Wraps the dialog result so "no cap" (null) differs from "cancelled".
class _CapChoice {
  const _CapChoice(this.value);

  final int? value;
}

class _DailyCapDialog extends StatefulWidget {
  const _DailyCapDialog({this.initial});

  final int? initial;

  @override
  State<_DailyCapDialog> createState() => _DailyCapDialogState();
}

class _DailyCapDialogState extends State<_DailyCapDialog> {
  late final _controller = TextEditingController(
    text: widget.initial == null ? '' : '${widget.initial}',
  );
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      Navigator.of(context).pop(const _CapChoice(null));
      return;
    }
    final v = parseAmount(text);
    if (v == null) {
      setState(() => _error = S.amountInvalid);
      return;
    }
    Navigator.of(context).pop(_CapChoice(v));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text(S.dailyCap),
      content: TextField(
        controller: _controller,
        autofocus: true,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(fontSize: 20, fontFeatures: tabular),
        decoration: InputDecoration(
          suffixText: S.kip,
          helperText: S.dailyCapHint,
          errorText: _error,
        ),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text(S.cancel),
        ),
        FilledButton(onPressed: _submit, child: const Text(S.next)),
      ],
    );
  }
}
