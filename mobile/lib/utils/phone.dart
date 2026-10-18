/// Lao mobile numbers: `020XXXXXXXX` (11 digits) or `030XXXXXXX` (10 digits).
final _laoMobile = RegExp(r'^(020\d{8}|030\d{7})$');

/// Normalises user input the same way the server does: strips spaces, dashes,
/// dots and brackets and converts a `+856` / `856` prefix to `0`. As a
/// convenience it also accepts the number without its leading zero
/// (`2055551234`).
String normalizePhone(String input) {
  var p = input.replaceAll(RegExp(r'[\s\-().]'), '');
  if (p.startsWith('+856')) {
    p = '0${p.substring(4)}';
  } else if (p.startsWith('856')) {
    p = '0${p.substring(3)}';
  }
  if ((p.startsWith('20') && p.length == 10) ||
      (p.startsWith('30') && p.length == 9)) {
    p = '0$p';
  }
  return p;
}

/// Whether [input] (after normalisation) is a valid Lao mobile number.
bool isValidLaoPhone(String input) => _laoMobile.hasMatch(normalizePhone(input));

/// `02055551234` → `020 5555 1234`, `0301234567` → `030 123 4567`.
String formatPhone(String phone) {
  if (phone.length == 11) {
    return '${phone.substring(0, 3)} ${phone.substring(3, 7)} ${phone.substring(7)}';
  }
  if (phone.length == 10) {
    return '${phone.substring(0, 3)} ${phone.substring(3, 6)} ${phone.substring(6)}';
  }
  return phone;
}
