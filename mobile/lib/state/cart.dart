import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../models/draw.dart';
import '../models/ticket.dart';
import '../utils/lottery.dart';

/// Maximum lines per ticket (API: 1–50 lines).
const maxCartLines = 50;

/// Preset amount chips.
const amountPresets = <int>[1000, 5000, 10000, 50000];

class CartLine {
  const CartLine(this.number, this.amount);

  final String number;
  final int amount;

  int get digits => number.length;
}

enum LineIssueKind { digitsNotOffered, belowMin, aboveMax }

class LineIssue {
  const LineIssue(this.kind, [this.limit]);

  final LineIssueKind kind;

  /// The min or max amount that was violated.
  final int? limit;
}

/// Validates one line against the draw rules.
LineIssue? validateLine(CartLine line, List<DigitRule> rules) {
  DigitRule? rule;
  for (final r in rules) {
    if (r.digits == line.digits) rule = r;
  }
  if (rule == null) return const LineIssue(LineIssueKind.digitsNotOffered);
  if (line.amount < rule.minAmount) {
    return LineIssue(LineIssueKind.belowMin, rule.minAmount);
  }
  if (line.amount > rule.maxPerLine) {
    return LineIssue(LineIssueKind.aboveMax, rule.maxPerLine);
  }
  return null;
}

enum AddResult { added, merged, invalidLength, notOffered, full }

/// The numbers being bought, plus the keypad input and chosen amount.
///
/// Also owns the purchase attempt's Idempotency-Key: the same key is reused
/// while the cart is unchanged (so a retry after a network error cannot buy
/// twice) and a new one is generated as soon as anything changes.
class Cart extends ChangeNotifier {
  Cart({String Function()? keyGenerator})
      : _newKey = keyGenerator ?? (() => const Uuid().v4());

  final String Function() _newKey;
  final List<CartLine> _lines = [];
  String _input = '';
  int _amount = amountPresets.first;
  Map<String, NumberLimitDetail> _limits = const {};
  String? _pendingKey;

  List<CartLine> get lines => List.unmodifiable(_lines);
  String get input => _input;
  int get amount => _amount;
  bool get isEmpty => _lines.isEmpty;
  int get total => _lines.fold(0, (sum, l) => sum + l.amount);

  /// `NUMBER_LIMIT` details from the last failed purchase, by number.
  Map<String, NumberLimitDetail> get limits => _limits;

  // ---- keypad ---------------------------------------------------------

  void typeDigit(String digit) {
    if (_input.length >= 6 || !RegExp(r'^\d$').hasMatch(digit)) return;
    _input += digit;
    notifyListeners();
  }

  void backspace() {
    if (_input.isEmpty) return;
    _input = _input.substring(0, _input.length - 1);
    notifyListeners();
  }

  void clearInput() {
    if (_input.isEmpty) return;
    _input = '';
    notifyListeners();
  }

  void setAmount(int amount) {
    if (amount <= 0) return;
    _amount = amount;
    notifyListeners();
  }

  // ---- lines ----------------------------------------------------------

  /// Adds the typed number with the selected amount.
  AddResult addInput(List<DigitRule> rules) {
    final number = _input;
    if (number.length < 2 || number.length > 6) return AddResult.invalidLength;
    if (!rules.any((r) => r.digits == number.length)) {
      return AddResult.notOffered;
    }
    final result = _addOrMerge(number, _amount);
    if (result != AddResult.full) _input = '';
    notifyListeners();
    return result;
  }

  /// "ກັບເລກ": adds every unique permutation of the typed number that is not
  /// in the cart yet, with the selected amount. Nothing is added when the
  /// input is invalid or the cart would exceed [maxCartLines].
  ({AddResult result, int added}) addPermutations(List<DigitRule> rules) {
    final number = _input;
    if (number.length < 2 || number.length > 6) {
      return (result: AddResult.invalidLength, added: 0);
    }
    if (!rules.any((r) => r.digits == number.length)) {
      return (result: AddResult.notOffered, added: 0);
    }
    final existing = {for (final l in _lines) l.number};
    final fresh = [
      for (final p in uniquePermutations(number))
        if (!existing.contains(p)) p,
    ];
    if (_lines.length + fresh.length > maxCartLines) {
      return (result: AddResult.full, added: 0);
    }
    for (final p in fresh) {
      _lines.add(CartLine(p, _amount));
    }
    _input = '';
    _changed();
    return (result: AddResult.added, added: fresh.length);
  }

  void remove(String number) {
    _lines.removeWhere((l) => l.number == number);
    _changed();
  }

  void clear() {
    _lines.clear();
    _input = '';
    _changed();
  }

  AddResult _addOrMerge(String number, int amount) {
    final i = _lines.indexWhere((l) => l.number == number);
    if (i >= 0) {
      _lines[i] = CartLine(number, _lines[i].amount + amount);
      _changed(notify: false);
      return AddResult.merged;
    }
    if (_lines.length >= maxCartLines) return AddResult.full;
    _lines.add(CartLine(number, amount));
    _changed(notify: false);
    return AddResult.added;
  }

  void _changed({bool notify = true}) {
    _pendingKey = null;
    _limits = const {};
    if (notify) notifyListeners();
  }

  // ---- validation & checkout -------------------------------------------

  /// Issues per number; empty when every line is valid.
  Map<String, LineIssue> issues(List<DigitRule> rules) => {
        for (final l in _lines)
          l.number: ?validateLine(l, rules),
      };

  bool canCheckout(List<DigitRule> rules) =>
      _lines.isNotEmpty &&
      _lines.length <= maxCartLines &&
      issues(rules).isEmpty;

  List<PurchaseLine> toPurchaseLines() => [
        for (final l in _lines) PurchaseLine(number: l.number, amount: l.amount),
      ];

  /// The key for the current purchase attempt (stable until the cart changes
  /// or [completeAttempt] is called).
  String get idempotencyKey => _pendingKey ??= _newKey();

  /// Ends the current attempt: the next purchase uses a fresh key.
  void completeAttempt() => _pendingKey = null;

  void setLimits(List<NumberLimitDetail> details) {
    _limits = {for (final d in details) d.number: d};
    _pendingKey = null;
    notifyListeners();
  }

  /// Empties the cart after a successful purchase.
  void checkedOut() {
    _lines.clear();
    _input = '';
    _limits = const {};
    _pendingKey = null;
    notifyListeners();
  }
}
