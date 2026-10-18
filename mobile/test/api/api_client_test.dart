import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:lao_lottery/api/api_exception.dart';
import 'package:lao_lottery/api/token_store.dart';
import 'package:lao_lottery/models/models.dart';

import '../support/fake_backend.dart';

const _tokens = AuthTokens(accessToken: 'access-1', refreshToken: 'refresh-1');

void main() {
  late FakeBackend backend;

  setUp(() => backend = FakeBackend());

  group('auth', () {
    test('requestOtp posts the phone without auth and reads devCode', () async {
      backend.reply(
        'POST /auth/otp/request',
        const Reply(200, {'expiresInSec': 300, 'devCode': '123456'}),
      );
      final (:api, client: _, store: _) = backend.build();

      final result = await api.requestOtp('02055551234');

      expect(result.expiresInSec, 300);
      expect(result.devCode, '123456');
      final req = backend.calls('POST /auth/otp/request').single;
      expect(req.url.toString(), '$baseUrl/auth/otp/request');
      expect(jsonBody(req), {'phone': '02055551234'});
      expect(req.headers['Authorization'], isNull);
      expect(req.headers['content-type'], startsWith('application/json'));
    });

    test('devCode is optional', () async {
      backend.reply(
        'POST /auth/otp/request',
        const Reply(200, {'expiresInSec': 300}),
      );
      final (:api, client: _, store: _) = backend.build();
      expect((await api.requestOtp('0301234567')).devCode, isNull);
    });

    test('verifyOtp stores both tokens and parses the user', () async {
      backend.reply(
        'POST /auth/otp/verify',
        Reply(200, authJson(user: userJson(pinSet: false, kyc: 'unsubmitted'))),
      );
      final (:api, :client, :store) = backend.build();

      final result = await api.verifyOtp('02055551234', '123456');

      expect(jsonBody(backend.requests.single), {
        'phone': '02055551234',
        'code': '123456',
      });
      expect(result.user.pinSet, isFalse);
      expect(result.user.kyc, KycStatus.unsubmitted);
      expect(result.user.balance, 250000);
      expect(result.user.dailySpendCap, 200000);
      expect(client.tokens?.accessToken, 'access-1');
      expect(store.tokens?.refreshToken, 'refresh-1');
    });

    test('a wrong code surfaces the server error code and Lao message',
        () async {
      backend.reply(
        'POST /auth/otp/verify',
        Reply.error(400, 'VALIDATION', 'ລະຫັດບໍ່ຖືກຕ້ອງ'),
      );
      final (:api, :client, store: _) = backend.build();

      await expectLater(
        api.verifyOtp('02055551234', '000000'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.code, 'code', ErrorCode.validation)
              .having((e) => e.message, 'message', 'ລະຫັດບໍ່ຖືກຕ້ອງ')
              .having((e) => e.statusCode, 'status', 400),
        ),
      );
      expect(client.hasSession, isFalse);
    });

    test('logout revokes the refresh token and clears the session', () async {
      backend.reply('POST /auth/logout', const Reply(204));
      final (:api, :client, :store) = backend.build(tokens: _tokens);
      await client.restoreSession();

      await api.logout();

      final req = backend.calls('POST /auth/logout').single;
      expect(jsonBody(req), {'refreshToken': 'refresh-1'});
      expect(client.hasSession, isFalse);
      expect(store.tokens, isNull);
    });

    test('logout clears the session even when the server call fails',
        () async {
      backend.on('POST /auth/logout', (_) => throw http.ClientException('x'));
      final (:api, :client, :store) = backend.build(tokens: _tokens);
      await client.restoreSession();

      await api.logout();

      expect(client.hasSession, isFalse);
      expect(store.tokens, isNull);
    });
  });

  group('token refresh', () {
    test('adds the bearer token to authenticated calls', () async {
      backend.reply('GET /me', Reply(200, userJson()));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final me = await api.me();

      expect(me.phone, '02055551234');
      expect(
        backend.requests.single.headers['Authorization'],
        'Bearer access-1',
      );
    });

    test('on 401 UNAUTHORIZED refreshes once, rotates tokens and retries',
        () async {
      backend.on('GET /me', (r) {
        return r.headers['Authorization'] == 'Bearer access-2'
            ? Reply(200, userJson())
            : Reply.error(401, 'UNAUTHORIZED', 'ໝົດອາຍຸ');
      });
      backend.reply(
        'POST /auth/refresh',
        Reply(200, authJson(access: 'access-2', refresh: 'refresh-2')),
      );
      final (:api, :client, :store) = backend.build(tokens: _tokens);
      await client.restoreSession();
      User? refreshedUser;
      client.onUserRefreshed = (u) => refreshedUser = u;

      final me = await api.me();

      expect(me.id, 1);
      expect(backend.calls('GET /me'), hasLength(2));
      final refresh = backend.calls('POST /auth/refresh').single;
      expect(jsonBody(refresh), {'refreshToken': 'refresh-1'});
      expect(refresh.headers['Authorization'], isNull);
      expect(store.tokens?.accessToken, 'access-2');
      expect(store.tokens?.refreshToken, 'refresh-2');
      expect(refreshedUser?.id, 1);
    });

    test('concurrent 401s share a single refresh call (single-flight)',
        () async {
      final refreshGate = Completer<void>();
      backend.on('GET /me', (r) {
        return r.headers['Authorization'] == 'Bearer access-2'
            ? Reply(200, userJson())
            : Reply.error(401, 'UNAUTHORIZED', 'ໝົດອາຍຸ');
      });
      backend.on('GET /wallet', (r) {
        return r.headers['Authorization'] == 'Bearer access-2'
            ? const Reply(200, {'balance': 250000, 'held': 50000})
            : Reply.error(401, 'UNAUTHORIZED', 'ໝົດອາຍຸ');
      });
      backend.on('POST /auth/refresh', (r) async {
        await refreshGate.future;
        return Reply(200, authJson(access: 'access-2', refresh: 'refresh-2'));
      });
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final me = api.me();
      final wallet = api.wallet();
      final wallet2 = api.wallet();
      await Future<void>.delayed(Duration.zero);
      refreshGate.complete();

      expect((await me).id, 1);
      expect((await wallet).held, 50000);
      expect((await wallet2).balance, 250000);
      expect(backend.calls('POST /auth/refresh'), hasLength(1));
    });

    test('a rejected refresh token ends the session', () async {
      backend.reply('GET /me', Reply.error(401, 'UNAUTHORIZED', 'ໝົດອາຍຸ'));
      backend.reply(
        'POST /auth/refresh',
        Reply.error(401, 'UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່'),
      );
      final (:api, :client, :store) = backend.build(tokens: _tokens);
      await client.restoreSession();
      var expired = 0;
      client.onSessionExpired = () => expired++;

      await expectLater(
        api.me(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ErrorCode.unauthorized,
          ),
        ),
      );
      expect(expired, 1);
      expect(client.hasSession, isFalse);
      expect(store.tokens, isNull);
      expect(backend.calls('GET /me'), hasLength(1));
    });

    test('PIN_INVALID (also HTTP 401) is not treated as an expired token',
        () async {
      backend.reply(
        'POST /wallet/withdrawals',
        Reply.error(401, 'PIN_INVALID', 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ'),
      );
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      await expectLater(
        api.withdraw(
          amount: 50000,
          bankName: 'BCEL',
          accountNo: '0101000123',
          accountName: 'SOMCHAI',
          pin: '111111',
        ),
        throwsA(
          isA<ApiException>()
              .having((e) => e.code, 'code', ErrorCode.pinInvalid)
              .having((e) => e.message, 'message', 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ'),
        ),
      );
      expect(backend.calls('POST /auth/refresh'), isEmpty);
      expect(backend.calls('POST /wallet/withdrawals'), hasLength(1));
      expect(client.hasSession, isTrue);
    });

    test('a network error during refresh keeps the session', () async {
      backend.reply('GET /me', Reply.error(401, 'UNAUTHORIZED', 'ໝົດອາຍຸ'));
      backend.on(
        'POST /auth/refresh',
        (_) => throw http.ClientException('offline'),
      );
      final (:api, :client, :store) = backend.build(tokens: _tokens);
      await client.restoreSession();
      var expired = 0;
      client.onSessionExpired = () => expired++;

      await expectLater(
        api.me(),
        throwsA(isA<ApiException>().having((e) => e.isNetwork, 'network', true)),
      );
      expect(expired, 0);
      expect(store.tokens?.refreshToken, 'refresh-1');
    });
  });

  group('errors', () {
    test('transport failures become NETWORK errors (retryable)', () async {
      backend.on('GET /wallet', (_) => throw http.ClientException('offline'));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      try {
        await api.wallet();
        fail('expected an exception');
      } on ApiException catch (e) {
        expect(e.code, ErrorCode.network);
        expect(e.isRetryable, isTrue);
        expect(e.message, isNotEmpty);
      }
    });

    test('a non-JSON error body still yields an ApiException', () async {
      backend.reply('GET /wallet', const Reply(502, '<html>Bad gateway</html>'));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      await expectLater(
        api.wallet(),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'status', 502)
              .having((e) => e.isRetryable, 'retryable', true),
        ),
      );
    });

    test('a body that breaks the contract is reported as BAD_RESPONSE',
        () async {
      backend.reply('GET /wallet', const Reply(200, {'balance': 'lots'}));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      await expectLater(
        api.wallet(),
        throwsA(
          isA<ApiException>().having((e) => e.code, 'code', ErrorCode.badResponse),
        ),
      );
    });
  });

  group('draws', () {
    test('current draw is public, sorted rules, server time parsed', () async {
      backend.reply('GET /draws/current', Reply(200, drawJson()));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final draw = (await api.currentDraw())!;

      expect(backend.requests.single.headers['Authorization'], isNull);
      expect(draw.id, 7);
      expect(draw.drawNo, '0123');
      expect(draw.status, DrawStatus.open);
      expect(draw.rules.map((r) => r.digits), [2, 3, 4, 5, 6]);
      expect(draw.ruleFor(2)?.payoutRate, 60);
      expect(draw.serverTime, DateTime.utc(2026, 10, 18, 5));
      expect(draw.salesCloseAt.isUtc, isTrue);
    });

    test('current draw 404 means no draw', () async {
      backend.reply(
        'GET /draws/current',
        Reply.error(404, 'NOT_FOUND', 'ບໍ່ພົບງວດ'),
      );
      final (:api, client: _, store: _) = backend.build();
      expect(await api.currentDraw(), isNull);
    });

    test('draws list sends status and limit', () async {
      backend.reply(
        'GET /draws',
        Reply(200, {
          'items': [drawJson(status: 'resulted', resultNumber: '482175')],
        }),
      );
      final (:api, client: _, store: _) = backend.build();

      final draws = await api.draws(status: DrawStatus.resulted, limit: 1);

      expect(backend.requests.single.url.queryParameters, {
        'status': 'resulted',
        'limit': '1',
      });
      expect(draws.single.resultNumber, '482175');
    });
  });

  group('tickets', () {
    test('purchase sends Idempotency-Key and lines; parses the response',
        () async {
      backend.reply(
        'POST /draws/7/tickets',
        Reply(201, {
          ...ticketJson(),
          'balanceAfter': 220000,
          'replayed': false,
        }),
      );
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final result = await api.purchase(
        drawId: 7,
        lines: const [
          PurchaseLine(number: '27', amount: 10000),
          PurchaseLine(number: '482', amount: 20000),
        ],
        idempotencyKey: '4f9c2a1e-0d5b-4c1a-9a49-7f5b8c2d1e00',
      );

      final req = backend.requests.single;
      expect(req.headers['Idempotency-Key'], '4f9c2a1e-0d5b-4c1a-9a49-7f5b8c2d1e00');
      expect(req.headers['Authorization'], 'Bearer access-1');
      expect(jsonBody(req), {
        'lines': [
          {'number': '27', 'amount': 10000},
          {'number': '482', 'amount': 20000},
        ],
      });
      expect(result.balanceAfter, 220000);
      expect(result.replayed, isFalse);
      expect(result.ticket.ticketNo, 'LT-0123-000009');
      expect(result.ticket.qrPayload, 'LT-0123-000009|A7F392KD');
      expect(result.ticket.lines.first.payoutRate, 60);
    });

    test('NUMBER_LIMIT details are exposed per number', () async {
      backend.reply(
        'POST /draws/7/tickets',
        Reply.error(409, 'NUMBER_LIMIT', 'ບາງເລກເຕັມແລ້ວ', [
          {'number': '27', 'reason': 'full', 'remaining': 5000},
          {'number': '99', 'reason': 'closed', 'remaining': 0},
          {'number': '1234567', 'reason': 'norule', 'remaining': null},
        ]),
      );
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      try {
        await api.purchase(
          drawId: 7,
          lines: const [PurchaseLine(number: '27', amount: 10000)],
          idempotencyKey: 'key-12345678',
        );
        fail('expected NUMBER_LIMIT');
      } on ApiException catch (e) {
        expect(e.code, ErrorCode.numberLimit);
        expect(e.isRetryable, isFalse);
        final limits = e.numberLimits;
        expect(limits.map((l) => l.number), ['27', '99', '1234567']);
        expect(limits[0].reason, NumberLimitReason.full);
        expect(limits[0].remaining, 5000);
        expect(limits[1].reason, NumberLimitReason.closed);
        expect(limits[2].reason, NumberLimitReason.norule);
        expect(limits[2].remaining, isNull);
      }
    });

    test('ticket list uses limit/before and exposes nextBefore', () async {
      backend.on('GET /tickets', (r) {
        final before = r.url.queryParameters['before'];
        return before == null
            ? Reply(200, {
                'items': [ticketJson(id: 12), ticketJson(id: 11)],
                'nextBefore': 11,
              })
            : Reply(200, {
                'items': [ticketJson(id: 10)],
                'nextBefore': null,
              });
      });
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final first = await api.tickets(limit: 20);
      final second = await api.tickets(limit: 20, before: first.nextBefore);

      expect(backend.requests[0].url.queryParameters, {'limit': '20'});
      expect(backend.requests[1].url.queryParameters, {
        'limit': '20',
        'before': '11',
      });
      expect(first.items.map((t) => t.id), [12, 11]);
      expect(first.hasMore, isTrue);
      expect(second.items.single.id, 10);
      expect(second.hasMore, isFalse);
    });
  });

  group('me', () {
    test('first PIN omits currentPin; changing it sends currentPin', () async {
      backend.reply('POST /me/pin', const Reply(204));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      await api.setPin('482915');
      await api.setPin('719304', currentPin: '482915');

      expect(jsonBody(backend.requests[0]), {'pin': '482915'});
      expect(jsonBody(backend.requests[1]), {
        'pin': '719304',
        'currentPin': '482915',
      });
    });

    test('removing the daily cap sends an explicit null', () async {
      backend.reply('PATCH /me/settings', Reply(200, userJson(dailySpendCap: null)));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final user = await api.updateSettings(dailySpendCap: null, pin: '482915');

      final body = jsonBody(backend.requests.single);
      expect(body.containsKey('dailySpendCap'), isTrue);
      expect(body, {'dailySpendCap': null, 'pin': '482915'});
      expect(user.dailySpendCap, isNull);
    });

    test('self-exclusion posts days and PIN', () async {
      backend.reply(
        'POST /me/self-exclusion',
        Reply(200, userJson(selfExcludedUntil: '2026-11-17T00:00:00Z')),
      );
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final user = await api.selfExclude(days: 30, pin: '482915');

      expect(jsonBody(backend.requests.single), {'days': 30, 'pin': '482915'});
      expect(user.selfExcludedUntil, DateTime.utc(2026, 11, 17));
      expect(user.isSelfExcluded(DateTime.utc(2026, 10, 18)), isTrue);
    });

    test('KYC is a multipart upload with fields and a photo part', () async {
      backend.reply('POST /me/kyc', Reply(200, userJson(kyc: 'pending')));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final user = await api.submitKyc(
        fullName: 'ສົມໃຈ ໃຈດີ',
        birthDate: '1990-05-01',
        idCardNo: '01-123456',
        photoBytes: const [0xFF, 0xD8, 0xFF, 0xE0],
        photoFilename: 'id-card.jpg',
        photoContentType: 'image/jpeg',
      );

      final req = backend.requests.single;
      expect(req.headers['content-type'], startsWith('multipart/form-data'));
      expect(req.headers['Authorization'], 'Bearer access-1');
      final body = utf8.decode(req.bodyBytes, allowMalformed: true);
      expect(body, contains('name="fullName"'));
      expect(body, contains('ສົມໃຈ ໃຈດີ'));
      expect(body, contains('name="birthDate"'));
      expect(body, contains('1990-05-01'));
      expect(body, contains('name="idCardNo"'));
      expect(body, contains('name="photo"; filename="id-card.jpg"'));
      expect(body.toLowerCase(), contains('content-type: image/jpeg'));
      expect(user.kyc, KycStatus.pending);
    });
  });

  group('wallet', () {
    test('transactions page with signed amounts', () async {
      backend.reply(
        'GET /wallet/transactions',
        const Reply(200, {
          'items': [
            {
              'id': 2,
              'type': 'purchase',
              'amount': -30000,
              'balanceAfter': 220000,
              'refType': 'ticket',
              'refId': 9,
              'note': null,
              'createdAt': '2026-10-18T04:00:00Z',
            },
          ],
          'nextBefore': 2,
        }),
      );
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final page = await api.transactions(limit: 20, before: 5);

      expect(backend.requests.single.url.queryParameters, {
        'limit': '20',
        'before': '5',
      });
      final tx = page.items.single;
      expect(tx.type, WalletTxType.purchase);
      expect(tx.amount, -30000);
      expect(tx.refId, 9);
      expect(page.nextBefore, 2);
    });

    test('deposit create, poll and dev simulate', () async {
      final deposit = {
        'id': 3,
        'amount': 100000,
        'status': 'pending',
        'provider': 'mock',
        'qrPayload': '00020101021238...',
        'expiresAt': '2026-10-18T05:15:00Z',
        'createdAt': '2026-10-18T05:00:00Z',
      };
      backend.reply('POST /wallet/deposits', Reply(201, deposit));
      backend.reply('GET /wallet/deposits/3', Reply(200, deposit));
      backend.reply(
        'POST /dev/deposits/3/simulate',
        Reply(200, {...deposit, 'status': 'success'}),
      );
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final created = await api.createDeposit(100000);
      final polled = await api.deposit(created.id);
      final simulated = await api.simulateDeposit(3, success: true);

      expect(jsonBody(backend.requests[0]), {'amount': 100000});
      expect(created.isPending, isTrue);
      expect(created.qrPayload, '00020101021238...');
      expect(polled.status, DepositStatus.pending);
      expect(jsonBody(backend.requests[2]), {'status': 'success'});
      expect(simulated.status, DepositStatus.success);
    });

    test('withdrawal request body and history', () async {
      final w = {
        'id': 4,
        'amount': 50000,
        'bankName': 'BCEL',
        'accountNo': '0101000123',
        'accountName': 'SOMCHAI',
        'status': 'requested',
        'note': null,
        'createdAt': '2026-10-18T05:00:00Z',
        'updatedAt': '2026-10-18T05:00:00Z',
      };
      backend.reply('POST /wallet/withdrawals', Reply(201, w));
      backend.reply(
        'GET /wallet/withdrawals',
        Reply(200, {
          'items': [w],
          'nextBefore': null,
        }),
      );
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final created = await api.withdraw(
        amount: 50000,
        bankName: 'BCEL',
        accountNo: '0101000123',
        accountName: 'SOMCHAI',
        pin: '482915',
      );
      final history = await api.withdrawals(limit: 20);

      expect(jsonBody(backend.requests[0]), {
        'amount': 50000,
        'bankName': 'BCEL',
        'accountNo': '0101000123',
        'accountName': 'SOMCHAI',
        'pin': '482915',
      });
      expect(created.status, WithdrawalStatus.requested);
      expect(history.items.single.bankName, 'BCEL');
      expect(history.hasMore, isFalse);
    });
  });

  group('notifications & agent', () {
    test('notifications page includes unread; read endpoints return 204',
        () async {
      backend.reply(
        'GET /notifications',
        const Reply(200, {
          'items': [
            {
              'id': 1,
              'title': 'ຖືກລາງວັນ',
              'body': 'ບິນ LT-0123-000009',
              'data': {'ticketId': 9},
              'readAt': null,
              'createdAt': '2026-10-18T05:00:00Z',
            },
          ],
          'nextBefore': null,
          'unread': 3,
        }),
      );
      backend.reply('POST /notifications/1/read', const Reply(204));
      backend.reply('POST /notifications/read-all', const Reply(204));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final page = await api.notifications(limit: 1);
      await api.markNotificationRead(1);
      await api.markAllNotificationsRead();

      expect(page.unread, 3);
      expect(page.items.single.isRead, isFalse);
      expect(page.items.single.data, {'ticketId': 9});
      expect(backend.requests.map((r) => r.url.path), [
        '/v1/notifications',
        '/v1/notifications/1/read',
        '/v1/notifications/read-all',
      ]);
    });

    test('agent sale sends drawId, buyerPhone, lines and Idempotency-Key',
        () async {
      backend.reply(
        'POST /agent/sales',
        Reply(201, {...ticketJson(), 'buyerPhone': '02077778888'}),
      );
      backend.reply(
        'GET /agent/summary',
        const Reply(200, {
          'sales': 1500000,
          'tickets': 42,
          'commissionPending': 15000,
          'commissionSettled': 30000,
        }),
      );
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      final sale = await api.agentSale(
        drawId: 7,
        buyerPhone: '02077778888',
        lines: const [PurchaseLine(number: '27', amount: 10000)],
        idempotencyKey: 'agent-key-0001',
      );
      final summary = await api.agentSummary();

      final req = backend.requests.first;
      expect(req.headers['Idempotency-Key'], 'agent-key-0001');
      expect(jsonBody(req), {
        'drawId': 7,
        'buyerPhone': '02077778888',
        'lines': [
          {'number': '27', 'amount': 10000},
        ],
      });
      expect(sale.ticket.buyerPhone, '02077778888');
      expect(sale.replayed, isFalse);
      expect(summary.tickets, 42);
      expect(summary.commissionSettled, 30000);
    });

    test('agent sale without buyer omits buyerPhone', () async {
      backend.reply('POST /agent/sales', Reply(201, ticketJson()));
      final (:api, :client, store: _) = backend.build(tokens: _tokens);
      await client.restoreSession();

      await api.agentSale(
        drawId: 7,
        lines: const [PurchaseLine(number: '27', amount: 10000)],
        idempotencyKey: 'agent-key-0002',
      );

      expect(jsonBody(backend.requests.single).containsKey('buyerPhone'), isFalse);
    });
  });
}
