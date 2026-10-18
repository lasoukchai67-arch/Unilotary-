import '../l10n/strings.dart';
import '../models/json.dart';
import '../models/ticket.dart';

/// Error codes from the API contract, plus [network] for transport failures.
abstract final class ErrorCode {
  static const validation = 'VALIDATION';
  static const unauthorized = 'UNAUTHORIZED';
  static const forbidden = 'FORBIDDEN';
  static const notFound = 'NOT_FOUND';
  static const conflict = 'CONFLICT';
  static const rateLimited = 'RATE_LIMITED';
  static const drawNotOpen = 'DRAW_NOT_OPEN';
  static const userNotAllowed = 'USER_NOT_ALLOWED';
  static const numberLimit = 'NUMBER_LIMIT';
  static const insufficientBalance = 'INSUFFICIENT_BALANCE';
  static const dailyCap = 'DAILY_CAP';
  static const pinRequired = 'PIN_REQUIRED';
  static const pinInvalid = 'PIN_INVALID';
  static const pinLocked = 'PIN_LOCKED';
  static const providerError = 'PROVIDER_ERROR';
  static const internal = 'INTERNAL';

  /// Client-side: the request never got an HTTP response (offline, timeout,
  /// DNS, TLS...). The server may or may not have processed it.
  static const network = 'NETWORK';

  /// Client-side: the response did not match the contract.
  static const badResponse = 'BAD_RESPONSE';
}

/// Every failure of the API layer is an [ApiException].
///
/// [message] is the Lao text from the server's error body (meant for
/// display), or a generic Lao message when there was none.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.statusCode = 0,
    this.details,
  });

  factory ApiException.network([Object? cause]) => ApiException(
        code: ErrorCode.network,
        message: S.errorNetwork,
        details: cause?.toString(),
      );

  /// Builds the exception from an error response body
  /// `{ error, message, details? }`.
  factory ApiException.fromResponse(int statusCode, Object? body) {
    if (body is Map && body['error'] is String) {
      final json = asJson(body);
      final message = json['message'];
      return ApiException(
        statusCode: statusCode,
        code: json['error'] as String,
        message: message is String && message.isNotEmpty
            ? message
            : S.errorGeneric,
        details: json['details'],
      );
    }
    return ApiException(
      statusCode: statusCode,
      code: switch (statusCode) {
        401 => ErrorCode.unauthorized,
        403 => ErrorCode.forbidden,
        404 => ErrorCode.notFound,
        429 => ErrorCode.rateLimited,
        _ => ErrorCode.internal,
      },
      message: S.errorGeneric,
    );
  }

  final String code;
  final String message;
  final int statusCode;
  final Object? details;

  bool get isNetwork => code == ErrorCode.network;

  /// True when retrying the very same request (same Idempotency-Key) is the
  /// right move: we cannot know whether the server applied it.
  bool get isRetryable => isNetwork || statusCode >= 500;

  /// `NUMBER_LIMIT` details: `[{ number, reason, remaining }]`.
  List<NumberLimitDetail> get numberLimits {
    final d = details;
    if (code != ErrorCode.numberLimit || d is! List) return const [];
    return [
      for (final item in d)
        if (item is Map) NumberLimitDetail.fromJson(asJson(item)),
    ];
  }

  @override
  String toString() => 'ApiException($statusCode $code: $message)';
}
