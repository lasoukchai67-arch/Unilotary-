import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme.dart';

/// 3×4 on-screen keypad: digits, clear and backspace. Keys are ≥ 56 px tall.
class NumericKeypad extends StatelessWidget {
  const NumericKeypad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
    required this.onClear,
  });

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    Widget digit(String d) => _Key(
          label: d,
          semanticLabel: d,
          onTap: () => onDigit(d),
          child: Text(
            d,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              fontFeatures: tabular,
              color: Brand.deepGreen,
            ),
          ),
        );

    final rows = <List<Widget>>[
      [digit('1'), digit('2'), digit('3')],
      [digit('4'), digit('5'), digit('6')],
      [digit('7'), digit('8'), digit('9')],
      [
        _Key(
          label: 'C',
          semanticLabel: S.clearNumber,
          onTap: onClear,
          child: const Icon(Icons.clear_all_rounded, color: Brand.grey),
        ),
        digit('0'),
        _Key(
          label: '⌫',
          semanticLabel: S.backspace,
          onTap: onBackspace,
          child: const Icon(Icons.backspace_outlined, color: Brand.grey),
        ),
      ],
    ];

    return Column(
      children: [
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                for (var i = 0; i < row.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(child: row[i]),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _Key extends StatelessWidget {
  const _Key({
    required this.label,
    required this.semanticLabel,
    required this.onTap,
    required this.child,
  });

  final String label;
  final String semanticLabel;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      excludeSemantics: true,
      child: Material(
        color: Brand.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          key: ValueKey('key-$label'),
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Brand.outline),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}
