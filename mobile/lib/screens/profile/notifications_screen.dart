import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../state/app_data.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../widgets/common.dart';
import '../../widgets/paged_list.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  /// Read locally since the list was loaded.
  final Set<int> _read = {};
  bool _allRead = false;

  bool _isRead(AppNotification n) => _allRead || n.isRead || _read.contains(n.id);

  Future<CursorPage<AppNotification>> _fetch(int? before) async {
    final page = await context
        .read<LotteryApi>()
        .notifications(limit: 20, before: before);
    if (mounted && before == null) {
      context.read<NotificationState>().setUnread(page.unread);
    }
    return page;
  }

  Future<void> _markRead(AppNotification n) async {
    if (_isRead(n)) return;
    setState(() => _read.add(n.id));
    final badge = context.read<NotificationState>();
    badge.setUnread(badge.unread - 1);
    try {
      await context.read<LotteryApi>().markNotificationRead(n.id);
    } on ApiException {
      // Not critical; the server state is reloaded next time.
    }
  }

  Future<void> _markAll() async {
    try {
      await context.read<LotteryApi>().markAllNotificationsRead();
      if (!mounted) return;
      setState(() => _allRead = true);
      context.read<NotificationState>().setUnread(0);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(S.notifications),
        actions: [
          IconButton(
            tooltip: S.markAllRead,
            onPressed: _markAll,
            icon: const Icon(Icons.done_all_rounded),
          ),
        ],
      ),
      body: PagedListView<AppNotification>(
        fetch: _fetch,
        emptyText: S.noNotifications,
        itemBuilder: (context, n) {
          final read = _isRead(n);
          return Card(
            color: read ? Brand.white : const Color(0xFFF2FBF7),
            child: ListTile(
              onTap: () => _markRead(n),
              leading: Icon(
                read
                    ? Icons.notifications_none_rounded
                    : Icons.notifications_active_rounded,
                color: read ? Brand.grey : Brand.midGreen,
                semanticLabel: read ? null : S.notifications,
              ),
              title: Text(
                n.title,
                style: TextStyle(
                  fontWeight: read ? FontWeight.w400 : FontWeight.w700,
                ),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (n.body.isNotEmpty) Text(n.body),
                  const SizedBox(height: 2),
                  Text(
                    formatDateTime(n.createdAt),
                    style: const TextStyle(color: Brand.grey, fontSize: 12),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
