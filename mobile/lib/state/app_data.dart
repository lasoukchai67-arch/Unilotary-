import 'package:flutter/foundation.dart';

import '../api/api_exception.dart';
import '../api/lottery_api.dart';
import '../models/models.dart';

/// Wallet balance shown on several screens.
class WalletState extends ChangeNotifier {
  WalletState(this.api);

  final LotteryApi api;

  WalletBalance? _wallet;
  ApiException? _error;
  bool _loading = false;

  WalletBalance? get wallet => _wallet;
  ApiException? get error => _error;
  bool get loading => _loading;

  Future<void> refresh() async {
    _loading = true;
    notifyListeners();
    try {
      _wallet = await api.wallet();
      _error = null;
    } on ApiException catch (e) {
      _error = e;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Updates the balance from a purchase response without a round trip.
  void setBalance(int balance) {
    _wallet = WalletBalance(balance: balance, held: _wallet?.held ?? 0);
    notifyListeners();
  }

  void reset() {
    _wallet = null;
    _error = null;
    notifyListeners();
  }
}

/// Current draw, latest result and the server clock offset.
class DrawState extends ChangeNotifier {
  DrawState(this.api, {DateTime Function()? clock})
      : _clock = clock ?? DateTime.now;

  final LotteryApi api;
  final DateTime Function() _clock;

  Draw? _current;
  Draw? _lastResult;
  Duration _offset = Duration.zero;
  ApiException? _error;
  bool _loading = false;
  bool _loaded = false;

  Draw? get current => _current;
  Draw? get lastResult => _lastResult;
  ApiException? get error => _error;
  bool get loading => _loading;
  bool get loaded => _loaded;

  /// `serverTime - localTime` measured when the draw was fetched.
  Duration get serverOffset => _offset;

  /// Best estimate of the server's current time.
  DateTime get serverNow => _clock().add(_offset);

  Future<void> refresh() async {
    _loading = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        api.currentDraw(),
        api.draws(status: DrawStatus.resulted, limit: 1),
      ]);
      final current = results[0] as Draw?;
      final resulted = results[1] as List<Draw>;
      _current = current;
      _lastResult = resulted.isEmpty ? null : resulted.first;
      final serverTime = current?.serverTime ?? _lastResult?.serverTime;
      if (serverTime != null) _offset = serverTime.difference(_clock());
      _error = null;
      _loaded = true;
    } on ApiException catch (e) {
      _error = e;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}

/// Unread notification count for the app-bar badge.
class NotificationState extends ChangeNotifier {
  NotificationState(this.api);

  final LotteryApi api;
  int _unread = 0;

  int get unread => _unread;

  Future<void> refresh() async {
    try {
      final page = await api.notifications(limit: 1);
      setUnread(page.unread);
    } on ApiException {
      // The badge is not critical.
    }
  }

  void setUnread(int value) {
    if (value == _unread) return;
    _unread = value < 0 ? 0 : value;
    notifyListeners();
  }

  void reset() => setUnread(0);
}
