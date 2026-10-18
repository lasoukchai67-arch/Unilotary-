import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lao_lottery/api/token_store.dart';
import 'package:lao_lottery/app.dart';
import 'package:lao_lottery/l10n/strings.dart';

import '../support/fake_backend.dart';

void main() {
  late FakeBackend backend;

  setUp(() {
    backend = FakeBackend()
      ..reply(
        'POST /auth/otp/request',
        const Reply(200, {'expiresInSec': 300, 'devCode': '123456'}),
      )
      ..reply(
        'POST /auth/otp/verify',
        Reply(200, authJson(user: userJson(pinSet: false))),
      )
      ..reply('POST /me/pin', const Reply(204))
      ..reply('GET /me', Reply(200, userJson()))
      ..reply('GET /wallet', const Reply(200, {'balance': 250000, 'held': 0}))
      ..reply('GET /draws/current', Reply(200, drawJson()))
      ..reply(
        'GET /draws',
        Reply(200, {
          'items': [
            drawJson(id: 6, drawNo: '0122', status: 'resulted', resultNumber: '482175'),
          ],
        }),
      )
      ..reply('GET /tickets', const Reply(200, {'items': [], 'nextBefore': null}))
      ..reply(
        'GET /notifications',
        const Reply(200, {'items': [], 'nextBefore': null, 'unread': 2}),
      );
  });

  void useTallScreen(WidgetTester tester) {
    tester.view.physicalSize = const Size(900, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  testWidgets('phone → OTP (dev code banner) → set PIN → home', (tester) async {
    useTallScreen(tester);
    final (:api, client: _, :store) = backend.build();

    await tester.pumpWidget(LotteryApp(api: api));
    await tester.pumpAndSettle();

    // Step 1: phone number.
    expect(find.text(S.loginSubtitle), findsOneWidget);
    expect(find.text(S.rgNotice), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('phone-field')), '123');
    await tester.tap(find.byKey(const ValueKey('request-otp')));
    await tester.pumpAndSettle();
    expect(find.text(S.phoneInvalid), findsOneWidget);
    expect(backend.requests, isEmpty);

    await tester.enterText(
      find.byKey(const ValueKey('phone-field')),
      '+856 20 5555 1234',
    );
    await tester.tap(find.byKey(const ValueKey('request-otp')));
    await tester.pumpAndSettle();
    expect(
      jsonBody(backend.calls('POST /auth/otp/request').single),
      {'phone': '02055551234'},
    );

    // Step 2: OTP with the dev code banner.
    expect(find.text(S.otpTitle), findsOneWidget);
    expect(find.text(S.devCode('123456')), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('otp-field')), '123456');
    await tester.pumpAndSettle();
    expect(
      jsonBody(backend.calls('POST /auth/otp/verify').single),
      {'phone': '02055551234', 'code': '123456'},
    );
    expect(store.tokens?.accessToken, 'access-1');
    expect(store.tokens?.refreshToken, 'refresh-1');

    // Step 3: pinSet == false forces the PIN screen.
    expect(find.text(S.setPinTitle), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('new-pin')), '482915');
    await tester.enterText(find.byKey(const ValueKey('confirm-pin')), '482916');
    await tester.tap(find.byKey(const ValueKey('save-pin')));
    await tester.pumpAndSettle();
    expect(find.text(S.pinMismatch), findsOneWidget);
    expect(backend.calls('POST /me/pin'), isEmpty);

    await tester.enterText(find.byKey(const ValueKey('confirm-pin')), '482915');
    await tester.tap(find.byKey(const ValueKey('save-pin')));
    await tester.pumpAndSettle();
    final pinCall = backend.calls('POST /me/pin').single;
    expect(jsonBody(pinCall), {'pin': '482915'});
    expect(pinCall.headers['Authorization'], 'Bearer access-1');

    // Home.
    expect(find.text(S.navHome), findsOneWidget);
    expect(find.text('250,000 ກີບ'), findsOneWidget);
    expect(find.text(S.drawNo('0123')), findsOneWidget);
    expect(find.byKey(const ValueKey('last-result')), findsOneWidget);
    expect(find.text(S.noTickets), findsOneWidget);
    expect(find.byKey(const ValueKey('home-buy')), findsOneWidget);
  });

  testWidgets('a wrong OTP shows the server message', (tester) async {
    useTallScreen(tester);
    backend.reply(
      'POST /auth/otp/verify',
      Reply.error(400, 'VALIDATION', 'ລະຫັດ OTP ບໍ່ຖືກຕ້ອງ'),
    );
    final (:api, client: _, store: _) = backend.build();

    await tester.pumpWidget(LotteryApp(api: api));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('phone-field')),
      '0301234567',
    );
    await tester.tap(find.byKey(const ValueKey('request-otp')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('otp-field')), '000000');
    await tester.pumpAndSettle();

    expect(find.text('ລະຫັດ OTP ບໍ່ຖືກຕ້ອງ'), findsOneWidget);
    expect(find.text(S.otpTitle), findsOneWidget);
  });

  testWidgets('a saved session whose refresh fails returns to login',
      (tester) async {
    useTallScreen(tester);
    backend
      ..reply('GET /me', Reply.error(401, 'UNAUTHORIZED', 'ໝົດອາຍຸ'))
      ..reply(
        'POST /auth/refresh',
        Reply.error(401, 'UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່'),
      );
    final (:api, client: _, :store) = backend.build(
      tokens: const AuthTokens(accessToken: 'old', refreshToken: 'old-r'),
    );

    await tester.pumpWidget(LotteryApp(api: api));
    await tester.pumpAndSettle();

    expect(backend.calls('POST /auth/refresh'), hasLength(1));
    expect(find.text(S.loginSubtitle), findsOneWidget);
    expect(store.tokens, isNull);
  });

  testWidgets('a saved session goes straight to home', (tester) async {
    useTallScreen(tester);
    final (:api, client: _, store: _) = backend.build(
      tokens: const AuthTokens(accessToken: 'access-1', refreshToken: 'r'),
    );

    await tester.pumpWidget(LotteryApp(api: api));
    await tester.pumpAndSettle();

    expect(find.text('250,000 ກີບ'), findsOneWidget);
    // Unread notifications badge.
    expect(
      find.descendant(of: find.byType(Badge), matching: find.text('2')),
      findsOneWidget,
    );
  });
}
