import 'json.dart';

enum KycStatus { unsubmitted, pending, verified, rejected }

enum UserRole { customer, agent, admin, finance, auditor }

enum AccountStatus { active, suspended, closed }

class User {
  const User({
    required this.id,
    required this.phone,
    required this.fullName,
    required this.role,
    required this.kyc,
    required this.kycNote,
    required this.status,
    required this.pinSet,
    required this.dailySpendCap,
    required this.selfExcludedUntil,
    required this.balance,
    required this.held,
    required this.commissionBp,
    required this.createdAt,
  });

  factory User.fromJson(Json json) => User(
        id: json.integer('id'),
        phone: json.string('phone'),
        fullName: json.stringOrNull('fullName'),
        role: enumByName(UserRole.values, json['role'], UserRole.customer),
        kyc: enumByName(KycStatus.values, json['kyc'], KycStatus.unsubmitted),
        kycNote: json.stringOrNull('kycNote'),
        status: enumByName(
          AccountStatus.values,
          json['status'],
          AccountStatus.active,
        ),
        pinSet: json.boolean('pinSet'),
        dailySpendCap: json.integerOrNull('dailySpendCap'),
        selfExcludedUntil: json.dateOrNull('selfExcludedUntil'),
        balance: json.integerOrNull('balance') ?? 0,
        held: json.integerOrNull('held') ?? 0,
        commissionBp: json.integerOrNull('commissionBp') ?? 0,
        createdAt: json.dateOrNull('createdAt'),
      );

  final int id;
  final String phone;
  final String? fullName;
  final UserRole role;
  final KycStatus kyc;
  final String? kycNote;
  final AccountStatus status;
  final bool pinSet;
  final int? dailySpendCap;
  final DateTime? selfExcludedUntil;
  final int balance;
  final int held;
  final int commissionBp;
  final DateTime? createdAt;

  bool get isAgent => role == UserRole.agent;
  bool get isKycVerified => kyc == KycStatus.verified;

  /// Self-exclusion that is still in force at [now].
  bool isSelfExcluded(DateTime now) =>
      selfExcludedUntil != null && selfExcludedUntil!.isAfter(now);
}
