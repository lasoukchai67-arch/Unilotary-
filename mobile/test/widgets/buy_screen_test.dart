import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:lao_lottery/api/lottery_api.dart';
import 'package:lao_lottery/api/token_store.dart';
import 'package:lao_lottery/l10n/strings.dart';
import 'package:lao_lottery/models/models.dart';
import 'package:lao_lottery/screens/buy/buy_screen.dart';
import 'package:lao_lottery/state/app_data.dart';
import 'package:lao_lottery/state/auth_state.dart';
import 'package:lao_lottery/state/cart.dart';
import 'package:lao_lottery/state/events.dart';
import 'package:lao_lottery/theme.dart';
import 'package:provider/provider.dart';

import '../support/fake_backend.dart';

void main() {
  late FakeBackend backend;

  setUp(() {
    backend = FakeBackend()
      ..reply('GET /draws/current', Reply(200, drawJson()))
      ..reply('GET /draws', const Reply(200, {'items': []}))
      ..reply('GET /wallet', const Reply(200, {'balance': 250000, 'held': 0}))
      ..reply('GET /me', Reply(200, userJson()));
  });

  Future<Cart> pumpBuyScreen(
    WidgetTester tester, {
    String kyc = 'verified',
  }) async {
    tester.view.physicalSize = const Size(1000, 2600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final (:api, :client, store: _) = backend.build(
      tokens: const AuthTokens(accessToken: 'access-1', refreshToken: 'r'),
    );
    final auth = AuthState(api);
    final draws = DrawState(api);
    await tester.runAsync(() async {
      await client.restoreSession();
      await draws.refresh();
    });
    auth.updateUser(User.fromJson(userJson(kyc: kyc)));
    var n = 0;
    final cart = Cart(keyGenerator: () => 'idem-key-${++n}');

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<LotteryApi>.value(value: api),
          ChangeNotifierProvider.value(value: auth),
          ChangeNotifierProvider(create: (_) => WalletState(api)),
          ChangeNotifierProvider.value(value: draws),
          ChangeNotifierProvider(create: (_) => NotificationState(api)),
          ChangeNotifierProvider.value(value: cart),
          ChangeNotifierProvider(create: (_) => TicketEvents()),
          ChangeNotifierProvider(create: (_) => ShellTabs()),
        ],
        child: MaterialApp(
          theme: buildTheme(),
          home: const Scaffold(body: BuyScreen()),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return cart;
  }

  Future<void> type(WidgetTester tester, String digits) async {
    for (final d in digits.split('')) {
      await tester.tap(find.byKey(ValueKey('key-$d')));
    }
    await tester.pump();
  }

  String totalText(WidgetTester tester) =>
      tester.widget<Text>(
        find.descendant(
          of: find.byKey(const ValueKey('cart-total')),
          matching: find.byType(Text),
        ),
      ).data!;

  Finder line(String number) => find.byKey(ValueKey('cart-line-$number'));

  Future<void> payAndConfirm(WidgetTester tester) async {
    await tester.tap(find.byKey(const ValueKey('pay')));
    await tester.pumpAndSettle();
    expect(find.text(S.confirmPurchase), findsOneWidget);
    await tester.tap(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text(S.pay),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('keypad, amounts, ກັບເລກ and remove build the cart',
      (tester) async {
    await pumpBuyScreen(tester);
    expect(find.text(S.drawNo('0123')), findsOneWidget);
    expect(totalText(tester), '0 ກີບ');

    await type(tester, '12');
    await tester.tap(find.byKey(const ValueKey('add-line')));
    await tester.pump();
    expect(line('12'), findsOneWidget);
    expect(totalText(tester), '1,000 ກີບ');

    await type(tester, '123');
    await tester.tap(find.byKey(const ValueKey('permute')));
    await tester.pumpAndSettle();
    for (final p in ['123', '132', '213', '231', '312', '321']) {
      expect(line(p), findsOneWidget, reason: p);
    }
    expect(find.text(S.permutationsAdded(6)), findsOneWidget);
    expect(totalText(tester), '7,000 ກີບ');

    await tester.tap(find.byTooltip('${S.delete} 12'));
    await tester.pump();
    expect(line('12'), findsNothing);
    expect(totalText(tester), '6,000 ກີບ');

    await tester.tap(find.byKey(const ValueKey('amount-5000')));
    await type(tester, '45');
    await tester.tap(find.byKey(const ValueKey('add-line')));
    await tester.pump();
    expect(
      find.descendant(of: line('45'), matching: find.text('5,000 ກີບ')),
      findsOneWidget,
    );
    expect(totalText(tester), '11,000 ກີບ');

    // Custom amount.
    await tester.tap(find.byKey(const ValueKey('amount-custom')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('custom-amount-field')),
      '2500',
    );
    await tester.tap(find.text(S.ok));
    await tester.pumpAndSettle();
    await type(tester, '99');
    await tester.tap(find.byKey(const ValueKey('add-line')));
    await tester.pump();
    expect(totalText(tester), '13,500 ກີບ');
  });

  testWidgets('pay retries with the same Idempotency-Key after a network error',
      (tester) async {
    var attempts = 0;
    backend.on('POST /draws/7/tickets', (r) {
      attempts++;
      if (attempts == 1) throw http.ClientException('connection reset');
      return Reply(201, {
        ...ticketJson(
          lines: [
            {
              'number': '27',
              'digits': 2,
              'amount': 1000,
              'payoutRate': 60,
              'winAmount': 0,
            },
          ],
          totalAmount: 1000,
        ),
        'balanceAfter': 249000,
        'replayed': false,
      });
    });
    final cart = await pumpBuyScreen(tester);

    await type(tester, '27');
    await tester.tap(find.byKey(const ValueKey('add-line')));
    await tester.pump();

    await payAndConfirm(tester);
    expect(find.text(S.connectionLost), findsOneWidget);
    expect(find.text(S.retryPayment), findsOneWidget);
    expect(line('27'), findsOneWidget, reason: 'cart kept for the retry');

    await tester.tap(find.text(S.retry));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('purchase-success')), findsOneWidget);

    final calls = backend.calls('POST /draws/7/tickets');
    expect(calls, hasLength(2));
    expect(calls[0].headers['Idempotency-Key'], 'idem-key-1');
    expect(calls[1].headers['Idempotency-Key'], 'idem-key-1');
    expect(jsonBody(calls[1]), {
      'lines': [
        {'number': '27', 'amount': 1000},
      ],
    });
    expect(cart.isEmpty, isTrue);
  });

  testWidgets('NUMBER_LIMIT shows the reason for each number', (tester) async {
    backend.reply(
      'POST /draws/7/tickets',
      Reply.error(409, 'NUMBER_LIMIT', 'ບາງເລກເຕັມແລ້ວ ຫຼື ປິດຮັບ', [
        {'number': '27', 'reason': 'closed', 'remaining': 0},
        {'number': '75', 'reason': 'full', 'remaining': 5000},
      ]),
    );
    final cart = await pumpBuyScreen(tester);

    await type(tester, '27');
    await tester.tap(find.byKey(const ValueKey('add-line')));
    await type(tester, '75');
    await tester.tap(find.byKey(const ValueKey('add-line')));
    await tester.pump();

    await payAndConfirm(tester);
    expect(find.text(S.numberLimitTitle), findsOneWidget);
    expect(find.text(S.limitClosed), findsWidgets);
    expect(find.text(S.limitFull('5,000 ກີບ')), findsWidgets);

    await tester.tap(find.text(S.ok));
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: line('27'), matching: find.text(S.limitClosed)),
      findsOneWidget,
    );
    expect(cart.limits.keys, containsAll(['27', '75']));

    // A changed cart is a new attempt with a new key.
    final firstKey = backend.requests.last.headers['Idempotency-Key'];
    await tester.tap(find.byTooltip('${S.delete} 27'));
    await tester.pump();
    expect(cart.idempotencyKey, isNot(firstKey));
  });

  testWidgets('without verified KYC, pay routes to the KYC screen',
      (tester) async {
    await pumpBuyScreen(tester, kyc: 'unsubmitted');
    await type(tester, '27');
    await tester.tap(find.byKey(const ValueKey('add-line')));
    await tester.pump();

    await tester.tap(find.byKey(const ValueKey('pay')));
    await tester.pumpAndSettle();
    expect(find.text(S.kycRequiredTitle), findsOneWidget);

    await tester.tap(find.text(S.goToKyc));
    await tester.pumpAndSettle();
    expect(find.text(S.kycTitle), findsOneWidget);
    expect(backend.calls('POST /draws/7/tickets'), isEmpty);
  });
}
