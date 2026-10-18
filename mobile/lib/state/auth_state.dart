import 'package:flutter/foundation.dart';

import '../api/api_exception.dart';
import '../api/lottery_api.dart';
import '../models/models.dart';

enum AuthStatus {
  /// Restoring a saved session.
  loading,

  /// A saved session exists but `/me` could not be loaded (offline).
  error,
  signedOut,

  /// Signed in but no PIN yet: the PIN must be set before anything else.
  needsPin,
  signedIn,
}

class AuthState extends ChangeNotifier {
  AuthState(this.api) {
    api.client.onSessionExpired = _onSessionExpired;
    api.client.onUserRefreshed = _setUser;
  }

  final LotteryApi api;

  AuthStatus _status = AuthStatus.loading;
  User? _user;
  ApiException? _error;
  bool _sessionExpired = false;

  AuthStatus get status => _status;
  User? get user => _user;
  ApiException? get error => _error;

  /// True once after the server ended the session; the UI shows a notice
  /// and calls [acknowledgeSessionExpired].
  bool get sessionExpired => _sessionExpired;

  Future<void> init() async {
    _status = AuthStatus.loading;
    notifyListeners();
    final hasSession = await api.client.restoreSession();
    if (!hasSession) {
      _status = AuthStatus.signedOut;
      notifyListeners();
      return;
    }
    await refreshUser();
  }

  /// Reloads `/me`. Used at start-up and after profile changes.
  Future<void> refreshUser() async {
    try {
      _error = null;
      _setUser(await api.me());
    } on ApiException catch (e) {
      if (!api.client.hasSession) {
        _user = null;
        _status = AuthStatus.signedOut;
      } else if (_user == null) {
        _error = e;
        _status = AuthStatus.error;
      }
      notifyListeners();
      if (_status == AuthStatus.signedIn) rethrow;
    }
  }

  Future<OtpRequestResult> requestOtp(String phone) => api.requestOtp(phone);

  Future<void> verifyOtp(String phone, String code) async {
    final result = await api.verifyOtp(phone, code);
    _sessionExpired = false;
    _setUser(result.user);
  }

  /// First-time PIN (no current PIN).
  Future<void> setInitialPin(String pin) async {
    await api.setPin(pin);
    try {
      _setUser(await api.me());
    } on ApiException {
      // The PIN is set; continue even if the profile reload failed.
      if (_user != null) {
        _status = AuthStatus.signedIn;
        notifyListeners();
      }
    }
  }

  Future<void> changePin({required String currentPin, required String pin}) =>
      api.setPin(pin, currentPin: currentPin);

  /// Replaces the cached user after a call that returned a fresh `User`.
  void updateUser(User user) => _setUser(user);

  Future<void> logout() async {
    await api.logout();
    _user = null;
    _status = AuthStatus.signedOut;
    notifyListeners();
  }

  void acknowledgeSessionExpired() => _sessionExpired = false;

  void _setUser(User user) {
    _user = user;
    _status = user.pinSet ? AuthStatus.signedIn : AuthStatus.needsPin;
    notifyListeners();
  }

  void _onSessionExpired() {
    final wasSignedIn = _user != null;
    _user = null;
    _status = AuthStatus.signedOut;
    _sessionExpired = wasSignedIn;
    notifyListeners();
  }
}
