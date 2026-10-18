import 'json.dart';

enum DrawStatus { scheduled, open, closed, resulted, cancelled }

/// Public view of a digit rule: how a 2–6 digit number is sold and paid.
class DigitRule {
  const DigitRule({
    required this.digits,
    required this.payoutRate,
    required this.minAmount,
    required this.maxPerLine,
  });

  factory DigitRule.fromJson(Json json) => DigitRule(
        digits: json.integer('digits'),
        payoutRate: json.integer('payoutRate'),
        minAmount: json.integer('minAmount'),
        maxPerLine: json.integer('maxPerLine'),
      );

  final int digits;
  final int payoutRate;
  final int minAmount;
  final int maxPerLine;
}

class Draw {
  const Draw({
    required this.id,
    required this.drawNo,
    required this.drawDate,
    required this.salesOpenAt,
    required this.salesCloseAt,
    required this.status,
    required this.resultNumber,
    required this.resultedAt,
    required this.rules,
    required this.serverTime,
  });

  factory Draw.fromJson(Json json) => Draw(
        id: json.integer('id'),
        drawNo: json.string('drawNo'),
        drawDate: json.string('drawDate'),
        salesOpenAt: json.date('salesOpenAt'),
        salesCloseAt: json.date('salesCloseAt'),
        status: enumByName(DrawStatus.values, json['status'], DrawStatus.closed),
        resultNumber: json.stringOrNull('resultNumber'),
        resultedAt: json.dateOrNull('resultedAt'),
        rules: json['rules'] == null
            ? const []
            : (json.listOf('rules', DigitRule.fromJson)
              ..sort((a, b) => a.digits.compareTo(b.digits))),
        serverTime: json.dateOrNull('serverTime'),
      );

  final int id;
  final String drawNo;

  /// Calendar date of the draw, `YYYY-MM-DD`.
  final String drawDate;
  final DateTime salesOpenAt;
  final DateTime salesCloseAt;
  final DrawStatus status;
  final String? resultNumber;
  final DateTime? resultedAt;

  /// Sorted by number of digits.
  final List<DigitRule> rules;

  /// Server clock at response time; used to correct the local clock for
  /// countdowns.
  final DateTime? serverTime;

  bool get isOpen => status == DrawStatus.open;

  DigitRule? ruleFor(int digits) {
    for (final r in rules) {
      if (r.digits == digits) return r;
    }
    return null;
  }

  List<int> get offeredDigits => [for (final r in rules) r.digits];
}
