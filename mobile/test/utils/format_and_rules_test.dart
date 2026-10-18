import 'package:flutter_test/flutter_test.dart';
import 'package:lao_lottery/screens/kyc/kyc_screen.dart';
import 'package:lao_lottery/utils/format.dart';
import 'package:lao_lottery/utils/lottery.dart';
import 'package:lao_lottery/utils/phone.dart';
import 'package:lao_lottery/widgets/pin_dialog.dart';

void main() {
  group('money formatting', () {
    test('thousands separators', () {
      expect(groupThousands(0), '0');
      expect(groupThousands(999), '999');
      expect(groupThousands(1000), '1,000');
      expect(groupThousands(250000), '250,000');
      expect(groupThousands(1234567), '1,234,567');
      expect(groupThousands(-30000), '-30,000');
    });

    test('kip suffix and signs', () {
      expect(formatKip(250000), '250,000 ກີບ');
      expect(formatKip(-30000), '-30,000 ກີບ');
      expect(formatKip(100000, signed: true), '+100,000 ກີບ');
      expect(formatKip(-5000, signed: true), '-5,000 ກີບ');
      expect(formatKip(0, signed: true), '0 ກີບ');
    });

    test('parses user amounts', () {
      expect(parseAmount('10000'), 10000);
      expect(parseAmount('10,000'), 10000);
      expect(parseAmount(' 50 000 '), 50000);
      expect(parseAmount(''), isNull);
      expect(parseAmount('0'), isNull);
      expect(parseAmount('-5'), isNull);
      expect(parseAmount('12a'), isNull);
    });

    test('dates', () {
      expect(formatIsoDate('2026-10-19'), '19/10/2026');
      expect(toIsoDate(DateTime(1990, 5, 1)), '1990-05-01');
      expect(CountdownParts.of(const Duration(seconds: 93784)).label,
          '1 ມື້ 02:03:04');
      expect(CountdownParts.of(const Duration(minutes: 5)).label, '00:05:00');
      expect(CountdownParts.of(const Duration(seconds: -3)).isZero, isTrue);
    });
  });

  group('phone', () {
    test('normalises like the server', () {
      expect(normalizePhone('020 5555 1234'), '02055551234');
      expect(normalizePhone('020-5555-1234'), '02055551234');
      expect(normalizePhone('+856 20 5555 1234'), '02055551234');
      expect(normalizePhone('8562055551234'), '02055551234');
      expect(normalizePhone('2055551234'), '02055551234');
      expect(normalizePhone('030 123 4567'), '0301234567');
    });

    test('validates Lao mobile numbers', () {
      expect(isValidLaoPhone('02055551234'), isTrue);
      expect(isValidLaoPhone('0301234567'), isTrue);
      expect(isValidLaoPhone('+8562055551234'), isTrue);
      expect(isValidLaoPhone('0205555123'), isFalse);
      expect(isValidLaoPhone('03012345678'), isFalse);
      expect(isValidLaoPhone('02155551234'), isFalse);
      expect(formatPhone('02055551234'), '020 5555 1234');
    });
  });

  group('permutations ("ກັບເລກ")', () {
    test('distinct digits', () {
      expect(uniquePermutations('12'), ['12', '21']);
      expect(
        uniquePermutations('123'),
        ['123', '132', '213', '231', '312', '321'],
      );
      expect(uniquePermutations('1234'), hasLength(24));
    });

    test('repeated digits are not duplicated', () {
      expect(uniquePermutations('11'), ['11']);
      expect(uniquePermutations('112'), ['112', '121', '211']);
      expect(uniquePermutations('1122'), hasLength(6));
      expect(uniquePermutations('482175'), hasLength(720));
    });
  });

  group('winning tiers (last N digits)', () {
    const result = '482175';

    test('a line wins when it equals the last N digits', () {
      expect(isWinning('75', result), isTrue);
      expect(isWinning('175', result), isTrue);
      expect(isWinning('2175', result), isTrue);
      expect(isWinning('482175', result), isTrue);
      expect(isWinning('57', result), isFalse);
      expect(isWinning('48', result), isFalse);
    });

    test('checkNumber reports the matching tier', () {
      final win = checkNumber('2175', result);
      expect(win.wins, isTrue);
      expect(win.matchedSuffix, 4);

      final partial = checkNumber('992175', result);
      expect(partial.wins, isFalse);
      expect(partial.matchedSuffix, 4);

      final none = checkNumber('123', result);
      expect(none.wins, isFalse);
      expect(none.matchedSuffix, 0);
    });
  });

  group('PIN and age rules', () {
    test('PIN must be 6 digits and not trivial', () {
      expect(isValidPin('482915'), isTrue);
      expect(isValidPin('48291'), isFalse);
      expect(isValidPin('48291a'), isFalse);
      expect(isWeakPin('000000'), isTrue);
      expect(isWeakPin('123456'), isTrue);
      expect(isWeakPin('654321'), isTrue);
      expect(isWeakPin('482915'), isFalse);
    });

    test('18+ check counts whole years', () {
      final today = DateTime(2026, 10, 18);
      expect(ageOn(DateTime(2008, 10, 18), today), 18);
      expect(ageOn(DateTime(2008, 10, 19), today), 17);
      expect(ageOn(DateTime(1990, 1, 1), today), 36);
    });

    test('KYC photo content type', () {
      expect(photoContentType('a.png', null), 'image/png');
      expect(photoContentType('a.JPG', null), 'image/jpeg');
      expect(photoContentType('blob', 'image/png'), 'image/png');
      expect(photoContentType('blob', null), 'image/jpeg');
      expect(photoContentType('a.heic', 'image/heic'), isNull);
    });
  });
}
