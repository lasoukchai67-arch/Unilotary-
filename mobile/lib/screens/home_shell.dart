import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/strings.dart';
import '../state/app_data.dart';
import '../state/events.dart';
import 'buy/buy_screen.dart';
import 'home/home_screen.dart';
import 'profile/notifications_screen.dart';
import 'profile/profile_screen.dart';
import 'results/results_screen.dart';
import 'tickets/tickets_screen.dart';
import 'wallet/wallet_screen.dart';

/// Signed-in shell: app bar (notifications, profile) + bottom navigation.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  /// Tabs are built the first time they are opened, then kept alive.
  final Set<int> _visited = {ShellTabs.home};

  static const _titles = [
    S.appName,
    S.buyTitle,
    S.ticketsTitle,
    S.resultsTitle,
    S.walletTitle,
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<WalletState>().refresh();
      context.read<DrawState>().refresh();
      context.read<NotificationState>().refresh();
    });
  }

  Widget _tab(int index) {
    if (!_visited.contains(index)) return const SizedBox.shrink();
    return switch (index) {
      ShellTabs.home => const HomeScreen(),
      ShellTabs.buy => const BuyScreen(),
      ShellTabs.tickets => const TicketsScreen(),
      ShellTabs.results => const ResultsScreen(),
      _ => const WalletScreen(),
    };
  }

  @override
  Widget build(BuildContext context) {
    final index = context.watch<ShellTabs>().value;
    _visited.add(index);
    final unread = context.watch<NotificationState>().unread;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[index]),
        actions: [
          IconButton(
            tooltip: unread > 0 ? '${S.notifications} ($unread)' : S.notifications,
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const NotificationsScreen(),
              ),
            ),
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text(unread > 99 ? '99+' : '$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
          ),
          IconButton(
            key: const ValueKey('open-profile'),
            tooltip: S.profile,
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const ProfileScreen()),
            ),
            icon: const Icon(Icons.account_circle_outlined),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: IndexedStack(
        index: index,
        children: [for (var i = 0; i < _titles.length; i++) _tab(i)],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: context.read<ShellTabs>().go,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: S.navHome,
          ),
          NavigationDestination(
            icon: Icon(Icons.dialpad_outlined),
            selectedIcon: Icon(Icons.dialpad_rounded),
            label: S.navBuy,
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long_rounded),
            label: S.navTickets,
          ),
          NavigationDestination(
            icon: Icon(Icons.fact_check_outlined),
            selectedIcon: Icon(Icons.fact_check_rounded),
            label: S.navResults,
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet_rounded),
            label: S.navWallet,
          ),
        ],
      ),
    );
  }
}
