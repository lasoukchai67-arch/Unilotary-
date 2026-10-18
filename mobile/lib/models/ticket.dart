import 'json.dart';

enum TicketStatus { active, won, lost, paid, cancelled }

class TicketLine {
  const TicketLine({
    required this.number,
    required this.digits,
    required this.amount,
    required this.payoutRate,
    required this.winAmount,
  });

  factory TicketLine.fromJson(Json json) {
    final number = json.string('number');
    return TicketLine(
      number: number,
      digits: json.integerOrNull('digits') ?? number.length,
      amount: json.integer('amount'),
      payoutRate: json.integerOrNull('payoutRate') ?? 0,
      winAmount: json.integerOrNull('winAmount') ?? 0,
    );
  }

  final String number;
  final int digits;
  final int amount;
  final int payoutRate;
  final int winAmount;

  bool get isWinner => winAmount > 0;
}

class Ticket {
  const Ticket({
    required this.id,
    required this.ticketNo,
    required this.verifyCode,
    required this.drawId,
    required this.drawNo,
    required this.status,
    required this.totalAmount,
    required this.totalWin,
    required this.createdAt,
    required this.buyerPhone,
    required this.lines,
  });

  factory Ticket.fromJson(Json json) => Ticket(
        id: json.integer('id'),
        ticketNo: json.string('ticketNo'),
        verifyCode: json.string('verifyCode'),
        drawId: json.integer('drawId'),
        drawNo: json.string('drawNo'),
        status: enumByName(
          TicketStatus.values,
          json['status'],
          TicketStatus.active,
        ),
        totalAmount: json.integer('totalAmount'),
        totalWin: json.integerOrNull('totalWin') ?? 0,
        createdAt: json.date('createdAt'),
        buyerPhone: json.stringOrNull('buyerPhone'),
        lines: json['lines'] == null
            ? const []
            : json.listOf('lines', TicketLine.fromJson),
      );

  final int id;
  final String ticketNo;
  final String verifyCode;
  final int drawId;
  final String drawNo;
  final TicketStatus status;
  final int totalAmount;
  final int totalWin;
  final DateTime createdAt;
  final String? buyerPhone;
  final List<TicketLine> lines;

  /// Payload encoded in the ticket QR code.
  String get qrPayload => '$ticketNo|$verifyCode';
}

/// Response of `POST /draws/:drawId/tickets` (and `/agent/sales`).
class PurchaseResult {
  const PurchaseResult({
    required this.ticket,
    required this.balanceAfter,
    required this.replayed,
  });

  factory PurchaseResult.fromJson(Json json) => PurchaseResult(
        ticket: Ticket.fromJson(json),
        balanceAfter: json.integerOrNull('balanceAfter'),
        replayed: json.boolean('replayed'),
      );

  final Ticket ticket;
  final int? balanceAfter;

  /// True when the server had already processed this Idempotency-Key.
  final bool replayed;
}

/// A line to buy.
class PurchaseLine {
  const PurchaseLine({required this.number, required this.amount});

  final String number;
  final int amount;

  Json toJson() => {'number': number, 'amount': amount};
}

/// `NUMBER_LIMIT` detail for one number.
enum NumberLimitReason { closed, full, norule, unknown }

class NumberLimitDetail {
  const NumberLimitDetail({
    required this.number,
    required this.reason,
    required this.remaining,
  });

  factory NumberLimitDetail.fromJson(Json json) => NumberLimitDetail(
        number: json.string('number'),
        reason: enumByName(
          NumberLimitReason.values,
          json['reason'],
          NumberLimitReason.unknown,
        ),
        remaining: json.integerOrNull('remaining'),
      );

  final String number;
  final NumberLimitReason reason;

  /// Amount that can still be sold on this number (for `full`).
  final int? remaining;
}
