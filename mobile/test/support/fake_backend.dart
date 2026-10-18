import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lao_lottery/api/api_client.dart';
import 'package:lao_lottery/api/lottery_api.dart';
import 'package:lao_lottery/api/token_store.dart';

const baseUrl = 'http://api.test/v1';

/// A canned response; `body` is JSON-encoded unless it is already a String.
class Reply {
  const Reply(this.status, [this.body]);

  final int status;
  final Object? body;

  static Reply error(int status, String code, String message,
          [Object? details]) =>
      Reply(status, {
        'error': code,
        'message': message,
        'details': ?details,
      });
}

typedef Handler = FutureOr<Reply> Function(http.Request request);

/// Route table on top of `package:http`'s [MockClient]. Routes are
/// `"METHOD /path"` (path without the `/v1` prefix and without the query).
class FakeBackend {
  final Map<String, Handler> routes = {};
  final List<http.Request> requests = [];

  void on(String route, Handler handler) => routes[route] = handler;

  void reply(String route, Reply reply) => routes[route] = (_) => reply;

  /// Requests made to `METHOD /path`.
  List<http.Request> calls(String route) =>
      requests.where((r) => _key(r) == route).toList();

  static String _key(http.Request r) {
    final path = r.url.path.replaceFirst('/v1', '');
    return '${r.method} $path';
  }

  late final MockClient client = MockClient((request) async {
    requests.add(request);
    final handler = routes[_key(request)];
    if (handler == null) {
      return http.Response(
        jsonEncode({'error': 'NOT_FOUND', 'message': 'no route ${_key(request)}'}),
        404,
        headers: {'content-type': 'application/json'},
      );
    }
    final reply = await handler(request);
    final body = reply.body;
    return http.Response.bytes(
      body == null
          ? const []
          : utf8.encode(body is String ? body : jsonEncode(body)),
      reply.status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  });

  ({LotteryApi api, ApiClient client, MemoryTokenStore store}) build({
    AuthTokens? tokens,
  }) {
    final store = MemoryTokenStore(tokens);
    final apiClient = ApiClient(
      baseUrl: baseUrl,
      tokenStore: store,
      httpClient: client,
    );
    return (api: LotteryApi(apiClient), client: apiClient, store: store);
  }
}

Map<String, dynamic> jsonBody(http.Request r) =>
    jsonDecode(r.body) as Map<String, dynamic>;

// ---------------------------------------------------------------- fixtures
// Shaped exactly like docs/API.md.

Map<String, dynamic> userJson({
  int id = 1,
  String phone = '02055551234',
  String? fullName = 'ສົມໃຈ',
  String role = 'customer',
  String kyc = 'verified',
  bool pinSet = true,
  int balance = 250000,
  int held = 0,
  int? dailySpendCap = 200000,
  String? selfExcludedUntil,
}) =>
    {
      'id': id,
      'phone': phone,
      'fullName': fullName,
      'role': role,
      'kyc': kyc,
      'kycNote': null,
      'status': 'active',
      'pinSet': pinSet,
      'dailySpendCap': dailySpendCap,
      'selfExcludedUntil': selfExcludedUntil,
      'balance': balance,
      'held': held,
      'commissionBp': 0,
      'createdAt': '2026-10-01T03:00:00Z',
    };

Map<String, dynamic> authJson({
  String access = 'access-1',
  String refresh = 'refresh-1',
  Map<String, dynamic>? user,
}) =>
    {
      'accessToken': access,
      'refreshToken': refresh,
      'expiresInSec': 900,
      'user': user ?? userJson(),
    };

List<Map<String, dynamic>> rulesJson() => [
      // Deliberately unsorted: the client sorts by digits.
      {'digits': 3, 'payoutRate': 400, 'minAmount': 1000, 'maxPerLine': 50000},
      {'digits': 2, 'payoutRate': 60, 'minAmount': 1000, 'maxPerLine': 100000},
      {'digits': 4, 'payoutRate': 2000, 'minAmount': 1000, 'maxPerLine': 20000},
      {'digits': 5, 'payoutRate': 10000, 'minAmount': 1000, 'maxPerLine': 10000},
      {'digits': 6, 'payoutRate': 50000, 'minAmount': 1000, 'maxPerLine': 5000},
    ];

Map<String, dynamic> drawJson({
  int id = 7,
  String drawNo = '0123',
  String status = 'open',
  String? resultNumber,
  String salesCloseAt = '2099-10-19T06:00:00Z',
  String serverTime = '2026-10-18T05:00:00Z',
}) =>
    {
      'id': id,
      'drawNo': drawNo,
      'drawDate': '2026-10-19',
      'salesOpenAt': '2026-10-15T01:00:00Z',
      'salesCloseAt': salesCloseAt,
      'status': status,
      'resultNumber': resultNumber,
      'resultedAt': resultNumber == null ? null : '2026-10-12T13:00:00Z',
      'rules': rulesJson(),
      'serverTime': serverTime,
    };

Map<String, dynamic> ticketJson({
  int id = 9,
  String status = 'active',
  List<Map<String, dynamic>>? lines,
  int totalAmount = 30000,
}) =>
    {
      'id': id,
      'ticketNo': 'LT-0123-${id.toString().padLeft(6, '0')}',
      'verifyCode': 'A7F392KD',
      'drawId': 7,
      'drawNo': '0123',
      'status': status,
      'totalAmount': totalAmount,
      'totalWin': 0,
      'createdAt': '2026-10-18T04:00:00Z',
      'buyerPhone': null,
      'lines': lines ??
          [
            {
              'number': '27',
              'digits': 2,
              'amount': 10000,
              'payoutRate': 60,
              'winAmount': 0,
            },
            {
              'number': '482',
              'digits': 3,
              'amount': 20000,
              'payoutRate': 400,
              'winAmount': 0,
            },
          ],
    };
