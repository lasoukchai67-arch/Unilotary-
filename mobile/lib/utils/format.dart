import '../l10n/strings.dart';

/// Groups an integer with thousands separators: `1234567` → `1,234,567`.
String groupThousands(int value) {
  final negative = value < 0;
  final digits = value.abs().toString();
  final buf = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buf.write(',');
    buf.write(digits[i]);
  }
  return negative ? '-$buf' : buf.toString();
}

/// Formats an amount of kip: `250000` → `250,000 ກີບ`.
///
/// With [signed], positive amounts get a leading `+` (used for wallet
/// transactions).
String formatKip(int amount, {bool signed = false}) {
  final sign = signed && amount > 0 ? '+' : '';
  return '$sign${groupThousands(amount)} ${S.kip}';
}

/// Short amount label without the currency, for chips: `10000` → `10,000`.
String formatAmountShort(int amount) => groupThousands(amount);

/// Parses user input such as `"10,000"` or `"10 000"`; returns null if it is
/// not a positive whole number.
int? parseAmount(String input) {
  final cleaned = input.replaceAll(RegExp(r'[\s,._]'), '');
  if (cleaned.isEmpty || !RegExp(r'^\d{1,12}$').hasMatch(cleaned)) return null;
  final value = int.parse(cleaned);
  return value > 0 ? value : null;
}

String _two(int n) => n.toString().padLeft(2, '0');

/// `19/10/2026` in the device's local time.
String formatDate(DateTime dt) {
  final l = dt.toLocal();
  return '${_two(l.day)}/${_two(l.month)}/${l.year}';
}

/// `19/10/2026 14:05` in the device's local time.
String formatDateTime(DateTime dt) {
  final l = dt.toLocal();
  return '${formatDate(l)} ${_two(l.hour)}:${_two(l.minute)}';
}

/// Formats an API calendar date (`YYYY-MM-DD`) as `DD/MM/YYYY` without any
/// time-zone shifting.
String formatIsoDate(String isoDate) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(isoDate);
  if (m == null) return isoDate;
  return '${m[3]}/${m[2]}/${m[1]}';
}

/// `YYYY-MM-DD` for API bodies.
String toIsoDate(DateTime d) => '${d.year}-${_two(d.month)}-${_two(d.day)}';

/// Countdown parts for display.
class CountdownParts {
  const CountdownParts(this.days, this.hours, this.minutes, this.seconds);

  factory CountdownParts.of(Duration d) {
    final total = d.isNegative ? 0 : d.inSeconds;
    return CountdownParts(
      total ~/ 86400,
      (total % 86400) ~/ 3600,
      (total % 3600) ~/ 60,
      total % 60,
    );
  }

  final int days;
  final int hours;
  final int minutes;
  final int seconds;

  bool get isZero => days == 0 && hours == 0 && minutes == 0 && seconds == 0;

  /// `2 ມື້ 03:04:05` or `03:04:05`.
  String get label {
    final hms = '${_two(hours)}:${_two(minutes)}:${_two(seconds)}';
    return days > 0 ? '$days ${S.days} $hms' : hms;
  }
}
