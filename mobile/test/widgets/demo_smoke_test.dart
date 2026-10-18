import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lao_lottery/app.dart';
import 'package:lao_lottery/demo/demo_backend.dart';
import 'package:lao_lottery/demo/demo_mode.dart';
import 'package:lao_lottery/l10n/strings.dart';
import 'package:lao_lottery/utils/format.dart';
import 'package:lao_lottery/widgets/banners.dart';

/// Boots the real app in demo mode (no server) on a 360×740 phone.
void main() {
  testWidgets('demo mode: login → home → buy → ticket → demo result', (tester) async {
    tester.view.physicalSize = const Size(1080, 2220);
    tester.view.devicePixelRatio = 3; // 360×740 logical
    addTearDown(tester.view.reset);

    final demo = DemoController(backend: DemoBackend(autoTimers: false));
    addTearDown(demo.dispose);
    await tester.pumpWidget(LotteryApp(api: demo.createApi(), demo: demo));
    await tester.pumpAndSettle();

    final banner = find.byKey(const ValueKey('demo-banner'));
    void bannerDoesNotCover() {
      expect(banner, findsOneWidget);
      final b = tester.getRect(banner);
      expect(b.top, greaterThanOrEqualTo(0));
      expect(b.height, lessThanOrEqualTo(24));
      for (final bar in find.byType(AppBar).evaluate()) {
        expect(tester.getRect(find.byWidget(bar.widget)).top,
            greaterThanOrEqualTo(b.bottom));
      }
      for (final nav in find.byType(NavigationBar).evaluate()) {
        expect(tester.getRect(find.byWidget(nav.widget)).bottom,
            lessThanOrEqualTo(740));
      }
    }

    // Login screen with the demo hint.
    bannerDoesNotCover();
    expect(find.text(S.demoBanner), findsOneWidget);
    expect(find.byKey(const ValueKey('demo-login-hint')), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('phone-field')), '020 5555 0001');
    await tester.tap(find.byKey(const ValueKey('request-otp')));
    await tester.pumpAndSettle();

    // OTP: the demo always shows the code.
    final dev = tester.widget<DevBanner>(find.byType(DevBanner));
    final code = RegExp(r'\d{6}').firstMatch(dev.text)!.group(0)!;
    bannerDoesNotCover();
    await tester.enterText(find.byKey(const ValueKey('otp-field')), code);
    await tester.pumpAndSettle();

    // First login: set the PIN.
    expect(find.text(S.setPinTitle), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('new-pin')), '482915');
    await tester.enterText(find.byKey(const ValueKey('confirm-pin')), '482915');
    await tester.tap(find.byKey(const ValueKey('save-pin')));
    await tester.pumpAndSettle();

    // Home with the demo balance, open draw and last result.
    bannerDoesNotCover();
    expect(find.byKey(const ValueKey('home-balance')), findsOneWidget);
    expect(find.text(formatKip(demoStartBalance)), findsOneWidget);
    await tester.scrollUntilVisible(find.byKey(const ValueKey('last-result')), 200,
        scrollable: find.byType(Scrollable).first);
    await tester.scrollUntilVisible(find.byKey(const ValueKey('home-buy')), -200,
        scrollable: find.byType(Scrollable).first);
    await tester.tap(find.byKey(const ValueKey('home-buy')));
    await tester.pumpAndSettle();

    // Buy "27" for 1,000.
    bannerDoesNotCover();
    await tester.tap(find.byKey(const ValueKey('key-2')));
    await tester.tap(find.byKey(const ValueKey('key-7')));
    await tester.pump();
    // The test font is wider/taller than Noto Sans Lao, so scroll if needed.
    await tester.ensureVisible(find.byKey(const ValueKey('add-line')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('add-line')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('pay')));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text(S.pay)));
    await tester.pumpAndSettle();

    // Ticket.
    expect(find.byKey(const ValueKey('purchase-success')), findsOneWidget);
    bannerDoesNotCover();
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    // Profile → demo tools → draw the result: "27" wins 1,000 × 60.
    await tester.tap(find.byKey(const ValueKey('open-profile')));
    await tester.pumpAndSettle();
    bannerDoesNotCover();
    await tester.scrollUntilVisible(find.byKey(const ValueKey('demo-settle')), 200,
        scrollable: find.byType(Scrollable).last);
    await tester.tap(find.byKey(const ValueKey('demo-settle')));
    await tester.pumpAndSettle();
    expect(find.text(S.demoYouWon(formatKip(60000))), findsOneWidget);
    await tester.tap(find.text(S.ok));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    // The payout reached the wallet: 500,000 − 1,000 + 60,000.
    await tester.tap(find.descendant(
        of: find.byType(NavigationBar), matching: find.text(S.navHome)));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.byKey(const ValueKey('home-balance')), -200,
        scrollable: find.byType(Scrollable).first);
    expect(find.text(formatKip(demoStartBalance - 1000 + 60000)), findsOneWidget);
  });

  testWidgets('the demo banner is announced by screen readers', (tester) async {
    final semantics = tester.ensureSemantics();
    final demo = DemoController(backend: DemoBackend(autoTimers: false));
    addTearDown(demo.dispose);
    await tester.pumpWidget(LotteryApp(api: demo.createApi(), demo: demo));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel(S.demoBanner), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('normal builds show no demo UI', (tester) async {
    final demo = DemoController(backend: DemoBackend(autoTimers: false));
    addTearDown(demo.dispose);
    // Same API stack, but no DemoController given to the app.
    await tester.pumpWidget(LotteryApp(api: demo.createApi()));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('demo-banner')), findsNothing);
    expect(find.byKey(const ValueKey('demo-login-hint')), findsNothing);
    expect(find.text(S.loginSubtitle), findsOneWidget);
  });
}
