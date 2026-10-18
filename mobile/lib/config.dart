import 'package:flutter/foundation.dart';

/// Build-time configuration.
///
/// The API base URL is passed with
/// `--dart-define=API_BASE_URL=https://api.example.la/v1`.
/// Without it, debug defaults point at a backend on the developer machine:
/// `http://10.0.2.2:3000/v1` (the host as seen from the Android emulator) or
/// `http://localhost:3000/v1` on the web.
abstract final class AppConfig {
  static const String _apiBaseUrlDefine = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl {
    final value = _apiBaseUrlDefine.isNotEmpty
        ? _apiBaseUrlDefine
        : (kIsWeb ? 'http://localhost:3000/v1' : 'http://10.0.2.2:3000/v1');
    return value.endsWith('/') ? value.substring(0, value.length - 1) : value;
  }

  /// Development helpers (OTP code banner, simulated deposits) are only shown
  /// in debug builds.
  static const bool devTools = kDebugMode;
}
