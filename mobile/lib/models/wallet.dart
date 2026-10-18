import 'json.dart';

class WalletBalance {
  const WalletBalance({required this.balance, required this.held});

  factory WalletBalance.fromJson(Json json) => WalletBalance(
        balance: json.integer('balance'),
        held: json.integerOrNull('held') ?? 0,
      );

  final int balance;
  final int held;
}

enum WalletTxType {
  deposit,
  withdraw,
  purchase,
  payout,
  refund,
  commission,
  adjust,
}

class WalletTx {
  const WalletTx({
    required this.id,
    required this.type,
    required this.amount,
    required this.balanceAfter,
    required this.refType,
    required this.refId,
    required this.note,
    required this.createdAt,
  });

  factory WalletTx.fromJson(Json json) => WalletTx(
        id: json.integer('id'),
        type: enumByName(WalletTxType.values, json['type'], WalletTxType.adjust),
        amount: json.integer('amount'),
        balanceAfter: json.integer('balanceAfter'),
        refType: json.stringOrNull('refType'),
        refId: json.integerOrNull('refId'),
        note: json.stringOrNull('note'),
        createdAt: json.date('createdAt'),
      );

  final int id;
  final WalletTxType type;

  /// Signed: negative for money leaving the wallet.
  final int amount;
  final int balanceAfter;
  final String? refType;
  final int? refId;
  final String? note;
  final DateTime createdAt;
}

enum DepositStatus { pending, success, failed, expired }

class Deposit {
  const Deposit({
    required this.id,
    required this.amount,
    required this.status,
    required this.provider,
    required this.qrPayload,
    required this.expiresAt,
    required this.createdAt,
  });

  factory Deposit.fromJson(Json json) => Deposit(
        id: json.integer('id'),
        amount: json.integer('amount'),
        status: enumByName(
          DepositStatus.values,
          json['status'],
          DepositStatus.pending,
        ),
        provider: json.stringOrNull('provider') ?? '',
        qrPayload: json.stringOrNull('qrPayload') ?? '',
        expiresAt: json.dateOrNull('expiresAt'),
        createdAt: json.dateOrNull('createdAt'),
      );

  final int id;
  final int amount;
  final DepositStatus status;
  final String provider;
  final String qrPayload;
  final DateTime? expiresAt;
  final DateTime? createdAt;

  bool get isPending => status == DepositStatus.pending;
}

enum WithdrawalStatus { requested, approved, paid, rejected, failed }

class Withdrawal {
  const Withdrawal({
    required this.id,
    required this.amount,
    required this.bankName,
    required this.accountNo,
    required this.accountName,
    required this.status,
    required this.note,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Withdrawal.fromJson(Json json) => Withdrawal(
        id: json.integer('id'),
        amount: json.integer('amount'),
        bankName: json.string('bankName'),
        accountNo: json.string('accountNo'),
        accountName: json.string('accountName'),
        status: enumByName(
          WithdrawalStatus.values,
          json['status'],
          WithdrawalStatus.requested,
        ),
        note: json.stringOrNull('note'),
        createdAt: json.date('createdAt'),
        updatedAt: json.dateOrNull('updatedAt'),
      );

  final int id;
  final int amount;
  final String bankName;
  final String accountNo;
  final String accountName;
  final WithdrawalStatus status;
  final String? note;
  final DateTime createdAt;
  final DateTime? updatedAt;
}
