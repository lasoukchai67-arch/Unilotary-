import 'package:flutter/material.dart';

import '../theme.dart';

/// A number shown as one tile per digit (draw results, keypad input).
class DigitTiles extends StatelessWidget {
  const DigitTiles(
    this.number, {
    super.key,
    this.slots,
    this.size = 44,
    this.highlightLast = 0,
    this.semanticLabel,
  });

  final String number;

  /// Total tiles to draw; empty tiles pad the left when [number] is shorter.
  /// Defaults to the number's length.
  final int? slots;
  final double size;

  /// Emphasise the last N digits (e.g. the matching tier).
  final int highlightLast;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final count = slots ?? number.length;
    final padded = number.padLeft(count);
    return Semantics(
      label: semanticLabel ?? number.split('').join(' '),
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < count; i++)
            Padding(
              padding: EdgeInsets.only(left: i == 0 ? 0 : size * 0.12),
              child: _Tile(
                digit: padded[i].trim(),
                size: size,
                highlighted: highlightLast > 0 && i >= count - highlightLast,
              ),
            ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.digit,
    required this.size,
    required this.highlighted,
  });

  final String digit;
  final double size;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final empty = digit.isEmpty;
    return Container(
      width: size,
      height: size * 1.2,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: empty
            ? Brand.white
            : (highlighted ? Brand.mint : Brand.deepGreen),
        borderRadius: BorderRadius.circular(size * 0.22),
        border: Border.all(
          color: empty ? Brand.outline : Colors.transparent,
          width: 1.5,
        ),
      ),
      child: Text(
        digit,
        style: TextStyle(
          fontSize: size * 0.6,
          fontWeight: FontWeight.w700,
          fontFeatures: tabular,
          color: highlighted ? Brand.deepGreen : Brand.white,
          height: 1.1,
        ),
      ),
    );
  }
}
