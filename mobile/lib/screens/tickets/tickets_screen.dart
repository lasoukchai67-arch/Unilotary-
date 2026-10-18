import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../state/events.dart';
import '../../widgets/paged_list.dart';
import '../../widgets/ticket_tile.dart';
import 'ticket_detail_screen.dart';

/// The user's tickets, newest first, with infinite scroll.
class TicketsScreen extends StatefulWidget {
  const TicketsScreen({super.key});

  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends State<TicketsScreen> {
  final _listKey = GlobalKey<PagedListViewState<Ticket>>();
  late final TicketEvents _events;

  @override
  void initState() {
    super.initState();
    _events = context.read<TicketEvents>()..addListener(_reload);
  }

  @override
  void dispose() {
    _events.removeListener(_reload);
    super.dispose();
  }

  void _reload() => _listKey.currentState?.reload();

  @override
  Widget build(BuildContext context) {
    final api = context.read<LotteryApi>();
    return PagedListView<Ticket>(
      key: _listKey,
      fetch: (before) => api.tickets(limit: 20, before: before),
      emptyText: S.noTickets,
      itemBuilder: (context, t) => TicketTile(
        ticket: t,
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => TicketDetailScreen(ticket: t)),
        ),
      ),
    );
  }
}
