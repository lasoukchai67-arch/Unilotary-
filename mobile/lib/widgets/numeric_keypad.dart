import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme.dart';

/// 3×4 on-screen keypad: digits, clear and backspace. Keys are [keyHeight]
/// tall (never below the 48 px minimum tap target).
class NumericKeypad extends StatelessWidget {
  const NumericKeypad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
    required this.onClear,
    this.keyHeight = 52,
  }) : assert(keyHeight >= 48);

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final VoidCallback onClear;
  final double keyHeight;

  @override
  Widget build(BuildContext context) {
    Widget digit(String d) => _Key(
          height: keyHeight,
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
          height: keyHeight,
          label: 'clear',
          semanticLabel: S.clearNumber,
          onTap: onClear,
          child: const Text(
            'C',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: Brand.grey,
            ),
          ),
        ),
        digit('0'),
        _Key(
          height: keyHeight,
          label: 'back',
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
            padding: const EdgeInsets.symmetric(vertical: 3),
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
    required this.height,
    required this.label,
    required this.semanticLabel,
    required this.onTap,
    required this.child,
  });

  final double height;
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
            height: height,
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
