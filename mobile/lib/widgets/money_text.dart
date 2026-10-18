import 'package:flutter/material.dart';

import '../theme.dart';
import '../utils/format.dart';

/// Kip amount with thousands separators and tabular figures.
class MoneyText extends StatelessWidget {
  const MoneyText(
    this.amount, {
    super.key,
    this.style,
    this.signed = false,
    this.colorize = false,
    this.textAlign,
  });

  final int amount;
  final TextStyle? style;

  /// Prefix positive amounts with `+`.
  final bool signed;

  /// Negative amounts in red, positive in green.
  final bool colorize;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    Color? color;
    if (colorize) color = amount < 0 ? Brand.red : Brand.midGreen;
    return Text(
      formatKip(amount, signed: signed),
      textAlign: textAlign,
      style: (style ?? const TextStyle()).copyWith(
        fontFeatures: tabular,
        color: color,
      ),
    );
  }
}
