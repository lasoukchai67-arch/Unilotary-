import 'package:flutter_test/flutter_test.dart';
import 'package:lao_lottery/models/models.dart';
import 'package:lao_lottery/state/cart.dart';

import '../support/fake_backend.dart';

void main() {
  final rules = Draw.fromJson(drawJson()).rules;
  final twoAndThreeOnly = rules.where((r) => r.digits <= 3).toList();

  Cart newCart() {
    var n = 0;
    return Cart(keyGenerator: () => 'key-${++n}-abcdefgh');
  }

  void type(Cart cart, String digits) {
    for (final d in digits.split('')) {
      cart.typeDigit(d);
    }
  }

  test('keypad accepts at most 6 digits', () {
    final cart = newCart();
    type(cart, '12345678');
    expect(cart.input, '123456');
    cart.backspace();
    expect(cart.input, '12345');
    cart.clearInput();
    expect(cart.input, '');
  });

  test('adds and merges lines with the selected amount', () {
    final cart = newCart()..setAmount(5000);
    type(cart, '27');
    expect(cart.addInput(rules), AddResult.added);
    expect(cart.input, isEmpty);
    type(cart, '27');
    expect(cart.addInput(rules), AddResult.merged);
    expect(cart.lines.single.amount, 10000);
    expect(cart.total, 10000);
  });

  test('rejects lengths the draw does not offer', () {
    final cart = newCart();
    type(cart, '1234');
    expect(cart.addInput(twoAndThreeOnly), AddResult.notOffered);
    expect(cart.isEmpty, isTrue);
    cart.clearInput();
    type(cart, '1');
    expect(cart.addInput(rules), AddResult.invalidLength);
  });

  test('ກັບເລກ adds every unique permutation once', () {
    final cart = newCart()..setAmount(1000);
    type(cart, '12');
    cart.addInput(rules);
    type(cart, '123');
    final r = cart.addPermutations(rules);
    expect(r.result, AddResult.added);
    expect(r.added, 6);
    expect(cart.lines.map((l) => l.number),
        ['12', '123', '132', '213', '231', '312', '321']);
    expect(cart.total, 7000);

    // Again: nothing new.
    type(cart, '321');
    expect(cart.addPermutations(rules).added, 0);
    expect(cart.lines, hasLength(7));
  });

  test('ກັບເລກ refuses to exceed 50 lines', () {
    final cart = newCart();
    type(cart, '123456'); // 720 permutations
    expect(cart.addPermutations(rules).result, AddResult.full);
    expect(cart.isEmpty, isTrue);
  });

  test('validates min amount and max per line from the rules', () {
    final cart = newCart()..setAmount(500);
    type(cart, '27');
    cart.addInput(rules);
    cart.setAmount(60000);
    type(cart, '482');
    cart.addInput(rules);
    cart.setAmount(1000);
    type(cart, '75');
    cart.addInput(rules);

    final issues = cart.issues(rules);
    expect(issues['27']?.kind, LineIssueKind.belowMin);
    expect(issues['27']?.limit, 1000);
    expect(issues['482']?.kind, LineIssueKind.aboveMax);
    expect(issues['482']?.limit, 50000);
    expect(issues.containsKey('75'), isFalse);
    expect(cart.canCheckout(rules), isFalse);

    cart.remove('27');
    cart.remove('482');
    expect(cart.canCheckout(rules), isTrue);
  });

  test('Idempotency-Key is stable until the cart changes', () {
    final cart = newCart();
    type(cart, '27');
    cart.addInput(rules);
    final key = cart.idempotencyKey;
    expect(cart.idempotencyKey, key, reason: 'retry reuses the key');

    type(cart, '75');
    cart.addInput(rules);
    final changed = cart.idempotencyKey;
    expect(changed, isNot(key), reason: 'a different cart is a new attempt');

    cart.completeAttempt();
    expect(cart.idempotencyKey, isNot(changed));
  });

  test('NUMBER_LIMIT details are kept until the cart changes', () {
    final cart = newCart();
    type(cart, '27');
    cart.addInput(rules);
    cart.setLimits(const [
      NumberLimitDetail(
        number: '27',
        reason: NumberLimitReason.full,
        remaining: 5000,
      ),
    ]);
    expect(cart.limits['27']?.remaining, 5000);
    cart.remove('27');
    expect(cart.limits, isEmpty);
  });
}
