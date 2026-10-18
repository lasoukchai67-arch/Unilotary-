import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lao_lottery/api/token_store.dart';
import 'package:lao_lottery/app.dart';
import 'package:lao_lottery/l10n/strings.dart';
import 'package:lao_lottery/screens/tickets/ticket_detail_screen.dart';
import 'package:lao_lottery/screens/tickets/tickets_screen.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../support/fake_backend.dart';

/// Opens every screen at a small phone size: layout overflows and runtime
/// errors fail the test.
void main() {
  late FakeBackend backend;

  setUp(() {
    final deposit = {
      'id': 3,
      'amount': 100000,
      'status': 'pending',
      'provider': 'mock',
      'qrPayload': '00020101021238570010A000000727012700069704',
      'expiresAt': '2026-10-18T05:15:00Z',
      'createdAt': '2026-10-18T05:00:00Z',
    };
    backend = FakeBackend()
      ..reply('GET /me', Reply(200, userJson(role: 'agent', kyc: 'rejected')))
      ..reply('GET /wallet', const Reply(200, {'balance': 1250000, 'held': 50000}))
      ..reply('GET /draws/current', Reply(200, drawJson()))
      ..reply(
        'GET /draws',
        Reply(200, {
          'items': [
            drawJson(id: 6, drawNo: '0122', status: 'resulted', resultNumber: '482175'),
            drawJson(id: 5, drawNo: '0121', status: 'resulted', resultNumber: '090311'),
          ],
        }),
      )
      ..reply(
        'GET /tickets',
        Reply(200, {
          'items': [
            ticketJson(id: 12, status: 'won'),
            ticketJson(id: 11, status: 'cancelled'),
          ],
          'nextBefore': null,
        }),
      )
      ..reply(
        'GET /wallet/transactions',
        const Reply(200, {
          'items': [
            {
              'id': 2,
              'type': 'purchase',
              'amount': -30000,
              'balanceAfter': 1250000,
              'refType': 'ticket',
              'refId': 9,
              'note': null,
              'createdAt': '2026-10-18T04:00:00Z',
            },
            {
              'id': 1,
              'type': 'deposit',
              'amount': 1280000,
              'balanceAfter': 1280000,
              'refType': 'deposit',
              'refId': 3,
              'note': 'BCEL One',
              'createdAt': '2026-10-17T04:00:00Z',
            },
          ],
          'nextBefore': null,
        }),
      )
      ..reply(
        'GET /wallet/withdrawals',
        const Reply(200, {
          'items': [
            {
              'id': 4,
              'amount': 50000,
              'bankName': 'BCEL',
              'accountNo': '0101000123',
              'accountName': 'SOMCHAI',
              'status': 'rejected',
              'note': 'ຊື່ບັນຊີບໍ່ກົງກັນ',
              'createdAt': '2026-10-18T05:00:00Z',
              'updatedAt': '2026-10-18T06:00:00Z',
            },
          ],
          'nextBefore': null,
        }),
      )
      ..reply('POST /wallet/deposits', Reply(201, deposit))
      ..reply('GET /wallet/deposits/3', Reply(200, deposit))
      ..reply(
        'GET /notifications',
        const Reply(200, {
          'items': [
            {
              'id': 1,
              'title': 'ຖືກລາງວັນ',
              'body': 'ບິນ LT-0123-000009 ຖືກລາງວັນ 600,000 ກີບ',
              'data': null,
              'readAt': null,
              'createdAt': '2026-10-18T05:00:00Z',
            },
          ],
          'nextBefore': null,
          'unread': 1,
        }),
      )
      ..reply(
        'GET /agent/summary',
        const Reply(200, {
          'sales': 1500000,
          'tickets': 42,
          'commissionPending': 15000,
          'commissionSettled': 30000,
        }),
      );
  });

  testWidgets('all screens render at 360×740', (tester) async {
    tester.view.physicalSize = const Size(1080, 2220);
    tester.view.devicePixelRatio = 3; // 360×740 logical
    addTearDown(tester.view.reset);

    final (:api, client: _, store: _) = backend.build(
      tokens: const AuthTokens(accessToken: 'a', refreshToken: 'r'),
    );
    await tester.pumpWidget(LotteryApp(api: api));
    await tester.pumpAndSettle();

    Future<void> tab(String label) async {
      await tester.tap(find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text(label),
      ));
      await tester.pumpAndSettle();
    }

    // pageBack() looks for an English "Back" tooltip; the app runs in Lao.
    Future<void> back() async {
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
    }

    expect(find.text(S.drawNo('0123')), findsOneWidget);
    await tester.drag(find.byType(ListView).first, const Offset(0, -1500));
    await tester.pumpAndSettle();

    await tab(S.navBuy);
    expect(find.byKey(const ValueKey('pay')), findsOneWidget);

    await tab(S.navTickets);
    final ticketInList = find.descendant(
      of: find.byType(TicketsScreen),
      matching: find.text('LT-0123-000012'),
    );
    expect(ticketInList, findsOneWidget);
    await tester.tap(ticketInList);
    await tester.pumpAndSettle();
    expect(find.byType(TicketDetailScreen), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    await tester.drag(find.byType(ListView).last, const Offset(0, -1500));
    await tester.pumpAndSettle();
    await back();

    await tab(S.navResults);
    await tester.enterText(
      find.byKey(const ValueKey('check-number-field')),
      '992175',
    );
    await tester.tap(find.byKey(const ValueKey('check-number')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('check-result')), findsOneWidget);

    await tab(S.navWallet);
    expect(find.byKey(const ValueKey('wallet-balance')), findsOneWidget);
    await tester.tap(find.text(S.withdrawalsTitle));
    await tester.pumpAndSettle();
    expect(find.text('ຊື່ບັນຊີບໍ່ກົງກັນ'), findsOneWidget);
    await back();

    await tester.tap(find.widgetWithText(FilledButton, S.deposit).first);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('deposit-amount')), '100000');
    await tester.tap(find.text(S.depositCreate));
    // A pending deposit shows a spinner forever: pump fixed durations.
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text(S.depositWaiting), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(milliseconds: 100));
    expect(backend.calls('GET /wallet/deposits/3'), hasLength(1));
    await tester.tap(find.byType(BackButton));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(OutlinedButton, S.withdraw).first);
    await tester.pumpAndSettle();
    expect(find.text(S.withdrawSubmit), findsOneWidget);
    await back();

    // Profile and its sub-screens.
    await tester.tap(find.byKey(const ValueKey('open-profile')));
    await tester.pumpAndSettle();
    expect(find.text(S.agentSales), findsOneWidget);
    await tester.drag(find.byType(ListView).last, const Offset(0, -1500));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).last, const Offset(0, 1500));
    await tester.pumpAndSettle();

    await tester.tap(find.text(S.kycStatus));
    await tester.pumpAndSettle();
    expect(find.text(S.kycSubmit), findsOneWidget);
    await tester.drag(find.byType(ListView).last, const Offset(0, -1500));
    await tester.pumpAndSettle();
    await back();

    await tester.tap(find.text(S.agentSales));
    await tester.pumpAndSettle();
    expect(find.text(S.agentSummary), findsOneWidget);
    await back();

    await tester.tap(find.text(S.changePin));
    await tester.pumpAndSettle();
    await back();

    await tester.tap(find.text(S.selfExclusion));
    await tester.pumpAndSettle();
    await tester.tap(find.text(S.daysOption(7)));
    await tester.pumpAndSettle();
    expect(find.text(S.selfExclusionConfirmBody(7)), findsOneWidget);
    await tester.tap(find.text(S.cancel));
    await tester.pumpAndSettle();

    await tester.tap(find.text(S.notifications).last);
    await tester.pumpAndSettle();
    expect(find.text('ຖືກລາງວັນ'), findsOneWidget);
    await back();
  });
}
