/// Pure lottery helpers (no Flutter imports) so they are easy to unit test.
library;

/// All unique permutations of the digits in [number], in ascending order.
///
/// `"12"` → `["12", "21"]`, `"112"` → `["112", "121", "211"]`.
List<String> uniquePermutations(String number) {
  final chars = number.split('')..sort();
  final out = <String>[];
  final used = List<bool>.filled(chars.length, false);
  final current = <String>[];

  void walk() {
    if (current.length == chars.length) {
      out.add(current.join());
      return;
    }
    for (var i = 0; i < chars.length; i++) {
      if (used[i]) continue;
      // Skip duplicates: only use the first unused copy of a repeated digit.
      if (i > 0 && chars[i] == chars[i - 1] && !used[i - 1]) continue;
      used[i] = true;
      current.add(chars[i]);
      walk();
      current.removeLast();
      used[i] = false;
    }
  }

  walk();
  return out;
}

/// Result of checking a number against a 6-digit draw result.
class TierMatch {
  const TierMatch({required this.digits, required this.matchedSuffix});

  /// Length of the number that was checked (2–6).
  final int digits;

  /// Longest N (2..digits) such that the last N digits of the number equal the
  /// last N digits of the result; 0 when not even the last two match.
  final int matchedSuffix;

  /// A line wins when its whole number equals the last N digits of the result.
  bool get wins => matchedSuffix == digits;
}

/// Compares [number] (2–6 digits) with the draw's 6-digit [result].
TierMatch checkNumber(String number, String result) {
  var matched = 0;
  for (var n = 2; n <= number.length && n <= result.length; n++) {
    final a = number.substring(number.length - n);
    final b = result.substring(result.length - n);
    if (a == b) {
      matched = n;
    } else {
      break;
    }
  }
  return TierMatch(digits: number.length, matchedSuffix: matched);
}

/// Whether [number] wins against [result] (`number == last N digits`).
bool isWinning(String number, String result) =>
    number.length >= 2 &&
    number.length <= result.length &&
    result.endsWith(number);
