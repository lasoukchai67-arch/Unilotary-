import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../models/json.dart';
import '../models/misc.dart';
import '../models/user.dart';
import 'api_exception.dart';
import 'token_store.dart';

/// A file part for multipart uploads.
class UploadFile {
  const UploadFile({
    required this.field,
    required this.bytes,
    required this.filename,
    required this.contentType,
  });

  final String field;
  final List<int> bytes;
  final String filename;

  /// e.g. `image/jpeg`.
  final String contentType;
}

/// Raw decoded response.
class ApiResponse {
  const ApiResponse(this.statusCode, this.body);

  final int statusCode;

  /// Decoded JSON (`Map`/`List`/...), the raw text if it was not JSON, or
  /// null for an empty body (e.g. 204).
  final Object? body;
}

/// HTTP transport for the v1 API.
///
/// * Adds `Authorization: Bearer <accessToken>` to authenticated calls.
/// * On a 401 `UNAUTHORIZED` it refreshes the access token once and retries
///   the request. Concurrent 401s share a single `/auth/refresh` call
///   (single-flight), which matters because refresh tokens are rotated on
///   every use.
/// * If the refresh token is rejected the session is cleared and
///   [onSessionExpired] is called. A network failure during refresh keeps
///   the session so the user can simply retry.
/// * Other 401 codes (`PIN_REQUIRED`, `PIN_INVALID`) are business errors and
///   are never retried, so a wrong PIN is not counted twice.
class ApiClient {
  ApiClient({
    required String baseUrl,
    required TokenStore tokenStore,
    http.Client? httpClient,
    this.timeout = const Duration(seconds: 20),
  })  : baseUrl = baseUrl.endsWith('/')
            ? baseUrl.substring(0, baseUrl.length - 1)
            : baseUrl,
        _store = tokenStore,
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final Duration timeout;
  final TokenStore _store;
  final http.Client _http;

  AuthTokens? _tokens;
  Future<bool>? _refreshing;

  /// Called after the session was cleared because it could not be renewed.
  void Function()? onSessionExpired;

  /// Called with the user returned by a successful token refresh.
  void Function(User user)? onUserRefreshed;

  AuthTokens? get tokens => _tokens;
  bool get hasSession => _tokens != null;

  /// Loads persisted tokens. Returns whether a session exists.
  Future<bool> restoreSession() async {
    _tokens = await _store.read();
    return _tokens != null;
  }

  Future<void> setTokens(AuthTokens tokens) async {
    _tokens = tokens;
    await _store.write(tokens);
  }

  /// Forgets the session locally (does not call the server).
  Future<void> clearSession() async {
    _tokens = null;
    await _store.clear();
  }

  Uri uri(String path, [Map<String, Object?>? query]) {
    final params = <String, String>{
      for (final e in (query ?? const <String, Object?>{}).entries)
        if (e.value != null) e.key: '${e.value}',
    };
    final u = Uri.parse('$baseUrl$path');
    return params.isEmpty ? u : u.replace(queryParameters: params);
  }

  Future<Object?> get(
    String path, {
    Map<String, Object?>? query,
    bool auth = true,
  }) =>
      send('GET', path, query: query, auth: auth);

  Future<Object?> post(
    String path, {
    Object? body,
    Map<String, String>? headers,
    bool auth = true,
  }) =>
      send('POST', path, body: body, headers: headers, auth: auth);

  Future<Object?> patch(
    String path, {
    Object? body,
    Map<String, String>? headers,
    bool auth = true,
  }) =>
      send('PATCH', path, body: body, headers: headers, auth: auth);

  /// Sends a JSON request and returns the decoded body. Throws
  /// [ApiException] for HTTP errors and transport failures.
  Future<Object?> send(
    String method,
    String path, {
    Object? body,
    Map<String, Object?>? query,
    Map<String, String>? headers,
    bool auth = true,
  }) async {
    final res = await _send(() {
      final req = http.Request(method, uri(path, query));
      if (body != null) {
        req.headers['Content-Type'] = 'application/json; charset=utf-8';
        req.body = jsonEncode(body);
      }
      if (headers != null) req.headers.addAll(headers);
      return req;
    }, auth: auth);
    return res.body;
  }

  /// Sends a `multipart/form-data` POST.
  Future<Object?> postMultipart(
    String path, {
    required Map<String, String> fields,
    required List<UploadFile> files,
    bool auth = true,
  }) async {
    final res = await _send(() {
      final req = http.MultipartRequest('POST', uri(path))
        ..fields.addAll(fields);
      for (final f in files) {
        req.files.add(
          http.MultipartFile.fromBytes(
            f.field,
            f.bytes,
            filename: f.filename,
            contentType: MediaType.parse(f.contentType),
          ),
        );
      }
      return req;
    }, auth: auth);
    return res.body;
  }

  /// Requests are built by [build] so they can be re-sent after a refresh
  /// (an `http.BaseRequest` can only be sent once).
  Future<ApiResponse> _send(
    http.BaseRequest Function() build, {
    required bool auth,
  }) async {
    final usedToken = auth ? _tokens?.accessToken : null;
    var res = await _execute(build(), usedToken);

    if (auth && _isExpiredToken(res)) {
      final current = _tokens?.accessToken;
      final alreadyRenewed = current != null && current != usedToken;
      if (!alreadyRenewed && !await _refreshSingleFlight()) {
        throw ApiException.fromResponse(res.statusCode, res.body);
      }
      res = await _execute(build(), _tokens?.accessToken);
      if (_isExpiredToken(res)) {
        // A freshly issued token was rejected too: give up on the session.
        await _expireSession();
      }
    }

    if (res.statusCode >= 400) {
      throw ApiException.fromResponse(res.statusCode, res.body);
    }
    return res;
  }

  bool _isExpiredToken(ApiResponse res) {
    if (res.statusCode != 401) return false;
    final body = res.body;
    if (body is Map && body['error'] is String) {
      return body['error'] == ErrorCode.unauthorized;
    }
    return true;
  }

  Future<bool> _refreshSingleFlight() async {
    final inFlight = _refreshing;
    if (inFlight != null) return inFlight;

    final completer = Completer<bool>();
    // Other callers may or may not await this; never report it unhandled.
    completer.future.ignore();
    _refreshing = completer.future;
    try {
      final ok = await _refresh();
      completer.complete(ok);
      return ok;
    } catch (e, st) {
      completer.completeError(e, st);
      rethrow;
    } finally {
      _refreshing = null;
    }
  }

  Future<bool> _refresh() async {
    final refreshToken = _tokens?.refreshToken;
    if (refreshToken == null) {
      await _expireSession();
      return false;
    }
    final req = http.Request('POST', uri('/auth/refresh'))
      ..headers['Content-Type'] = 'application/json; charset=utf-8'
      ..body = jsonEncode({'refreshToken': refreshToken});
    // A network error propagates and keeps the session.
    final res = await _execute(req, null);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      final AuthResult result;
      try {
        result = AuthResult.fromJson(asJson(res.body));
      } on FormatException {
        await _expireSession();
        return false;
      }
      await setTokens(
        AuthTokens(
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        ),
      );
      onUserRefreshed?.call(result.user);
      return true;
    }
    if (res.statusCode >= 500) {
      // Server trouble, not a verdict on the token: keep the session.
      throw ApiException.fromResponse(res.statusCode, res.body);
    }
    await _expireSession();
    return false;
  }

  Future<void> _expireSession() async {
    final hadSession = _tokens != null;
    await clearSession();
    if (hadSession) onSessionExpired?.call();
  }

  Future<ApiResponse> _execute(http.BaseRequest req, String? token) async {
    req.headers['Accept'] = 'application/json';
    if (token != null) req.headers['Authorization'] = 'Bearer $token';

    final http.Response res;
    try {
      final streamed = await _http.send(req).timeout(timeout);
      res = await http.Response.fromStream(streamed).timeout(timeout);
    } on Exception catch (e) {
      throw ApiException.network(e);
    }

    Object? body;
    if (res.bodyBytes.isNotEmpty) {
      final text = utf8.decode(res.bodyBytes, allowMalformed: true);
      try {
        body = jsonDecode(text);
      } on FormatException {
        body = text;
      }
    }
    return ApiResponse(res.statusCode, body);
  }

  void close() => _http.close();
}
