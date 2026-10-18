/// In-process implementation of the v1 API (docs/API.md) for the offline
/// investor demo (`--dart-define=DEMO_MODE=true`).
///
/// It mirrors the behaviour of `backend/src`: the same validation order and
/// error codes/HTTP statuses, per-number caps with `NUMBER_LIMIT` reasons,
/// Idempotency-Key replays, ledger with balance/held, PIN lockout, refresh
/// token rotation, and settlement by the last N digits of the result
/// (`settlement.ts`). Everything lives in memory; nothing is sent anywhere.
///
/// It is exposed as an [http.Client] ([client]) so the real `ApiClient` and
/// `LotteryApi` are used unchanged. Extra `/demo/*` routes drive the demo
/// controls (settle the current draw, top up, reset).
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Documented demo phone that logs in as an agent.
const demoAgentPhone = '02099999999';

/// Starting balance of every demo account.
const demoStartBalance = 500000;

/// Amount added by the "top up" demo control.
const demoTopUpAmount = 1000000;

// Settings (db/migrations/001_init.sql).
const _payoutAutoLimit = 5000000;
const _depositMin = 10000;
const _depositMax = 50000000;
const _withdrawMin = 50000;
const _withdrawMaxDaily = 100000000;

const _otpTtl = Duration(seconds: 300);
const _otpMaxAttempts = 5;
const _pinMaxFails = 5;
const _pinLock = Duration(minutes: 15);
const _accessTtl = Duration(minutes: 15);
const _refreshTtl = Duration(days: 30);
const _kycReviewDelay = Duration(seconds: 3);
const _withdrawalPayDelay = Duration(seconds: 4);
const _vientiane = Duration(hours: 7); // Asia/Vientiane, no DST

/// Default digit rules (admin/src/lib/drawForm.ts `DEFAULT_RULES`).
const _defaultRules = <_Rule>[
  _Rule(2, 60, 1000, 100000, 1000000),
  _Rule(3, 500, 1000, 50000, 200000),
  _Rule(4, 3000, 1000, 20000, 50000),
  _Rule(5, 20000, 1000, 10000, 10000),
  _Rule(6, 100000, 1000, 5000, 5000),
];

/// Popular numbers seeded in every open draw so NUMBER_LIMIT can be shown:
/// "99" is sold out, "68" almost, "13" is closed by the operator.
const demoSoldOutNumber = '99';
const demoNearCapNumber = '68';
const demoNearCapRemaining = 40000;
const demoClosedNumber = '13';

class DemoBackend {
  DemoBackend({
    DateTime Function()? clock,
    this.seed = 20261018,
    this.autoTimers = true,
    this.latency = Duration.zero,
  }) : _clock = clock ?? DateTime.now {
    _seedWorld();
  }

  final DateTime Function() _clock;
  final int seed;

  /// When true, background events (KYC review, withdrawal payout, draw
  /// closing) fire on real timers and bump [changes]. Tests turn this off
  /// and move the clock instead; events are also applied lazily on every
  /// request.
  final bool autoTimers;

  /// Artificial delay per request so loading states are visible.
  final Duration latency;

  /// Bumped when something changed in the background (or by a demo
  /// control) so the app can refresh what it shows.
  final ValueNotifier<int> changes = ValueNotifier<int>(0);

  late final http.Client client = MockClient(_handle);

  // ------------------------------------------------------------------ state
  late Random _random;
  final List<_User> _users = [];
  final Map<String, _Otp> _otps = {};
  final Map<String, _Session> _access = {};
  final Map<String, _Refresh> _refresh = {};
  final List<_Draw> _draws = [];
  final List<_Ticket> _tickets = [];
  final List<_Tx> _txs = [];
  final List<_Deposit> _deposits = [];
  final List<_Withdrawal> _withdrawals = [];
  final List<_Notification> _notifications = [];
  final List<_Commission> _commissions = [];
  final Map<String, int> _idempotency = {};
  final List<Timer> _timers = [];
  int _ids = 0;
  int _ticketSeq = 0;

  DateTime get _now => _clock().toUtc();
  int _nextId() => ++_ids;

  /// Wipes everything and seeds the demo world again. Existing sessions end.
  void reset() {
    _seedWorld();
  }

  /// Test hook: every demo account starts verified, so tests use this to
  /// exercise the KYC flow.
  @visibleForTesting
  void debugSetKyc(String phone, String kyc) {
    for (final u in _users) {
      if (u.phone == phone) u.kyc = kyc;
    }
  }

  /// Cancels background timers.
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    _timers.clear();
    changes.dispose();
  }

  // ============================================================ HTTP layer

  Future<http.Response> _handle(http.Request request) async {
    if (latency > Duration.zero) await Future<void>.delayed(latency);
    try {
      if (_tick()) _bump();
      final res = _route(request);
      return _json(res.status, res.body);
    } on _ApiError catch (e) {
      return _json(e.status, {
        'error': e.code,
        'message': e.message,
        'details': ?e.details,
      });
    } catch (e, st) {
      debugPrint('DemoBackend error: $e\n$st');
      return _json(500, {'error': 'INTERNAL', 'message': 'ເກີດຂໍ້ຜິດພາດພາຍໃນ'});
    }
  }

  http.Response _json(int status, Object? body) => http.Response.bytes(
        body == null ? const [] : utf8.encode(jsonEncode(body)),
        status,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );

  _Res _route(http.Request request) {
    var path = request.url.path;
    final v1 = path.indexOf('/v1/');
    if (v1 >= 0) path = path.substring(v1 + 3);
    final r = _Req(this, request, path);
    final m = request.method;
    final seg = path.split('/').where((s) => s.isNotEmpty).toList();

    int idAt(int i) {
      final v = int.tryParse(seg[i]);
      if (v == null || v <= 0) throw _ApiError.validation('id ບໍ່ຖືກຕ້ອງ');
      return v;
    }

    bool match(String method, List<String> pattern) {
      if (method != m || pattern.length != seg.length) return false;
      for (var i = 0; i < pattern.length; i++) {
        if (pattern[i] != '*' && pattern[i] != seg[i]) return false;
      }
      return true;
    }

    // Auth
    if (match('POST', ['auth', 'otp', 'request'])) return _otpRequest(r);
    if (match('POST', ['auth', 'otp', 'verify'])) return _otpVerify(r);
    if (match('POST', ['auth', 'refresh'])) return _refreshTokens(r);
    if (match('POST', ['auth', 'logout'])) return _logout(r);
    // Me
    if (match('GET', ['me'])) return _Res(200, _userView(r.user));
    if (match('POST', ['me', 'pin'])) return _setPin(r);
    if (match('PATCH', ['me', 'settings'])) return _settings(r);
    if (match('POST', ['me', 'self-exclusion'])) return _selfExclusion(r);
    if (match('POST', ['me', 'kyc'])) return _kyc(r);
    // Draws
    if (match('GET', ['draws', 'current'])) return _currentDraw();
    if (match('GET', ['draws'])) return _drawList(r);
    if (match('GET', ['draws', '*'])) return _Res(200, _drawView(_drawById(idAt(1))));
    // Tickets
    if (match('POST', ['draws', '*', 'tickets'])) {
      final user = r.user;
      return _purchaseRoute(r, user: user, drawId: idAt(1));
    }
    if (match('GET', ['tickets'])) return _ticketList(r);
    if (match('GET', ['tickets', 'verify', '*'])) return _verifyTicket(r, seg[2]);
    if (match('GET', ['tickets', '*'])) return _ticketGet(r, idAt(1));
    // Wallet
    if (match('GET', ['wallet'])) {
      final u = r.user;
      return _Res(200, {'balance': u.balance, 'held': u.held});
    }
    if (match('GET', ['wallet', 'transactions'])) return _txList(r);
    if (match('POST', ['wallet', 'deposits'])) return _createDeposit(r);
    if (match('GET', ['wallet', 'deposits', '*'])) {
      return _Res(200, _depositView(_ownDeposit(r.user, idAt(2))));
    }
    if (match('POST', ['dev', 'deposits', '*', 'simulate'])) {
      return _simulateDeposit(r, idAt(2));
    }
    if (match('POST', ['wallet', 'withdrawals'])) return _withdraw(r);
    if (match('GET', ['wallet', 'withdrawals'])) return _withdrawalList(r);
    // Notifications
    if (match('GET', ['notifications'])) return _notificationList(r);
    if (match('POST', ['notifications', 'read-all'])) {
      final u = r.user;
      for (final n in _notifications.where((n) => n.userId == u.id)) {
        n.readAt ??= _now;
      }
      return const _Res(204);
    }
    if (match('POST', ['notifications', '*', 'read'])) {
      final u = r.user;
      final id = idAt(1);
      for (final n in _notifications) {
        if (n.id == id && n.userId == u.id) n.readAt ??= _now;
      }
      return const _Res(204);
    }
    // Agent
    if (match('POST', ['agent', 'sales'])) return _agentSale(r);
    if (match('GET', ['agent', 'summary'])) return _agentSummary(r);
    // Demo controls
    if (match('POST', ['demo', 'draws', 'settle'])) {
      return _Res(200, _settleCurrentDraw(r.user));
    }
    if (match('POST', ['demo', 'topup'])) {
      final u = r.user;
      _topUp(u);
      return _Res(200, {'balance': u.balance, 'held': u.held});
    }
    if (match('POST', ['demo', 'reset'])) {
      reset();
      return const _Res(204);
    }
    throw _ApiError('NOT_FOUND', 'ບໍ່ພົບ $m $path');
  }

  // ============================================================ time & events

  /// Applies everything that became due. Returns whether anything changed.
  bool _tick() {
    final now = _now;
    var changed = false;

    for (final d in _draws) {
      if (d.status == 'scheduled' && !now.isBefore(d.openAt) && now.isBefore(d.closeAt)) {
        d.status = 'open';
        changed = true;
      }
      if ((d.status == 'open' || d.status == 'scheduled') && !now.isBefore(d.closeAt)) {
        d.status = 'closed';
        d.autoResultAt = d.closeAt.add(const Duration(minutes: 30));
        changed = true;
      }
    }
    for (final d in _draws.where((d) => d.status == 'closed').toList()) {
      final due = d.autoResultAt;
      if (due != null && !now.isBefore(due)) {
        _settleDraw(d, _randomResult());
        changed = true;
      }
    }
    if (!_draws.any((d) => d.status == 'open' || d.status == 'scheduled')) {
      final last = _draws.isEmpty ? now : _draws.last.closeAt;
      _openNextDraw(after: last.isAfter(now) ? last : now);
      changed = true;
    }

    for (final u in _users) {
      final due = u.kycReviewAt;
      if (due != null && !now.isBefore(due) && u.kyc == 'pending') {
        u.kyc = 'verified';
        u.kycReviewAt = null;
        _notify(u, 'ຢືນຢັນຕົວຕົນສຳເລັດ', 'ບັນຊີຂອງທ່ານໄດ້ຮັບການຢືນຢັນແລ້ວ. ທ່ານສາມາດຊື້ເລກໄດ້.');
        changed = true;
      }
    }
    for (final w in _withdrawals) {
      final due = w.payAt;
      if (due != null && !now.isBefore(due) && w.status == 'requested') {
        w.status = 'paid';
        w.updatedAt = now;
        w.payAt = null;
        final u = _userById(w.userId);
        u.held -= w.amount;
        _notify(u, 'ຖອນເງິນສຳເລັດ', 'ໂອນ ${_fmt(w.amount)} ກີບ ເຂົ້າບັນຊີ ${w.bankName} ແລ້ວ', {'withdrawalId': w.id});
        changed = true;
      }
    }
    for (final p in _deposits) {
      if (p.status == 'pending' && p.expiresAt.isBefore(now)) {
        p.status = 'expired';
        changed = true;
      }
    }
    return changed;
  }

  void _bump() => changes.value++;

  /// Runs [_tick] when [due] arrives (only with [autoTimers]).
  void _scheduleAt(DateTime due) {
    if (!autoTimers) return;
    var wait = due.difference(_now);
    if (wait.isNegative) wait = Duration.zero;
    // Timer durations are capped; a later request re-checks anyway.
    if (wait > const Duration(days: 20)) return;
    late final Timer timer;
    timer = Timer(wait + const Duration(milliseconds: 50), () {
      _timers.remove(timer);
      if (_tick()) _bump();
    });
    _timers.add(timer);
  }

  // ============================================================ seeding

  void _seedWorld() {
    for (final t in _timers) {
      t.cancel();
    }
    _timers.clear();
    _random = Random(seed);
    _users.clear();
    _otps.clear();
    _access.clear();
    _refresh.clear();
    _draws.clear();
    _tickets.clear();
    _txs.clear();
    _deposits.clear();
    _withdrawals.clear();
    _notifications.clear();
    _commissions.clear();
    _idempotency.clear();
    _ids = 0;
    _ticketSeq = 1200;

    final now = _now;
    final currentClose = nextDrawCloseAfter(now);
    final pastCloses = <DateTime>[];
    var t = currentClose;
    for (var i = 0; i < 10; i++) {
      t = previousDrawCloseBefore(t);
      pastCloses.add(t);
    }
    var drawNo = 136;
    for (final close in pastCloses.reversed) {
      final d = _Draw(
        id: _nextId(),
        drawNo: (drawNo++).toString().padLeft(4, '0'),
        drawDate: _localDate(close),
        openAt: previousDrawCloseBefore(close).add(const Duration(minutes: 30)),
        closeAt: close,
        rules: _defaultRules,
      );
      d.status = 'resulted';
      d.result = _randomResult();
      d.resultedAt = close.add(const Duration(minutes: 30));
      _draws.add(d);
    }
    final lastClose = pastCloses.first;
    var openAt = lastClose.add(const Duration(minutes: 30));
    if (openAt.isAfter(now)) openAt = now.subtract(const Duration(minutes: 1));
    _addDraw(
      drawNo: (drawNo).toString().padLeft(4, '0'),
      openAt: openAt,
      closeAt: currentClose,
    );
  }

  _Draw _addDraw({
    required String drawNo,
    required DateTime openAt,
    required DateTime closeAt,
  }) {
    final d = _Draw(
      id: _nextId(),
      drawNo: drawNo,
      drawDate: _localDate(closeAt),
      openAt: openAt,
      closeAt: closeAt,
      rules: _defaultRules,
    );
    d.status = _now.isBefore(openAt) ? 'scheduled' : 'open';
    // Popular numbers already bought by other customers.
    d.sold[demoSoldOutNumber] = _ruleFor(d, 2)!.defaultNumberCap;
    d.sold[demoNearCapNumber] =
        _ruleFor(d, 2)!.defaultNumberCap - demoNearCapRemaining;
    d.closedNumbers.add(demoClosedNumber);
    _draws.add(d);
    _scheduleAt(closeAt);
    return d;
  }

  _Draw _openNextDraw({required DateTime after}) {
    final last = _draws.isEmpty ? null : _draws.last;
    final no = last == null ? 1 : int.parse(last.drawNo) + 1;
    return _addDraw(
      drawNo: no.toString().padLeft(4, '0'),
      openAt: _now,
      closeAt: nextDrawCloseAfter(after),
    );
  }

  String _randomResult() =>
      _random.nextInt(1000000).toString().padLeft(6, '0');

  String _randomDigits(int n) =>
      List.generate(n, (_) => _random.nextInt(10)).join();

  /// A [digits]-long number that does not win against [result].
  String _losingNumber(String result, int digits) {
    final tail = result.substring(result.length - digits);
    while (true) {
      final n = _randomDigits(digits);
      if (n != tail) return n;
    }
  }

  _User _createUser(String phone) {
    final agent = phone == demoAgentPhone;
    final u = _User(
      id: _nextId(),
      phone: phone,
      createdAt: _now.subtract(const Duration(days: 30)),
    )
      ..fullName = agent ? 'ຕົວແທນສາທິດ' : 'ລູກຄ້າສາທິດ'
      ..role = agent ? 'agent' : 'customer'
      ..kyc = 'verified'
      ..commissionBp = agent ? 500 : 0;
    _users.add(u);
    _seedHistory(u);
    return u;
  }

  /// Three past tickets (one won and paid, two lost), a few notifications and
  /// a ledger that ends at [demoStartBalance]. Agents also get two sold
  /// tickets with settled commission.
  void _seedHistory(_User u) {
    final past = _draws.where((d) => d.status == 'resulted').toList();
    final dWin = past[past.length - 3];
    final dLost1 = past[past.length - 2];
    final dLost2 = past[past.length - 1];

    final events = <_SeedEvent>[];
    _Ticket ticket(_Draw d, List<(String, int)> lines, DateTime at,
        {bool agentSale = false}) {
      final t = _Ticket(
        id: 0,
        ticketNo: '',
        verifyCode: _verifyCode(),
        drawId: d.id,
        userId: u.id,
        agentId: agentSale ? u.id : null,
        buyerPhone: null,
        createdAt: at,
        idempotencyKey: 'seed-${u.id}-${d.id}-${at.millisecondsSinceEpoch}',
        lines: [
          for (final (n, a) in lines)
            _Line(n, a, _ruleFor(d, n.length)!.payoutRate),
        ],
      );
      for (final l in t.lines) {
        l.winAmount = d.result!.endsWith(l.number) ? l.amount * l.payoutRate : 0;
      }
      t.totalWin = t.lines.fold(0, (s, l) => s + l.winAmount);
      t.status = t.totalWin > 0 ? 'paid' : 'lost';
      return t;
    }

    final win = ticket(
      dWin,
      [
        (dWin.result!.substring(4), 2000),
        (_losingNumber(dWin.result!, 3), 1000),
      ],
      dWin.closeAt.subtract(const Duration(hours: 3)),
    );
    final lost1 = ticket(
      dLost1,
      [
        (_losingNumber(dLost1.result!, 2), 5000),
        (_losingNumber(dLost1.result!, 4), 2000),
      ],
      dLost1.closeAt.subtract(const Duration(hours: 5)),
    );
    final lost2 = ticket(
      dLost2,
      [(_losingNumber(dLost2.result!, 2), 10000)],
      dLost2.closeAt.subtract(const Duration(hours: 2)),
    );
    events
      ..add(_SeedEvent.ticket(win))
      ..add(_SeedEvent.payout(win, dWin.resultedAt!))
      ..add(_SeedEvent.ticket(lost1))
      ..add(_SeedEvent.ticket(lost2));

    if (u.role == 'agent') {
      for (final (d, amount, hoursBefore) in [
        (dLost1, 50000, 4),
        (dLost2, 30000, 1),
      ]) {
        final sale = ticket(
          d,
          [(_losingNumber(d.result!, 2), amount)],
          d.closeAt.subtract(Duration(hours: hoursBefore)),
          agentSale: true,
        );
        events
          ..add(_SeedEvent.ticket(sale))
          ..add(_SeedEvent.commission(
            sale,
            sale.total * u.commissionBp ~/ 10000,
            d.resultedAt!,
          ));
      }
    }
    events.sort((a, b) => a.at.compareTo(b.at));

    // The opening deposit makes the final balance exactly demoStartBalance.
    final net = events.fold<int>(0, (s, e) => s + e.amount);
    final depositAt = dWin.closeAt.subtract(const Duration(days: 1));
    final deposit = _Deposit(
      id: _nextId(),
      userId: u.id,
      amount: demoStartBalance - net,
      qrPayload: '',
      expiresAt: depositAt.add(const Duration(minutes: 15)),
      createdAt: depositAt,
    )..status = 'success';
    _deposits.add(deposit);
    _post(u, 'deposit', deposit.amount, 'payment', deposit.id,
        'deposit:${deposit.id}', at: depositAt);
    _notifyAt(u, 'ເຕີມເງິນສຳເລັດ', 'ໄດ້ຮັບ ${_fmt(deposit.amount)} ກີບ ເຂົ້າກະເປົາແລ້ວ',
        {'paymentId': deposit.id}, at: depositAt, read: true);

    for (final e in events) {
      final t = e.ticket;
      switch (e.kind) {
        case _SeedKind.ticket:
          _storeTicket(t, _drawById(t.drawId));
          _post(u, 'purchase', -t.total, 'ticket', t.id,
              'purchase:${u.id}:${t.idempotencyKey}', at: t.createdAt);
          if (t.agentId != null) {
            _commissions.add(_Commission(
              id: _nextId(),
              agentId: u.id,
              ticketId: t.id,
              amount: t.total * u.commissionBp ~/ 10000,
            ));
          }
        case _SeedKind.payout:
          _post(u, 'payout', t.totalWin, 'ticket', t.id, 'payout:${t.id}',
              at: e.at);
          _notifyAt(u, 'ຍິນດີນຳ! ທ່ານຖືກລາງວັນ',
              'ບິນ ${t.ticketNo}: ໂອນ ${_fmt(t.totalWin)} ກີບ ເຂົ້າກະເປົາແລ້ວ',
              {'ticketId': t.id}, at: e.at, read: true);
        case _SeedKind.commission:
          final c = _commissions.lastWhere((c) => c.ticketId == t.id);
          c.settled = true;
          _post(u, 'commission', c.amount, 'commission', c.id,
              'commission:${c.id}', at: e.at);
      }
    }

    final current = _draws.lastWhere(
      (d) => d.status == 'open' || d.status == 'scheduled',
      orElse: () => _draws.last,
    );
    _notifyAt(
      u,
      'ຍິນດີຕ້ອນຮັບສູ່ໂໝດສາທິດ',
      'ນີ້ແມ່ນຂໍ້ມູນຕົວຢ່າງ ບໍ່ແມ່ນເງິນແທ້. ລອງຊື້ເລກ, ຝາກ-ຖອນເງິນ ແລະ ອອກຜົນໃນໜ້າໂປຣໄຟລ໌.',
      null,
      at: _now.subtract(const Duration(minutes: 2)),
    );
    _notifyAt(
      u,
      'ງວດທີ ${current.drawNo} ເປີດຂາຍແລ້ວ',
      'ປິດຮັບ ${_localDateTime(current.closeAt)} (ເວລາວຽງຈັນ)',
      {'drawId': current.id},
      at: _now.subtract(const Duration(minutes: 1)),
    );
  }

  String _verifyCode() {
    const hex = '0123456789ABCDEF';
    return List.generate(8, (_) => hex[_random.nextInt(16)]).join();
  }

  String _token(String prefix) {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    final r = Random.secure();
    return '$prefix.${List.generate(40, (_) => chars[r.nextInt(chars.length)]).join()}';
  }

  // ============================================================ helpers

  _User _userById(int id) => _users.firstWhere((u) => u.id == id);

  _Draw _drawById(int id) {
    for (final d in _draws) {
      if (d.id == id) return d;
    }
    throw _ApiError('NOT_FOUND', 'ບໍ່ພົບງວດ');
  }

  _Rule? _ruleFor(_Draw d, int digits) {
    for (final r in d.rules) {
      if (r.digits == digits) return r;
    }
    return null;
  }

  void _storeTicket(_Ticket t, _Draw d) {
    t.id = _nextId();
    t.ticketNo = 'LT-${d.drawNo}-${(++_ticketSeq).toString().padLeft(6, '0')}';
    _tickets.add(t);
  }

  /// Ledger posting (lib/ledger.ts): idempotent by [key]; never negative.
  int? _post(
    _User u,
    String type,
    int amount,
    String refType,
    int refId,
    String key, {
    String? note,
    int holdDelta = 0,
    DateTime? at,
  }) {
    if (_txs.any((t) => t.key == key)) return null;
    if (u.balance + amount < 0) {
      throw _ApiError('INSUFFICIENT_BALANCE', 'ເງິນໃນກະເປົາບໍ່ພໍ', {'balance': u.balance});
    }
    u.balance += amount;
    u.held += holdDelta;
    _txs.add(_Tx(
      id: _nextId(),
      userId: u.id,
      type: type,
      amount: amount,
      balanceAfter: u.balance,
      refType: refType,
      refId: refId,
      note: note,
      createdAt: at ?? _now,
      key: key,
    ));
    return u.balance;
  }

  void _notify(
    _User u,
    String title,
    String body, [
    Map<String, Object?>? data,
  ]) =>
      _notifyAt(u, title, body, data);

  void _notifyAt(
    _User u,
    String title,
    String body,
    Map<String, Object?>? data, {
    DateTime? at,
    bool read = false,
  }) {
    final when = at ?? _now;
    _notifications.add(_Notification(
      id: _nextId(),
      userId: u.id,
      title: title,
      body: body,
      data: data,
      createdAt: when,
    )..readAt = read ? when : null);
  }

  static String _fmt(int n) {
    final s = n.abs().toString();
    final b = StringBuffer(n < 0 ? '-' : '');
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
      b.write(s[i]);
    }
    return b.toString();
  }

  static String _two(int n) => n.toString().padLeft(2, '0');

  static String _localDate(DateTime utc) {
    final l = utc.toUtc().add(_vientiane);
    return '${l.year}-${_two(l.month)}-${_two(l.day)}';
  }

  static String _localDateTime(DateTime utc) {
    final l = utc.toUtc().add(_vientiane);
    return '${_two(l.day)}/${_two(l.month)}/${l.year} ${_two(l.hour)}:${_two(l.minute)}';
  }

  /// Draws close Mon/Wed/Fri 20:00 Asia/Vientiane (13:00 UTC).
  static bool _isDrawDay(DateTime localMidnight) =>
      localMidnight.weekday == DateTime.monday ||
      localMidnight.weekday == DateTime.wednesday ||
      localMidnight.weekday == DateTime.friday;

  /// The first Mon/Wed/Fri 20:00 (Vientiane) strictly after [t].
  static DateTime nextDrawCloseAfter(DateTime t) {
    final l = t.toUtc().add(_vientiane);
    var day = DateTime.utc(l.year, l.month, l.day);
    for (var i = 0; i < 8; i++) {
      final close = day.add(const Duration(hours: 20)).subtract(_vientiane);
      if (_isDrawDay(day) && close.isAfter(t)) return close;
      day = day.add(const Duration(days: 1));
    }
    throw StateError('unreachable');
  }

  /// The last Mon/Wed/Fri 20:00 (Vientiane) strictly before [t].
  static DateTime previousDrawCloseBefore(DateTime t) {
    final l = t.toUtc().add(_vientiane);
    var day = DateTime.utc(l.year, l.month, l.day);
    for (var i = 0; i < 8; i++) {
      final close = day.add(const Duration(hours: 20)).subtract(_vientiane);
      if (_isDrawDay(day) && close.isBefore(t)) return close;
      day = day.subtract(const Duration(days: 1));
    }
    throw StateError('unreachable');
  }

  static String? _normalizePhone(Object? input) {
    if (input is! String || input.length < 8 || input.length > 20) return null;
    var p = input.replaceAll(RegExp(r'[\s-]'), '');
    if (p.startsWith('+856')) {
      p = '0${p.substring(4)}';
    } else if (p.startsWith('856')) {
      p = '0${p.substring(3)}';
    }
    return RegExp(r'^(020\d{8}|030\d{7})$').hasMatch(p) ? p : null;
  }

  String _requirePhone(Object? input) =>
      _normalizePhone(input) ??
      (throw _ApiError.validation('ເບີໂທບໍ່ຖືກຕ້ອງ (020XXXXXXXX ຫຼື 030XXXXXXX)'));

  static final _pinRe = RegExp(r'^\d{6}$');

  /// PIN check with lockout (auth.ts verifyPin).
  void _verifyPin(_User u, Object? pin) {
    if (pin == null || pin == '') throw _ApiError('PIN_REQUIRED', 'ກະລຸນາໃສ່ PIN');
    if (pin is! String || !_pinRe.hasMatch(pin)) {
      throw _ApiError.validation('PIN ຕ້ອງເປັນຕົວເລກ 6 ໂຕ');
    }
    if (u.pin == null) throw _ApiError('PIN_REQUIRED', 'ກະລຸນາຕັ້ງ PIN ກ່ອນ');
    final lockedUntil = u.pinLockedUntil;
    if (lockedUntil != null && lockedUntil.isAfter(_now)) {
      throw _ApiError('PIN_LOCKED', 'PIN ຖືກລັອກ 15 ນາທີ ເພາະໃສ່ຜິດຫຼາຍເທື່ອ');
    }
    if (pin == u.pin) {
      u.pinFailed = 0;
      u.pinLockedUntil = null;
      return;
    }
    u.pinFailed++;
    if (u.pinFailed >= _pinMaxFails) {
      u.pinFailed = 0;
      u.pinLockedUntil = _now.add(_pinLock);
      throw _ApiError('PIN_LOCKED', 'PIN ຖືກລັອກ 15 ນາທີ ເພາະໃສ່ຜິດຫຼາຍເທື່ອ');
    }
    throw _ApiError('PIN_INVALID', 'PIN ບໍ່ຖືກຕ້ອງ');
  }

  ({int limit, int? before}) _page(_Req r) {
    final q = r.request.url.queryParameters;
    final limit = q['limit'] == null ? 20 : int.tryParse(q['limit']!);
    if (limit == null || limit < 1 || limit > 100) {
      throw _ApiError.validation('limit ບໍ່ຖືກຕ້ອງ');
    }
    int? before;
    if (q['before'] != null) {
      before = int.tryParse(q['before']!);
      if (before == null || before < 1) throw _ApiError.validation('before ບໍ່ຖືກຕ້ອງ');
    }
    return (limit: limit, before: before);
  }

  Map<String, Object?> _paged<T>(
    List<T> newestFirst,
    int Function(T) id,
    Map<String, Object?> Function(T) view,
    _Req r,
  ) {
    final p = _page(r);
    final items = newestFirst
        .where((e) => p.before == null || id(e) < p.before!)
        .take(p.limit)
        .toList();
    return {
      'items': [for (final e in items) view(e)],
      'nextBefore': items.length == p.limit ? id(items.last) : null,
    };
  }

  // ============================================================ views

  static String? _iso(DateTime? d) => d?.toUtc().toIso8601String();

  Map<String, Object?> _userView(_User u) => {
        'id': u.id,
        'phone': u.phone,
        'fullName': u.fullName,
        'role': u.role,
        'kyc': u.kyc,
        'kycNote': u.kycNote,
        'status': u.status,
        'pinSet': u.pin != null,
        'dailySpendCap': u.dailySpendCap,
        'selfExcludedUntil': _iso(u.selfExcludedUntil),
        'balance': u.balance,
        'held': u.held,
        'commissionBp': u.commissionBp,
        'createdAt': _iso(u.createdAt),
      };

  Map<String, Object?> _drawView(_Draw d) => {
        'id': d.id,
        'drawNo': d.drawNo,
        'drawDate': d.drawDate,
        'salesOpenAt': _iso(d.openAt),
        'salesCloseAt': _iso(d.closeAt),
        'status': d.status,
        'resultNumber': d.result,
        'resultedAt': _iso(d.resultedAt),
        'rules': [
          for (final r in d.rules)
            {
              'digits': r.digits,
              'payoutRate': r.payoutRate,
              'minAmount': r.minAmount,
              'maxPerLine': r.maxPerLine,
            },
        ],
        'serverTime': _iso(_now),
      };

  Map<String, Object?> _ticketView(_Ticket t) => {
        'id': t.id,
        'ticketNo': t.ticketNo,
        'verifyCode': t.verifyCode,
        'drawId': t.drawId,
        'drawNo': _drawById(t.drawId).drawNo,
        'status': t.status,
        'totalAmount': t.total,
        'totalWin': t.totalWin,
        'createdAt': _iso(t.createdAt),
        'buyerPhone': t.buyerPhone,
        'lines': [
          for (final l in t.lines)
            {
              'number': l.number,
              'digits': l.number.length,
              'amount': l.amount,
              'payoutRate': l.payoutRate,
              'winAmount': l.winAmount,
            },
        ],
      };

  Map<String, Object?> _depositView(_Deposit p) => {
        'id': p.id,
        'amount': p.amount,
        'status': p.status,
        'provider': 'mock',
        'qrPayload': p.qrPayload,
        'expiresAt': _iso(p.expiresAt),
        'createdAt': _iso(p.createdAt),
      };

  Map<String, Object?> _withdrawalView(_Withdrawal w) => {
        'id': w.id,
        'amount': w.amount,
        'bankName': w.bankName,
        'accountNo': w.accountNo,
        'accountName': w.accountName,
        'status': w.status,
        'note': w.note,
        'createdAt': _iso(w.createdAt),
        'updatedAt': _iso(w.updatedAt),
      };

  // ============================================================ auth

  _Res _otpRequest(_Req r) {
    final phone = _requirePhone(r.body['phone']);
    final code = _randomDigits(6);
    _otps[phone] = _Otp(code, _now.add(_otpTtl));
    // The demo always behaves like the mock SMS provider.
    return _Res(200, {'expiresInSec': _otpTtl.inSeconds, 'devCode': code});
  }

  _Res _otpVerify(_Req r) {
    final phone = _requirePhone(r.body['phone']);
    final code = r.body['code'];
    if (code is! String || !RegExp(r'^\d{6}$').hasMatch(code)) {
      throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    }
    final otp = _otps[phone];
    if (otp == null || otp.expiresAt.isBefore(_now)) {
      _otps.remove(phone);
      throw _ApiError('UNAUTHORIZED', 'ລະຫັດໝົດອາຍຸ, ກະລຸນາຂໍລະຫັດໃໝ່');
    }
    if (otp.code != code) {
      otp.attempts++;
      if (otp.attempts >= _otpMaxAttempts) _otps.remove(phone);
      throw _ApiError('UNAUTHORIZED', 'ລະຫັດບໍ່ຖືກຕ້ອງ');
    }
    _otps.remove(phone);
    final u = _users.where((u) => u.phone == phone).firstOrNull ?? _createUser(phone);
    if (u.status != 'active') throw _ApiError('FORBIDDEN', 'ບັນຊີຖືກລະງັບ');
    return _Res(200, _issueTokens(u));
  }

  Map<String, Object?> _issueTokens(_User u) {
    final access = _token('demo-at');
    final refresh = _token('demo-rt');
    _access[access] = _Session(u.id, _now.add(_accessTtl));
    _refresh[refresh] = _Refresh(u.id, _now.add(_refreshTtl));
    return {
      'accessToken': access,
      'refreshToken': refresh,
      'expiresInSec': _accessTtl.inSeconds,
      'user': _userView(u),
    };
  }

  _Res _refreshTokens(_Req r) {
    final token = r.body['refreshToken'];
    if (token is! String || token.length < 20) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    final t = _refresh[token];
    if (t == null || t.expiresAt.isBefore(_now)) {
      throw _ApiError('UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່');
    }
    if (t.revoked) {
      // Reuse of a rotated token: end every session of this user.
      for (final other in _refresh.values.where((x) => x.userId == t.userId)) {
        other.revoked = true;
      }
      _access.removeWhere((_, s) => s.userId == t.userId);
      throw _ApiError('UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່');
    }
    final u = _userById(t.userId);
    if (u.status != 'active') throw _ApiError('FORBIDDEN', 'ບັນຊີຖືກລະງັບ');
    t.revoked = true;
    return _Res(200, _issueTokens(u));
  }

  _Res _logout(_Req r) {
    final token = r.body['refreshToken'];
    if (token is! String || token.length < 20) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    _refresh[token]?.revoked = true;
    return const _Res(204);
  }

  _User _authenticate(http.Request request) {
    final h = request.headers['authorization'];
    if (h == null || !h.startsWith('Bearer ')) {
      throw _ApiError('UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບ');
    }
    final s = _access[h.substring(7)];
    if (s == null || s.expiresAt.isBefore(_now)) {
      throw _ApiError('UNAUTHORIZED', 'session ໝົດອາຍຸ');
    }
    final u = _users.where((u) => u.id == s.userId).firstOrNull;
    if (u == null) throw _ApiError('UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບ');
    if (u.status != 'active') throw _ApiError('FORBIDDEN', 'ບັນຊີຖືກລະງັບ');
    return u;
  }

  // ============================================================ me

  _Res _setPin(_Req r) {
    final u = r.user;
    final pin = r.body['pin'];
    final current = r.body['currentPin'];
    if (pin is! String || !_pinRe.hasMatch(pin) ||
        (current != null && (current is! String || !_pinRe.hasMatch(current)))) {
      throw _ApiError.validation('PIN ຕ້ອງເປັນຕົວເລກ 6 ໂຕ');
    }
    if (u.pin != null) _verifyPin(u, current);
    u
      ..pin = pin
      ..pinFailed = 0
      ..pinLockedUntil = null;
    return const _Res(204);
  }

  _Res _settings(_Req r) {
    final u = r.user;
    final body = r.body;
    if (!body.containsKey('dailySpendCap')) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    final cap = body['dailySpendCap'];
    if (cap != null && (cap is! int || cap <= 0)) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    _verifyPin(u, body['pin']);
    u.dailySpendCap = cap as int?;
    return _Res(200, _userView(u));
  }

  _Res _selfExclusion(_Req r) {
    final u = r.user;
    final days = r.body['days'];
    if (days is! int || days < 1 || days > 365) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    _verifyPin(u, r.body['pin']);
    final now = _now;
    final base = u.selfExcludedUntil != null && u.selfExcludedUntil!.isAfter(now)
        ? u.selfExcludedUntil!
        : now;
    final proposed = now.add(Duration(days: days));
    // Can be extended but never shortened.
    u.selfExcludedUntil = proposed.isAfter(base) ? proposed : base;
    return _Res(200, _userView(u));
  }

  _Res _kyc(_Req r) {
    final u = r.user;
    final parts = r.multipart();
    final fullName = (parts.fields['fullName'] ?? '').trim();
    final birthDate = parts.fields['birthDate'] ?? '';
    final idCardNo = (parts.fields['idCardNo'] ?? '').trim();
    for (final f in parts.files) {
      if (f.field != 'photo' || (f.contentType != 'image/jpeg' && f.contentType != 'image/png')) {
        throw _ApiError.validation('ຮູບຕ້ອງເປັນ JPEG ຫຼື PNG');
      }
      if (f.bytes.length > 5 * 1024 * 1024) throw _ApiError.validation('ຮູບໃຫຍ່ເກີນ 5 MB');
    }
    if (fullName.length < 2 ||
        fullName.length > 150 ||
        !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(birthDate) ||
        idCardNo.length < 4 ||
        idCardNo.length > 40) {
      throw _ApiError.validation('ຂໍ້ມູນບໍ່ຄົບ');
    }
    if (parts.files.isEmpty) throw _ApiError.validation('ກະລຸນາແນບຮູບບັດປະຈຳຕົວ');
    final birth = DateTime.tryParse('${birthDate}T00:00:00Z');
    if (birth == null) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຄົບ');
    final today = _now.add(_vientiane);
    final adultLimit = DateTime.utc(today.year - 18, today.month, today.day);
    if (birth.isAfter(adultLimit)) throw _ApiError('USER_NOT_ALLOWED', 'ຕ້ອງມີອາຍຸ 18 ປີຂຶ້ນໄປ');
    if (u.kyc == 'verified') throw _ApiError('CONFLICT', 'ຢືນຢັນຕົວຕົນແລ້ວ');
    u
      ..fullName = fullName
      ..kyc = 'pending'
      ..kycNote = null
      ..kycReviewAt = _now.add(_kycReviewDelay);
    _scheduleAt(u.kycReviewAt!);
    return _Res(200, _userView(u));
  }

  // ============================================================ draws

  _Res _currentDraw() {
    final candidates = _draws
        .where((d) => d.status == 'open' || d.status == 'scheduled')
        .toList()
      ..sort((a, b) {
        final open = (b.status == 'open' ? 1 : 0) - (a.status == 'open' ? 1 : 0);
        return open != 0 ? open : a.closeAt.compareTo(b.closeAt);
      });
    if (candidates.isEmpty) throw _ApiError('NOT_FOUND', 'ບໍ່ພົບງວດທີ່ເປີດຂາຍ');
    return _Res(200, _drawView(candidates.first));
  }

  _Res _drawList(_Req r) {
    final q = r.request.url.queryParameters;
    final status = q['status'];
    const statuses = ['scheduled', 'open', 'closed', 'resulted', 'cancelled'];
    if (status != null && !statuses.contains(status)) throw _ApiError.validation('status ບໍ່ຖືກຕ້ອງ');
    final limit = q['limit'] == null ? 20 : int.tryParse(q['limit']!);
    if (limit == null || limit < 1 || limit > 100) throw _ApiError.validation('limit ບໍ່ຖືກຕ້ອງ');
    final list = _draws.where((d) => status == null || d.status == status).toList()
      ..sort((a, b) => b.closeAt.compareTo(a.closeAt));
    return _Res(200, {
      'items': [for (final d in list.take(limit)) _drawView(d)],
    });
  }

  // ============================================================ tickets

  static final _keyRe = RegExp(r'^[A-Za-z0-9_-]{8,80}$');

  _Res _purchaseRoute(_Req r, {required _User user, required int drawId, _User? agent, String? buyerPhone}) {
    final key = r.request.headers['idempotency-key'];
    if (key == null || !_keyRe.hasMatch(key)) {
      throw _ApiError.validation('Idempotency-Key ບໍ່ຖືກຕ້ອງ');
    }
    final result = _purchase(
      user: user,
      drawId: drawId,
      idempotencyKey: key,
      lines: r.body['lines'],
      agent: agent,
      buyerPhone: buyerPhone,
    );
    return _Res(result['replayed'] == true ? 200 : 201, result);
  }

  /// tickets.ts `purchase`, in the same order of checks.
  Map<String, Object?> _purchase({
    required _User user,
    required int drawId,
    required String idempotencyKey,
    required Object? lines,
    _User? agent,
    String? buyerPhone,
  }) {
    // 1. Lines schema: 1–50 lines of { number: 2–6 digits, amount > 0 }.
    if (lines is! List || lines.isEmpty || lines.length > 50) {
      throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    }
    final parsed = <(String, int)>[];
    for (final l in lines) {
      if (l is! Map) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
      final n = l['number'];
      final a = l['amount'];
      if (n is! String || !RegExp(r'^[0-9]{2,6}$').hasMatch(n)) {
        throw _ApiError.validation('ເລກຕ້ອງມີ 2–6 ໂຕ');
      }
      if (a is! int || a <= 0) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
      parsed.add((n, a));
    }

    // 2. Replay.
    final replayKey = '${user.id}:$idempotencyKey';
    final existingId = _idempotency[replayKey];
    if (existingId != null) {
      final t = _tickets.firstWhere((t) => t.id == existingId);
      final tx = _txs.where((x) => x.refType == 'ticket' && x.refId == t.id && x.type == 'purchase').firstOrNull;
      return {..._ticketView(t), 'balanceAfter': tx?.balanceAfter, 'replayed': true};
    }

    // 3. Draw open and in its sales window.
    final draw = _drawById(drawId);
    final now = _now;
    if (draw.status != 'open' || now.isBefore(draw.openAt) || now.isAfter(draw.closeAt)) {
      throw _ApiError('DRAW_NOT_OPEN', 'ງວດນີ້ປິດຮັບແລ້ວ');
    }

    // 4. Digit rules and min/max per line.
    for (final (n, a) in parsed) {
      final rule = _ruleFor(draw, n.length);
      if (rule == null) throw _ApiError.validation('ງວດນີ້ບໍ່ຂາຍເລກ ${n.length} ໂຕ');
      if (a < rule.minAmount || a > rule.maxPerLine) {
        throw _ApiError.validation(
          'ເລກ $n: ຈຳນວນເງິນຕ້ອງຢູ່ລະຫວ່າງ ${rule.minAmount}–${rule.maxPerLine} ກີບ',
        );
      }
    }
    final perNumber = <String, int>{};
    for (final (n, a) in parsed) {
      perNumber[n] = (perNumber[n] ?? 0) + a;
    }
    final total = parsed.fold<int>(0, (s, l) => s + l.$2);

    // 5. Per-number caps (limits.ts reserve): all or nothing.
    final failures = <Map<String, Object?>>[];
    for (final MapEntry(key: n, value: amt) in perNumber.entries) {
      if (draw.closedNumbers.contains(n)) {
        failures.add({'number': n, 'reason': 'closed', 'remaining': 0});
        continue;
      }
      final cap = draw.capOverrides[n] ?? _ruleFor(draw, n.length)?.defaultNumberCap;
      if (cap == null) {
        failures.add({'number': n, 'reason': 'norule', 'remaining': 0});
        continue;
      }
      final left = cap - (draw.sold[n] ?? 0);
      if (amt > left) {
        failures.add({'number': n, 'reason': 'full', 'remaining': max(left, 0)});
      }
    }
    if (failures.isNotEmpty) {
      throw _ApiError('NUMBER_LIMIT', 'ມີເລກທີ່ເຕັມວົງເງິນ ຫຼື ປິດຮັບ', failures);
    }

    // 6. Account checks (inside the transaction in the real backend).
    if (user.status != 'active' || user.kyc != 'verified') {
      throw _ApiError('USER_NOT_ALLOWED', 'ກະລຸນາຢືນຢັນຕົວຕົນ (KYC) ກ່ອນຊື້',
          {'reason': user.kyc != 'verified' ? 'kyc' : 'status'});
    }
    if (user.isSelfExcluded(now)) {
      throw _ApiError('USER_NOT_ALLOWED', 'ທ່ານໄດ້ພັກການຫຼິ້ນໄວ້', {'reason': 'self_excluded'});
    }
    if (user.balance < total) {
      throw _ApiError('INSUFFICIENT_BALANCE', 'ເງິນໃນກະເປົາບໍ່ພໍ', {'balance': user.balance, 'total': total});
    }
    final cap = user.dailySpendCap;
    if (cap != null) {
      final todayStart = _vientianeDayStart(now);
      final spent = _tickets
          .where((t) => t.userId == user.id && t.status != 'cancelled' && !t.createdAt.isBefore(todayStart))
          .fold<int>(0, (s, t) => s + t.total);
      if (spent + total > cap) {
        throw _ApiError('DAILY_CAP', 'ເກີນວົງເງິນຊື້ຕໍ່ມື້ທີ່ຕັ້ງໄວ້', {'cap': cap, 'spent': spent});
      }
    }

    // 7. Write.
    for (final MapEntry(key: n, value: amt) in perNumber.entries) {
      draw.sold[n] = (draw.sold[n] ?? 0) + amt;
    }
    final t = _Ticket(
      id: 0,
      ticketNo: '',
      verifyCode: _verifyCode(),
      drawId: draw.id,
      userId: user.id,
      agentId: agent?.id,
      buyerPhone: buyerPhone,
      createdAt: now,
      idempotencyKey: idempotencyKey,
      lines: [
        for (final (n, a) in parsed)
          _Line(n, a, draw.rateOverrides[n] ?? _ruleFor(draw, n.length)!.payoutRate),
      ],
    );
    _storeTicket(t, draw);
    _idempotency[replayKey] = t.id;
    final balanceAfter = _post(user, 'purchase', -total, 'ticket', t.id,
        'purchase:${user.id}:$idempotencyKey');
    if (agent != null && agent.role == 'agent') {
      _commissions.add(_Commission(
        id: _nextId(),
        agentId: agent.id,
        ticketId: t.id,
        amount: total * agent.commissionBp ~/ 10000,
      ));
    }
    return {..._ticketView(t), 'balanceAfter': balanceAfter, 'replayed': false};
  }

  static DateTime _vientianeDayStart(DateTime utc) {
    final l = utc.toUtc().add(_vientiane);
    return DateTime.utc(l.year, l.month, l.day).subtract(_vientiane);
  }

  _Res _ticketList(_Req r) {
    final u = r.user;
    final list = _tickets.where((t) => t.userId == u.id).toList()
      ..sort((a, b) => b.id.compareTo(a.id));
    return _Res(200, _paged(list, (t) => t.id, _ticketView, r));
  }

  _Res _ticketGet(_Req r, int id) {
    final u = r.user;
    final t = _tickets.where((t) => t.id == id && t.userId == u.id).firstOrNull;
    if (t == null) throw _ApiError('NOT_FOUND', 'ບໍ່ພົບບິນ');
    return _Res(200, _ticketView(t));
  }

  _Res _verifyTicket(_Req r, String ticketNo) {
    final code = (r.request.url.queryParameters['code'] ?? '').toUpperCase();
    final t = _tickets.where((t) => t.ticketNo == ticketNo && t.verifyCode == code).firstOrNull;
    if (t == null) throw _ApiError('NOT_FOUND', 'ບໍ່ພົບບິນ (ເລກບິນ ຫຼື ລະຫັດບໍ່ຖືກຕ້ອງ)');
    final v = _ticketView(t);
    return _Res(200, {
      'ticketNo': v['ticketNo'],
      'drawNo': v['drawNo'],
      'status': v['status'],
      'totalAmount': v['totalAmount'],
      'totalWin': v['totalWin'],
      'createdAt': v['createdAt'],
      'lines': [for (final l in t.lines) {'number': l.number, 'amount': l.amount}],
    });
  }

  // ============================================================ wallet

  _Res _txList(_Req r) {
    final u = r.user;
    final list = _txs.where((t) => t.userId == u.id).toList()
      ..sort((a, b) => b.id.compareTo(a.id));
    return _Res(
      200,
      _paged(list, (t) => t.id, (t) => {
            'id': t.id,
            'type': t.type,
            'amount': t.amount,
            'balanceAfter': t.balanceAfter,
            'refType': t.refType,
            'refId': t.refId,
            'note': t.note,
            'createdAt': _iso(t.createdAt),
          }, r),
    );
  }

  _Res _createDeposit(_Req r) {
    final u = r.user;
    final amount = r.body['amount'];
    if (amount is! int || amount <= 0) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    if (amount < _depositMin || amount > _depositMax) {
      throw _ApiError.validation('ເຕີມເງິນໄດ້ລະຫວ່າງ ${_fmt(_depositMin)}–${_fmt(_depositMax)} ກີບ');
    }
    final id = _nextId();
    final ref = 'MOCK-$id-${_verifyCode().toLowerCase()}';
    final p = _Deposit(
      id: id,
      userId: u.id,
      amount: amount,
      qrPayload: 'MOCKPAY|$ref|$amount|LAK',
      expiresAt: _now.add(const Duration(minutes: 15)),
      createdAt: _now,
    );
    _deposits.add(p);
    return _Res(201, _depositView(p));
  }

  _Deposit _ownDeposit(_User u, int id) {
    final p = _deposits.where((p) => p.id == id && p.userId == u.id).firstOrNull;
    if (p == null) throw _ApiError('NOT_FOUND', 'ບໍ່ພົບລາຍການເຕີມເງິນ');
    if (p.status == 'pending' && p.expiresAt.isBefore(_now)) p.status = 'expired';
    return p;
  }

  _Res _simulateDeposit(_Req r, int id) {
    final u = r.user;
    final status = r.body['status'];
    if (status != 'success' && status != 'failed') throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    final p = _ownDeposit(u, id);
    if (p.status == 'pending' || p.status == 'expired') {
      p.status = status as String;
      if (status == 'success') {
        _post(u, 'deposit', p.amount, 'payment', p.id, 'deposit:${p.id}');
        _notify(u, 'ເຕີມເງິນສຳເລັດ', 'ໄດ້ຮັບ ${_fmt(p.amount)} ກີບ ເຂົ້າກະເປົາແລ້ວ', {'paymentId': p.id});
      }
    }
    return _Res(200, _depositView(p));
  }

  _Res _withdraw(_Req r) {
    final u = r.user;
    final b = r.body;
    final amount = b['amount'];
    final bankName = b['bankName'] is String ? (b['bankName'] as String).trim() : null;
    final accountNo = b['accountNo'] is String ? (b['accountNo'] as String).trim() : null;
    final accountName = b['accountName'] is String ? (b['accountName'] as String).trim() : null;
    final pin = b['pin'];
    if (amount is! int || amount <= 0 ||
        bankName == null || bankName.length < 2 || bankName.length > 60 ||
        accountName == null || accountName.length < 2 || accountName.length > 150) {
      throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    }
    if (accountNo == null || !RegExp(r'^[0-9 -]{6,40}$').hasMatch(accountNo)) {
      throw _ApiError.validation('ເລກບັນຊີບໍ່ຖືກຕ້ອງ');
    }
    if (pin is! String || !_pinRe.hasMatch(pin)) throw _ApiError.validation('PIN ຕ້ອງເປັນຕົວເລກ 6 ໂຕ');
    _verifyPin(u, pin);
    if (amount < _withdrawMin) throw _ApiError.validation('ຖອນຂັ້ນຕ່ຳ ${_fmt(_withdrawMin)} ກີບ');
    if (u.kyc != 'verified') {
      throw _ApiError('USER_NOT_ALLOWED', 'ກະລຸນາຢືນຢັນຕົວຕົນ (KYC) ກ່ອນຖອນເງິນ', {'reason': 'kyc'});
    }
    final todayStart = _vientianeDayStart(_now);
    final today = _withdrawals
        .where((w) => w.userId == u.id && w.status != 'rejected' && w.status != 'failed' && !w.createdAt.isBefore(todayStart))
        .fold<int>(0, (s, w) => s + w.amount);
    if (today + amount > _withdrawMaxDaily) {
      throw _ApiError.validation('ເກີນວົງເງິນຖອນຕໍ່ມື້ ${_fmt(_withdrawMaxDaily)} ກີບ');
    }
    if (u.balance < amount) {
      throw _ApiError('INSUFFICIENT_BALANCE', 'ເງິນໃນກະເປົາບໍ່ພໍ', {'balance': u.balance});
    }
    final w = _Withdrawal(
      id: _nextId(),
      userId: u.id,
      amount: amount,
      bankName: bankName,
      accountNo: accountNo,
      accountName: accountName,
      createdAt: _now,
    )..payAt = _now.add(_withdrawalPayDelay);
    _withdrawals.add(w);
    _post(u, 'withdraw', -amount, 'withdrawal', w.id, 'withdraw:${w.id}', holdDelta: amount);
    _scheduleAt(w.payAt!);
    return _Res(201, _withdrawalView(w));
  }

  _Res _withdrawalList(_Req r) {
    final u = r.user;
    final list = _withdrawals.where((w) => w.userId == u.id).toList()
      ..sort((a, b) => b.id.compareTo(a.id));
    return _Res(200, _paged(list, (w) => w.id, _withdrawalView, r));
  }

  // ============================================================ notifications

  _Res _notificationList(_Req r) {
    final u = r.user;
    final list = _notifications.where((n) => n.userId == u.id).toList()
      ..sort((a, b) => b.id.compareTo(a.id));
    final page = _paged(list, (n) => n.id, (n) => {
          'id': n.id,
          'title': n.title,
          'body': n.body,
          'data': n.data,
          'readAt': _iso(n.readAt),
          'createdAt': _iso(n.createdAt),
        }, r);
    return _Res(200, {...page, 'unread': list.where((n) => n.readAt == null).length});
  }

  // ============================================================ agent

  _Res _agentSale(_Req r) {
    final me = r.user;
    if (me.role != 'agent') throw _ApiError('FORBIDDEN', 'ທ່ານບໍ່ມີສິດໃຊ້ຟັງຊັນນີ້');
    final drawId = r.body['drawId'];
    if (drawId is! int || drawId <= 0) throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
    String? buyer;
    if (r.body['buyerPhone'] != null) buyer = _requirePhone(r.body['buyerPhone']);
    return _purchaseRoute(r, user: me, drawId: drawId, agent: me, buyerPhone: buyer);
  }

  _Res _agentSummary(_Req r) {
    final me = r.user;
    if (me.role != 'agent') throw _ApiError('FORBIDDEN', 'ທ່ານບໍ່ມີສິດໃຊ້ຟັງຊັນນີ້');
    final sold = _tickets.where((t) => t.agentId == me.id && t.status != 'cancelled').toList();
    final ids = {for (final t in sold) t.id};
    final comm = _commissions.where((c) => c.agentId == me.id && ids.contains(c.ticketId));
    return _Res(200, {
      'sales': sold.fold<int>(0, (s, t) => s + t.total),
      'tickets': sold.length,
      'commissionPending': comm.where((c) => !c.settled).fold<int>(0, (s, c) => s + c.amount),
      'commissionSettled': comm.where((c) => c.settled).fold<int>(0, (s, c) => s + c.amount),
    });
  }

  // ============================================================ settlement

  /// settlement.ts `settleDraw`: a line wins when it equals the last N
  /// digits of [result]; `winAmount = floor(amount × payoutRate)`. Prizes up
  /// to `payout_auto_limit` are paid into the wallet at once, larger ones
  /// stay `won` for manual approval. Agent commissions are credited.
  Map<String, int> _settleDraw(_Draw d, String result) {
    final now = _now;
    d
      ..status = 'resulted'
      ..result = result
      ..resultedAt = now
      ..autoResultAt = null;
    var winners = 0, totalWin = 0, autoPaid = 0, pending = 0;
    final losersNotified = <int>{};
    for (final t in _tickets.where((t) => t.drawId == d.id && t.status == 'active')) {
      for (final l in t.lines) {
        l.winAmount = result.endsWith(l.number) ? l.amount * l.payoutRate : 0;
      }
      t.totalWin = t.lines.fold(0, (s, l) => s + l.winAmount);
      t.status = t.totalWin > 0 ? 'won' : 'lost';
      final u = _userById(t.userId);
      if (t.totalWin > 0) {
        winners++;
        totalWin += t.totalWin;
        if (t.totalWin <= _payoutAutoLimit) {
          _post(u, 'payout', t.totalWin, 'ticket', t.id, 'payout:${t.id}');
          t.status = 'paid';
          autoPaid++;
          _notify(u, 'ຍິນດີນຳ! ທ່ານຖືກລາງວັນ',
              'ບິນ ${t.ticketNo}: ໂອນ ${_fmt(t.totalWin)} ກີບ ເຂົ້າກະເປົາແລ້ວ', {'ticketId': t.id});
        } else {
          pending++;
          _notify(u, 'ຍິນດີນຳ! ທ່ານຖືກລາງວັນ',
              'ບິນ ${t.ticketNo} ຖືກລາງວັນ ${_fmt(t.totalWin)} ກີບ. ຍອດໃຫຍ່ຕ້ອງກວດສອບກ່ອນໂອນ.', {'ticketId': t.id});
        }
      } else if (losersNotified.add(u.id)) {
        _notify(u, 'ຜົນອອກງວດທີ ${d.drawNo}', 'ເລກທີ່ອອກ: $result', {'drawId': d.id});
      }
    }
    for (final c in _commissions.where((c) => !c.settled && c.amount > 0)) {
      final t = _tickets.firstWhere((t) => t.id == c.ticketId);
      if (t.drawId != d.id || t.status == 'cancelled') continue;
      c.settled = true;
      _post(_userById(c.agentId), 'commission', c.amount, 'commission', c.id, 'commission:${c.id}');
    }
    return {'winners': winners, 'totalWin': totalWin, 'autoPaid': autoPaid, 'pendingPayouts': pending};
  }

  // ============================================================ demo controls

  /// "ອອກຜົນງວດນີ້": closes the current draw, draws a result that makes
  /// [user]'s most recent ticket line win (if they bought one), settles the
  /// draw and opens the next one.
  Map<String, Object?> _settleCurrentDraw(_User user) {
    _Draw? draw;
    for (final d in _draws) {
      if (d.status == 'open' || d.status == 'scheduled' || d.status == 'closed') {
        draw ??= d;
      }
    }
    draw ??= _openNextDraw(after: _now);
    final originalClose = draw.closeAt;

    final mine = _tickets.where((t) => t.drawId == draw!.id && t.userId == user.id).toList()
      ..sort((a, b) => b.id.compareTo(a.id));
    final String result;
    if (mine.isNotEmpty && mine.first.lines.isNotEmpty) {
      final line = mine.first.lines.last;
      result = _randomDigits(6 - line.number.length) + line.number;
    } else {
      result = _randomResult();
    }
    if (_now.isBefore(draw.closeAt)) draw.closeAt = _now;
    draw.status = 'closed';
    final summary = _settleDraw(draw, result);

    var yourWin = 0, yourPending = 0;
    for (final t in mine) {
      if (t.status == 'paid') yourWin += t.totalWin;
      if (t.status == 'won') yourPending += t.totalWin;
    }
    final next = _draws
            .where((d) => d.status == 'open' || d.status == 'scheduled')
            .firstOrNull ??
        _openNextDraw(after: originalClose.isAfter(_now) ? originalClose : _now);
    _notify(user, 'ງວດທີ ${next.drawNo} ເປີດຂາຍແລ້ວ',
        'ປິດຮັບ ${_localDateTime(next.closeAt)} (ເວລາວຽງຈັນ)', {'drawId': next.id});
    _bump();
    return {
      'drawId': draw.id,
      'drawNo': draw.drawNo,
      'resultNumber': result,
      ...summary,
      'yourTickets': mine.length,
      'yourWin': yourWin,
      'yourPendingWin': yourPending,
      'nextDrawNo': next.drawNo,
    };
  }

  /// "ເຕີມເງິນສາທິດ": adds [demoTopUpAmount] to the wallet.
  void _topUp(_User user) {
    final id = _nextId();
    _post(user, 'adjust', demoTopUpAmount, 'demo', id, 'demo-topup:$id', note: 'ເງິນສາທິດ');
    _notify(user, 'ເຕີມເງິນສາທິດ', 'ເພີ່ມ ${_fmt(demoTopUpAmount)} ກີບ ເຂົ້າກະເປົາ (ບໍ່ແມ່ນເງິນແທ້)');
    _bump();
  }
}

// ============================================================== internals

class _Res {
  const _Res(this.status, [this.body]);

  final int status;
  final Object? body;
}

class _ApiError implements Exception {
  _ApiError(this.code, this.message, [this.details]);

  _ApiError.validation(String message) : this('VALIDATION', message);

  final String code;
  final String message;
  final Object? details;

  // backend/src/lib/errors.ts
  int get status => switch (code) {
        'VALIDATION' => 400,
        'UNAUTHORIZED' || 'PIN_REQUIRED' || 'PIN_INVALID' => 401,
        'INSUFFICIENT_BALANCE' => 402,
        'FORBIDDEN' || 'USER_NOT_ALLOWED' => 403,
        'NOT_FOUND' => 404,
        'CONFLICT' || 'DRAW_NOT_OPEN' || 'NUMBER_LIMIT' || 'DAILY_CAP' => 409,
        'PIN_LOCKED' => 423,
        'RATE_LIMITED' => 429,
        'PROVIDER_ERROR' => 502,
        _ => 500,
      };
}

class _Req {
  _Req(this.backend, this.request, this.path);

  final DemoBackend backend;
  final http.Request request;
  final String path;

  late final _User user = backend._authenticate(request);

  late final Map<String, Object?> body = () {
    if (request.bodyBytes.isEmpty) return <String, Object?>{};
    try {
      final v = jsonDecode(utf8.decode(request.bodyBytes));
      if (v is Map) return v.cast<String, Object?>();
    } on FormatException {
      // fall through
    }
    throw _ApiError.validation('ຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
  }();

  _Multipart multipart() {
    final type = request.headers['content-type'] ?? '';
    final m = RegExp(r'boundary="?([^";]+)"?').firstMatch(type);
    if (!type.startsWith('multipart/form-data') || m == null) {
      throw _ApiError.validation('ຂໍ້ມູນບໍ່ຄົບ');
    }
    return _Multipart.parse(request.bodyBytes, m.group(1)!);
  }
}

class _Multipart {
  _Multipart(this.fields, this.files);

  /// Minimal multipart/form-data parser (latin1 keeps bytes 1:1).
  factory _Multipart.parse(List<int> bytes, String boundary) {
    final text = latin1.decode(bytes);
    final fields = <String, String>{};
    final files = <_FilePart>[];
    for (var raw in text.split('--$boundary')) {
      if (raw.startsWith('--')) break;
      if (raw.startsWith('\r\n')) raw = raw.substring(2);
      final sep = raw.indexOf('\r\n\r\n');
      if (sep < 0) continue;
      final headers = raw.substring(0, sep).split('\r\n');
      var content = raw.substring(sep + 4);
      if (content.endsWith('\r\n')) content = content.substring(0, content.length - 2);
      String? name, filename, contentType;
      for (final h in headers) {
        final lower = h.toLowerCase();
        if (lower.startsWith('content-disposition:')) {
          name = RegExp(r'(?:^|;)\s*name="([^"]*)"').firstMatch(h.substring(20))?.group(1);
          filename = RegExp(r'filename="([^"]*)"').firstMatch(h)?.group(1);
        } else if (lower.startsWith('content-type:')) {
          contentType = h.substring(13).trim().toLowerCase();
        }
      }
      if (name == null) continue;
      final data = latin1.encode(content);
      if (filename != null) {
        files.add(_FilePart(name, contentType ?? 'application/octet-stream', data));
      } else {
        fields[name] = utf8.decode(data, allowMalformed: true);
      }
    }
    return _Multipart(fields, files);
  }

  final Map<String, String> fields;
  final List<_FilePart> files;
}

class _FilePart {
  _FilePart(this.field, this.contentType, this.bytes);

  final String field;
  final String contentType;
  final List<int> bytes;
}

class _Rule {
  const _Rule(this.digits, this.payoutRate, this.minAmount, this.maxPerLine,
      this.defaultNumberCap);

  final int digits;
  final int payoutRate;
  final int minAmount;
  final int maxPerLine;
  final int defaultNumberCap;
}

class _User {
  _User({required this.id, required this.phone, required this.createdAt});

  final int id;
  final String phone;
  final DateTime createdAt;
  String? fullName;
  String role = 'customer';
  String kyc = 'unsubmitted';
  String? kycNote;
  DateTime? kycReviewAt;
  String status = 'active';
  String? pin;
  int pinFailed = 0;
  DateTime? pinLockedUntil;
  int? dailySpendCap;
  DateTime? selfExcludedUntil;
  int balance = 0;
  int held = 0;
  int commissionBp = 0;

  bool isSelfExcluded(DateTime now) =>
      selfExcludedUntil != null && selfExcludedUntil!.isAfter(now);
}

class _Otp {
  _Otp(this.code, this.expiresAt);

  final String code;
  final DateTime expiresAt;
  int attempts = 0;
}

class _Session {
  _Session(this.userId, this.expiresAt);

  final int userId;
  final DateTime expiresAt;
}

class _Refresh {
  _Refresh(this.userId, this.expiresAt);

  final int userId;
  final DateTime expiresAt;
  bool revoked = false;
}

class _Draw {
  _Draw({
    required this.id,
    required this.drawNo,
    required this.drawDate,
    required this.openAt,
    required this.closeAt,
    required this.rules,
  });

  final int id;
  final String drawNo;
  final String drawDate;
  final DateTime openAt;
  DateTime closeAt;
  final List<_Rule> rules;
  String status = 'scheduled';
  String? result;
  DateTime? resultedAt;
  DateTime? autoResultAt;
  final Map<String, int> sold = {};
  final Map<String, int> capOverrides = {};
  final Map<String, int> rateOverrides = {};
  final Set<String> closedNumbers = {};
}

class _Line {
  _Line(this.number, this.amount, this.payoutRate);

  final String number;
  final int amount;
  final int payoutRate;
  int winAmount = 0;
}

class _Ticket {
  _Ticket({
    required this.id,
    required this.ticketNo,
    required this.verifyCode,
    required this.drawId,
    required this.userId,
    required this.agentId,
    required this.buyerPhone,
    required this.createdAt,
    required this.idempotencyKey,
    required this.lines,
  });

  int id;
  String ticketNo;
  final String verifyCode;
  final int drawId;
  final int userId;
  final int? agentId;
  final String? buyerPhone;
  final DateTime createdAt;
  final String idempotencyKey;
  final List<_Line> lines;
  String status = 'active';
  int totalWin = 0;

  int get total => lines.fold(0, (s, l) => s + l.amount);
}

class _Tx {
  _Tx({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    required this.balanceAfter,
    required this.refType,
    required this.refId,
    required this.note,
    required this.createdAt,
    required this.key,
  });

  final int id;
  final int userId;
  final String type;
  final int amount;
  final int balanceAfter;
  final String refType;
  final int refId;
  final String? note;
  final DateTime createdAt;
  final String key;
}

class _Deposit {
  _Deposit({
    required this.id,
    required this.userId,
    required this.amount,
    required this.qrPayload,
    required this.expiresAt,
    required this.createdAt,
  });

  final int id;
  final int userId;
  final int amount;
  final String qrPayload;
  final DateTime expiresAt;
  final DateTime createdAt;
  String status = 'pending';
}

class _Withdrawal {
  _Withdrawal({
    required this.id,
    required this.userId,
    required this.amount,
    required this.bankName,
    required this.accountNo,
    required this.accountName,
    required this.createdAt,
  }) : updatedAt = createdAt;

  final int id;
  final int userId;
  final int amount;
  final String bankName;
  final String accountNo;
  final String accountName;
  final DateTime createdAt;
  DateTime updatedAt;
  String status = 'requested';
  String? note;
  DateTime? payAt;
}

class _Notification {
  _Notification({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
    required this.data,
    required this.createdAt,
  });

  final int id;
  final int userId;
  final String title;
  final String body;
  final Map<String, Object?>? data;
  final DateTime createdAt;
  DateTime? readAt;
}

class _Commission {
  _Commission({
    required this.id,
    required this.agentId,
    required this.ticketId,
    required this.amount,
  });

  final int id;
  final int agentId;
  final int ticketId;
  final int amount;
  bool settled = false;
}

enum _SeedKind { ticket, payout, commission }

class _SeedEvent {
  _SeedEvent.ticket(this.ticket)
      : kind = _SeedKind.ticket,
        at = ticket.createdAt,
        amount = -ticket.total;
  _SeedEvent.payout(this.ticket, this.at)
      : kind = _SeedKind.payout,
        amount = ticket.totalWin;
  _SeedEvent.commission(this.ticket, this.amount, this.at)
      : kind = _SeedKind.commission;

  final _SeedKind kind;
  final _Ticket ticket;
  final DateTime at;
  final int amount;
}
