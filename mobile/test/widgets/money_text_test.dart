import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lao_lottery/theme.dart';
import 'package:lao_lottery/widgets/digit_tiles.dart';
import 'package:lao_lottery/widgets/money_text.dart';

void main() {
  Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(),
          home: Scaffold(body: Center(child: child)),
        ),
      );

  testWidgets('MoneyText groups thousands, appends ກີບ, uses tabular figures',
      (tester) async {
    await pump(tester, const MoneyText(1234567));

    final text = tester.widget<Text>(find.byType(Text));
    expect(text.data, '1,234,567 ກີບ');
    expect(text.style?.fontFeatures, contains(const FontFeature.tabularFigures()));
  });

  testWidgets('signed and coloured amounts', (tester) async {
    await pump(
      tester,
      const Column(
        children: [
          MoneyText(-30000, signed: true, colorize: true, key: ValueKey('neg')),
          MoneyText(100000, signed: true, colorize: true, key: ValueKey('pos')),
        ],
      ),
    );

    final neg = tester.widget<Text>(
      find.descendant(of: find.byKey(const ValueKey('neg')), matching: find.byType(Text)),
    );
    final pos = tester.widget<Text>(
      find.descendant(of: find.byKey(const ValueKey('pos')), matching: find.byType(Text)),
    );
    expect(neg.data, '-30,000 ກີບ');
    expect(neg.style?.color, Brand.red);
    expect(pos.data, '+100,000 ກີບ');
    expect(pos.style?.color, Brand.midGreen);
  });

  testWidgets('DigitTiles shows one tile per digit with a spoken label',
      (tester) async {
    final semantics = tester.ensureSemantics();
    await pump(tester, const DigitTiles('482175'));

    for (final d in ['4', '8', '2', '1', '7', '5']) {
      expect(find.text(d), findsOneWidget);
    }
    expect(find.bySemanticsLabel('4 8 2 1 7 5'), findsOneWidget);
    semantics.dispose();
  });
}
