import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/strings.dart';
import '../models/models.dart';
import '../state/cart.dart';
import '../theme.dart';
import '../utils/format.dart';
import 'common.dart';
import 'digit_tiles.dart';
import 'money_text.dart';
import 'numeric_keypad.dart';

/// Keypad, amount chips, "add" / "ກັບເລກ" buttons and the cart list.
class CartEditor extends StatelessWidget {
  const CartEditor({super.key, required this.cart, required this.rules});

  final Cart cart;
  final List<DigitRule> rules;

  void _add(BuildContext context) {
    final result = cart.addInput(rules);
    _report(context, result);
  }

  void _permute(BuildContext context) {
    final r = cart.addPermutations(rules);
    if (r.result == AddResult.added) {
      showSnack(
        context,
        r.added == 0 ? S.permutationsNone : S.permutationsAdded(r.added),
      );
    } else {
      _report(context, r.result);
    }
  }

  void _report(BuildContext context, AddResult result) {
    switch (result) {
      case AddResult.added:
      case AddResult.merged:
        break;
      case AddResult.invalidLength:
        showSnack(context, S.enterNumber, error: true);
      case AddResult.notOffered:
        showSnack(context, S.digitsNotOffered(_offered), error: true);
      case AddResult.full:
        showSnack(context, S.tooManyLines, error: true);
    }
  }

  String get _offered => rules.map((r) => r.digits).join(', ');

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: cart,
      builder: (context, _) {
        final input = cart.input;
        final validLength =
            input.length >= 2 && rules.any((r) => r.digits == input.length);
        final rule = validLength
            ? rules.firstWhere((r) => r.digits == input.length)
            : null;
        // Compact so number, keypad, amount and both buttons fit on a
        // 360×740 phone without scrolling (smaller still on short screens).
        final short = MediaQuery.sizeOf(context).height < 760;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                child: Column(
                  children: [
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: DigitTiles(
                        input,
                        key: const ValueKey('number-input'),
                        slots: 6,
                        size: short ? 34 : 38,
                        semanticLabel: input.isEmpty
                            ? S.enterNumber
                            : input.split('').join(' '),
                      ),
                    ),
                    const SizedBox(height: 4),
                    SizedBox(
                      height: 22,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: rule == null
                            ? const Text(
                                S.enterNumber,
                                style: TextStyle(color: Brand.grey),
                              )
                            : Text(
                                '${S.digitsLabel(rule.digits)} · '
                                '${S.payoutLabel(rule.payoutRate)} · '
                                '${S.amountBelowMin(formatAmountShort(rule.minAmount))}',
                                style: const TextStyle(
                                  color: Brand.midGreen,
                                  fontWeight: FontWeight.w700,
                                  fontFeatures: tabular,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    NumericKeypad(
                      onDigit: cart.typeDigit,
                      onBackspace: cart.backspace,
                      onClear: cart.clearInput,
                      keyHeight: short ? 48 : 52,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            _AmountSelector(cart: cart),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    key: const ValueKey('add-line'),
                    onPressed: input.isEmpty ? null : () => _add(context),
                    icon: const Icon(Icons.add_rounded),
                    label: const Text(S.addLine),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Tooltip(
                    message: S.permuteHint,
                    child: OutlinedButton.icon(
                      key: const ValueKey('permute'),
                      onPressed:
                          input.length < 2 ? null : () => _permute(context),
                      icon: const Icon(Icons.shuffle_rounded),
                      label: const Text(S.permute),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _CartList(cart: cart, rules: rules),
          ],
        );
      },
    );
  }
}

class _AmountSelector extends StatelessWidget {
  const _AmountSelector({required this.cart});

  final Cart cart;

  Future<void> _custom(BuildContext context) async {
    final value = await showAmountDialog(context, initial: cart.amount);
    if (value != null) cart.setAmount(value);
  }

  @override
  Widget build(BuildContext context) {
    final isCustom = !amountPresets.contains(cart.amount);
    // One horizontally scrolling row instead of wrapping onto two lines.
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          const Padding(
            padding: EdgeInsets.only(left: 4, right: 8),
            child: Center(
              child: Text(
                S.amount,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Brand.deepGreen,
                ),
              ),
            ),
          ),
          for (final a in amountPresets)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                key: ValueKey('amount-$a'),
                label: Text(formatAmountShort(a)),
                selected: cart.amount == a,
                showCheckmark: false,
                onSelected: (_) => cart.setAmount(a),
              ),
            ),
          ChoiceChip(
            key: const ValueKey('amount-custom'),
            label: Text(
              isCustom ? formatAmountShort(cart.amount) : S.customAmount,
            ),
            avatar: const Icon(Icons.edit_rounded, size: 18),
            selected: isCustom,
            showCheckmark: false,
            onSelected: (_) => _custom(context),
          ),
        ],
      ),
    );
  }
}

/// Asks for a custom amount in kip.
Future<int?> showAmountDialog(BuildContext context, {int? initial}) {
  return showDialog<int>(
    context: context,
    builder: (ctx) => _AmountDialog(initial: initial),
  );
}

class _AmountDialog extends StatefulWidget {
  const _AmountDialog({this.initial});

  final int? initial;

  @override
  State<_AmountDialog> createState() => _AmountDialogState();
}

class _AmountDialogState extends State<_AmountDialog> {
  late final _controller = TextEditingController(
    text: widget.initial == null ? '' : '${widget.initial}',
  );
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final v = parseAmount(_controller.text);
    if (v == null) {
      setState(() => _error = S.amountInvalid);
      return;
    }
    Navigator.of(context).pop(v);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text(S.enterAmount),
      content: TextField(
        key: const ValueKey('custom-amount-field'),
        controller: _controller,
        autofocus: true,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(fontSize: 22, fontFeatures: tabular),
        decoration: InputDecoration(suffixText: S.kip, errorText: _error),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text(S.cancel),
        ),
        FilledButton(onPressed: _submit, child: const Text(S.ok)),
      ],
    );
  }
}

class _CartList extends StatelessWidget {
  const _CartList({required this.cart, required this.rules});

  final Cart cart;
  final List<DigitRule> rules;

  String? _problem(CartLine line, Map<String, LineIssue> issues) {
    final limit = cart.limits[line.number];
    if (limit != null) {
      return switch (limit.reason) {
        NumberLimitReason.closed => S.limitClosed,
        NumberLimitReason.full => limit.remaining == null || limit.remaining! <= 0
            ? S.limitFullNone
            : S.limitFull(formatKip(limit.remaining!)),
        NumberLimitReason.norule => S.limitNoRule,
        NumberLimitReason.unknown => S.errorGeneric,
      };
    }
    final issue = issues[line.number];
    if (issue == null) return null;
    return switch (issue.kind) {
      LineIssueKind.digitsNotOffered =>
        S.digitsNotOffered(rules.map((r) => r.digits).join(', ')),
      LineIssueKind.belowMin => S.amountBelowMin(formatKip(issue.limit!)),
      LineIssueKind.aboveMax => S.amountAboveMax(formatKip(issue.limit!)),
    };
  }

  @override
  Widget build(BuildContext context) {
    final lines = cart.lines;
    final issues = cart.issues(rules);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${S.cart} (${lines.length})',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Brand.deepGreen,
                    ),
                  ),
                ),
                if (lines.isNotEmpty)
                  TextButton(
                    onPressed: cart.clear,
                    child: const Text(S.clearCart),
                  ),
              ],
            ),
            if (lines.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: Text(S.cartEmpty, style: TextStyle(color: Brand.grey)),
                ),
              ),
            for (final line in lines)
              _CartRow(
                key: ValueKey('cart-line-${line.number}'),
                line: line,
                rule: _ruleFor(line.digits),
                problem: _problem(line, issues),
                onRemove: () => cart.remove(line.number),
              ),
          ],
        ),
      ),
    );
  }

  DigitRule? _ruleFor(int digits) {
    for (final r in rules) {
      if (r.digits == digits) return r;
    }
    return null;
  }
}

class _CartRow extends StatelessWidget {
  const _CartRow({
    super.key,
    required this.line,
    required this.rule,
    required this.problem,
    required this.onRemove,
  });

  final CartLine line;
  final DigitRule? rule;
  final String? problem;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          DigitTiles(line.number, size: 24),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MoneyText(
                  line.amount,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                Text(
                  rule == null
                      ? S.digitsLabel(line.digits)
                      : '${S.digitsLabel(line.digits)} · ${S.payoutLabel(rule!.payoutRate)}',
                  style: const TextStyle(color: Brand.grey, fontSize: 12),
                ),
                if (problem != null)
                  Text(
                    problem!,
                    style: const TextStyle(
                      color: Brand.red,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: '${S.delete} ${line.number}',
            onPressed: onRemove,
            icon: const Icon(Icons.delete_outline_rounded, color: Brand.red),
          ),
        ],
      ),
    );
  }
}
