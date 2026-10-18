import 'package:flutter/foundation.dart';

/// Bumped whenever the user's tickets change (purchase, agent sale) so lists
/// on other tabs reload.
class TicketEvents extends ValueNotifier<int> {
  TicketEvents() : super(0);

  void changed() => value++;
}

/// Selected bottom-navigation tab.
class ShellTabs extends ValueNotifier<int> {
  ShellTabs() : super(0);

  static const home = 0;
  static const buy = 1;
  static const tickets = 2;
  static const results = 3;
  static const wallet = 4;

  void go(int tab) => value = tab;
}
