// TEMPORARY: renders screenshots with the real fonts for manual review.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lao_lottery/api/token_store.dart';
import 'package:lao_lottery/app.dart';
import 'package:lao_lottery/l10n/strings.dart';

import 'support/fake_backend.dart';

const out = '/tmp/claude-0/-home-user-unilotary-/bc66907b-07d5-573e-bd9d-647023ec3c47/scratchpad/shots';

Future<void> loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    final bytes = File(f).readAsBytesSync();
    loader.addFont(Future.value(ByteData.view(bytes.buffer)));
  }
  await loader.load();
}

void main() {
  setUpAll(() async {
    await loadFont('NotoSansLao', ['assets/fonts/NotoSansLao-Regular.ttf', 'assets/fonts/NotoSansLao-Bold.ttf']);
    await loadFont('NotoSansLaoLatin', ['assets/fonts/NotoSansLaoLatin-Regular.ttf', 'assets/fonts/NotoSansLaoLatin-Bold.ttf']);
    await loadFont('MaterialIcons', ['/opt/flutter/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf']);
  });

  testWidgets('shots', (tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final backend = FakeBackend()
      ..reply('GET /me', Reply(200, userJson(role: 'agent')))
      ..reply('GET /wallet', const Reply(200, {'balance': 1250000, 'held': 50000}))
      ..reply('GET /draws/current', Reply(200, drawJson(salesCloseAt: DateTime.now().toUtc().add(const Duration(days: 1, hours: 3, minutes: 4)).toIso8601String(), serverTime: DateTime.now().toUtc().toIso8601String())))
      ..reply('GET /draws', Reply(200, {'items': [drawJson(id: 6, drawNo: '0122', status: 'resulted', resultNumber: '482175'), drawJson(id: 5, drawNo: '0121', status: 'resulted', resultNumber: '090311')]}))
      ..reply('GET /tickets', Reply(200, {'items': [ticketJson(id: 12, status: 'won'), ticketJson(id: 11)], 'nextBefore': null}))
      ..reply('GET /wallet/transactions', const Reply(200, {'items': [{'id': 2, 'type': 'purchase', 'amount': -30000, 'balanceAfter': 1250000, 'refType': 'ticket', 'refId': 9, 'note': null, 'createdAt': '2026-10-18T04:00:00Z'}], 'nextBefore': null}))
      ..reply('GET /notifications', const Reply(200, {'items': [], 'nextBefore': null, 'unread': 3}));
    final (:api, client: _, store: _) = backend.build(tokens: const AuthTokens(accessToken: 'a', refreshToken: 'r'));
    await tester.pumpWidget(RepaintBoundary(key: const ValueKey('root'), child: LotteryApp(api: api)));
    await tester.pumpAndSettle();

    Future<void> shot(String name) async {
      final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(const ValueKey('root')));
      await tester.runAsync(() async {
        final image = await boundary.toImage(pixelRatio: 1);
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        File('$out/$name.png').writeAsBytesSync(data!.buffer.asUint8List());
      });
    }

    await shot('1-home');
    Future<void> tab(String label) async {
      await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text(label)));
      await tester.pumpAndSettle();
    }
    await tab(S.navBuy);
    for (final k in ['1', '2', '3']) { await tester.tap(find.byKey(ValueKey('key-$k'))); }
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('permute')));
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    await shot('2-buy');
    await tester.drag(find.byType(ListView).first, const Offset(0, -900));
    await tester.pumpAndSettle();
    await shot('3-buy-cart');
    await tab(S.navTickets);
    await tester.tap(find.descendant(of: find.byType(ListView).last, matching: find.text('LT-0123-000012')));
    await tester.pumpAndSettle();
    await shot('4-ticket');
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    await tab(S.navResults);
    await tester.enterText(find.byKey(const ValueKey('check-number-field')), '2175');
    await tester.tap(find.byKey(const ValueKey('check-number')));
    await tester.pumpAndSettle();
    await shot('5-results');
    await tab(S.navWallet);
    await shot('6-wallet');
    await tester.tap(find.byKey(const ValueKey('open-profile')));
    await tester.pumpAndSettle();
    await shot('7-profile');
  });
}
