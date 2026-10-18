import 'json.dart';
import 'user.dart';

/// Cursor page: `{ items: [...], nextBefore: number | null }`.
class CursorPage<T> {
  const CursorPage({required this.items, required this.nextBefore});

  factory CursorPage.fromJson(Json json, T Function(Json) parse) =>
      CursorPage(
        items: json.listOf('items', parse),
        nextBefore: json.integerOrNull('nextBefore'),
      );

  final List<T> items;

  /// Pass as `before` to load the next (older) page; null when there is none.
  final int? nextBefore;

  bool get hasMore => nextBefore != null;
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.data,
    required this.readAt,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Json json) => AppNotification(
        id: json.integer('id'),
        title: json.string('title'),
        body: json.stringOrNull('body') ?? '',
        data: json.objectOrNull('data'),
        readAt: json.dateOrNull('readAt'),
        createdAt: json.date('createdAt'),
      );

  final int id;
  final String title;
  final String body;
  final Json? data;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isRead => readAt != null;

  AppNotification markedRead(DateTime at) => AppNotification(
        id: id,
        title: title,
        body: body,
        data: data,
        readAt: readAt ?? at,
        createdAt: createdAt,
      );
}

/// `GET /notifications` adds the unread count to the page.
class NotificationPage extends CursorPage<AppNotification> {
  const NotificationPage({
    required super.items,
    required super.nextBefore,
    required this.unread,
  });

  factory NotificationPage.fromJson(Json json) => NotificationPage(
        items: json.listOf('items', AppNotification.fromJson),
        nextBefore: json.integerOrNull('nextBefore'),
        unread: json.integerOrNull('unread') ?? 0,
      );

  final int unread;
}

/// `POST /auth/otp/request`.
class OtpRequestResult {
  const OtpRequestResult({required this.expiresInSec, this.devCode});

  factory OtpRequestResult.fromJson(Json json) => OtpRequestResult(
        expiresInSec: json.integerOrNull('expiresInSec') ?? 300,
        devCode: json.stringOrNull('devCode'),
      );

  final int expiresInSec;

  /// Only present when the server uses the mock SMS provider.
  final String? devCode;
}

/// `POST /auth/otp/verify` and `POST /auth/refresh`.
class AuthResult {
  const AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresInSec,
    required this.user,
  });

  factory AuthResult.fromJson(Json json) => AuthResult(
        accessToken: json.string('accessToken'),
        refreshToken: json.string('refreshToken'),
        expiresInSec: json.integerOrNull('expiresInSec') ?? 900,
        user: User.fromJson(json.object('user')),
      );

  final String accessToken;
  final String refreshToken;
  final int expiresInSec;
  final User user;
}

/// `GET /agent/summary`.
class AgentSummary {
  const AgentSummary({
    required this.sales,
    required this.tickets,
    required this.commissionPending,
    required this.commissionSettled,
  });

  factory AgentSummary.fromJson(Json json) => AgentSummary(
        sales: json.integer('sales'),
        tickets: json.integer('tickets'),
        commissionPending: json.integerOrNull('commissionPending') ?? 0,
        commissionSettled: json.integerOrNull('commissionSettled') ?? 0,
      );

  final int sales;
  final int tickets;
  final int commissionPending;
  final int commissionSettled;
}
