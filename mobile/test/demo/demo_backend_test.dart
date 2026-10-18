import 'package:flutter_test/flutter_test.dart';
import 'package:lao_lottery/api/api_exception.dart';
import 'package:lao_lottery/api/lottery_api.dart';
import 'package:lao_lottery/api/token_store.dart';
import 'package:lao_lottery/demo/demo_backend.dart';
import 'package:lao_lottery/demo/demo_mode.dart';
import 'package:lao_lottery/models/models.dart';

const customer = '02055550001';

void main() {
  // Sunday 18 Oct 2026, 12:00 in Vientiane.
  late DateTime now;
  late DemoController demo;

  setUp(() {
    now = DateTime.utc(2026, 10, 18, 5);
    demo = DemoController(
      backend: DemoBackend(clock: () => now, autoTimers: false),
    );
  });

  tearDown(() => demo.dispose());

  Future<LotteryApi> login(String phone) async {
    final api = demo.createApi();
    final otp = await api.requestOtp(phone);
    expect(otp.devCode, matches(RegExp(r'^\d{6}$')));
    await api.verifyOtp(phone, otp.devCode!);
    return api;
  }

  Future<ApiException> fails(Future<Object?> call) async {
    try {
      await call;
    } on ApiException catch (e) {
      return e;
    }
    fail('expected an ApiException');
  }

  Future<Draw> currentDraw(LotteryApi api) async => (await api.currentDraw())!;

  group('draw calendar', () {
    test('draws close Mon/Wed/Fri 20:00 Asia/Vientiane', () {
      // Sunday → Monday 13:00 UTC.
      expect(DemoBackend.nextDrawCloseAfter(DateTime.utc(2026, 10, 18, 5)),
          DateTime.utc(2026, 10, 19, 13));
      expect(DemoBackend.nextDrawCloseAfter(DateTime.utc(2026, 10, 19, 12, 59)),
          DateTime.utc(2026, 10, 19, 13));
      // Exactly at the close → the next one (Wednesday).
      expect(DemoBackend.nextDrawCloseAfter(DateTime.utc(2026, 10, 19, 13)),
          DateTime.utc(2026, 10, 21, 13));
      // Friday evening → Monday.
      expect(DemoBackend.nextDrawCloseAfter(DateTime.utc(2026, 10, 23, 14)),
          DateTime.utc(2026, 10, 26, 13));
      expect(DemoBackend.previousDrawCloseBefore(DateTime.utc(2026, 10, 19, 13)),
          DateTime.utc(2026, 10, 16, 13));
    });

    test('seed: one open draw with default rules and 10 past results', () async {
      final api = demo.createApi();
      final draw = await currentDraw(api);
      expect(draw.status, DrawStatus.open);
      expect(draw.salesCloseAt, DateTime.utc(2026, 10, 19, 13));
      expect(draw.drawDate, '2026-10-19');
      expect(draw.serverTime, now);
      expect(
        [for (final r in draw.rules) (r.digits, r.payoutRate, r.maxPerLine)],
        [(2, 60, 100000), (3, 500, 50000), (4, 3000, 20000), (5, 20000, 10000), (6, 100000, 5000)],
      );
      final past = await api.draws(status: DrawStatus.resulted, limit: 50);
      expect(past, hasLength(10));
      for (final d in past) {
        expect(d.resultNumber, matches(RegExp(r'^\d{6}$')));
        expect(d.salesCloseAt.isBefore(now), isTrue);
        expect([DateTime.monday, DateTime.wednesday, DateTime.friday],
            contains(d.salesCloseAt.weekday));
      }
      // Newest first, sequential draw numbers.
      expect(int.parse(past.first.drawNo) + 1, int.parse(draw.drawNo));
      expect(past.first.salesCloseAt.isAfter(past.last.salesCloseAt), isTrue);
    });
  });

  group('accounts', () {
    test('any phone logs in as a verified customer with demo history', () async {
      final api = await login('+856 20 5555 0001');
      final me = await api.me();
      expect(me.phone, customer);
      expect(me.role, UserRole.customer);
      expect(me.kyc, KycStatus.verified);
      expect(me.pinSet, isFalse);
      expect(me.balance, demoStartBalance);

      final tickets = await api.tickets(limit: 20);
      expect(tickets.items.map((t) => t.status),
          [TicketStatus.lost, TicketStatus.lost, TicketStatus.paid]);
      final won = tickets.items.last;
      expect(won.totalWin, 120000);
      expect(won.lines.first.winAmount, 120000);
      expect(won.verifyCode, matches(RegExp(r'^[0-9A-F]{8}$')));
      expect(won.ticketNo, matches(RegExp(r'^LT-\d{4}-\d{6}$')));

      final txs = await api.transactions(limit: 100);
      expect(txs.items.first.balanceAfter, demoStartBalance);
      expect(txs.items.map((t) => t.type),
          [WalletTxType.purchase, WalletTxType.purchase, WalletTxType.payout,
           WalletTxType.purchase, WalletTxType.deposit]);

      final page1 = await api.transactions(limit: 2);
      expect(page1.items, hasLength(2));
      final page2 = await api.transactions(limit: 2, before: page1.nextBefore);
      expect(page2.items.first.id, lessThan(page1.items.last.id));

      final notes = await api.notifications(limit: 20);
      expect(notes.items.length, greaterThanOrEqualTo(3));
      expect(notes.unread, 2);
    });

    test('020 9999 9999 is an agent with sales and commission', () async {
      final api = await login('020 9999 9999');
      final me = await api.me();
      expect(me.role, UserRole.agent);
      expect(me.balance, demoStartBalance);
      final s = await api.agentSummary();
      expect(s.tickets, 2);
      expect(s.sales, 80000);
      expect(s.commissionSettled, 4000); // 5 % of 80,000
      expect(s.commissionPending, 0);
    });

    test('customers cannot use agent endpoints', () async {
      final api = await login(customer);
      expect((await fails(api.agentSummary())).code, ErrorCode.forbidden);
    });

    test('wrong OTP, refresh rotation and reuse detection', () async {
      final api = demo.createApi();
      await api.requestOtp(customer);
      final wrong = await fails(api.verifyOtp(customer, '000000'));
      expect(wrong.code, ErrorCode.unauthorized);

      final otp = await api.requestOtp(customer);
      final auth = await api.verifyOtp(customer, otp.devCode!);
      final first = auth.refreshToken;

      // Force a refresh by expiring the access token (15 min).
      now = now.add(const Duration(minutes: 16));
      expect((await api.me()).phone, customer);
      final rotated = api.client.tokens!.refreshToken;
      expect(rotated, isNot(first));

      // Reusing the old refresh token ends every session of the user.
      final thief = demo.createApi();
      await thief.client.setTokens(
        AuthTokens(accessToken: api.client.tokens!.accessToken, refreshToken: first),
      );
      now = now.add(const Duration(minutes: 16));
      expect((await fails(thief.me())).code, ErrorCode.unauthorized);
      expect((await fails(api.me())).code, ErrorCode.unauthorized);
      expect(api.client.hasSession, isFalse);
    });

    test('PIN: set, change with current PIN, lockout after 5 wrong', () async {
      final api = await login(customer);
      await api.setPin('482915');
      expect((await api.me()).pinSet, isTrue);
      expect((await fails(api.setPin('719304'))).code, ErrorCode.pinRequired);
      await api.setPin('719304', currentPin: '482915');

      for (var i = 0; i < 4; i++) {
        final e = await fails(api.updateSettings(dailySpendCap: 1000, pin: '111111'));
        expect(e.code, ErrorCode.pinInvalid);
        expect(e.statusCode, 401);
      }
      final locked = await fails(api.updateSettings(dailySpendCap: 1000, pin: '111111'));
      expect(locked.code, ErrorCode.pinLocked);
      expect(locked.statusCode, 423);
      // Even the right PIN is refused while locked...
      expect((await fails(api.updateSettings(dailySpendCap: 1000, pin: '719304'))).code,
          ErrorCode.pinLocked);
      // ...until 15 minutes have passed.
      now = now.add(const Duration(minutes: 16));
      final user = await api.updateSettings(dailySpendCap: 20000, pin: '719304');
      expect(user.dailySpendCap, 20000);
    });

    test('KYC submit is auto-approved after about 3 s with a notification', () async {
      final api = await login(customer);
      demo.backend.debugSetKyc(customer, 'unsubmitted');
      final before = (await api.notifications(limit: 1)).unread;

      final tooYoung = await fails(api.submitKyc(
        fullName: 'ທົດສອບ ສາທິດ',
        birthDate: '2010-01-01',
        idCardNo: 'DEMO-0001',
        photoBytes: const [0xFF, 0xD8, 0xFF],
        photoFilename: 'id.jpg',
        photoContentType: 'image/jpeg',
      ));
      expect(tooYoung.code, ErrorCode.userNotAllowed);

      final pending = await api.submitKyc(
        fullName: 'ທົດສອບ ສາທິດ',
        birthDate: '1990-05-01',
        idCardNo: 'DEMO-0001',
        photoBytes: const [0xFF, 0xD8, 0xFF],
        photoFilename: 'id.jpg',
        photoContentType: 'image/jpeg',
      );
      expect(pending.kyc, KycStatus.pending);
      expect(pending.fullName, 'ທົດສອບ ສາທິດ');

      now = now.add(const Duration(seconds: 2));
      expect((await api.me()).kyc, KycStatus.pending);
      now = now.add(const Duration(seconds: 2));
      expect((await api.me()).kyc, KycStatus.verified);
      expect((await api.notifications(limit: 1)).unread, before + 1);
    });
  });

  group('buying', () {
    test('purchase charges the wallet and returns the ticket', () async {
      final api = await login(customer);
      final draw = await currentDraw(api);
      final r = await api.purchase(
        drawId: draw.id,
        lines: const [
          PurchaseLine(number: '27', amount: 10000),
          PurchaseLine(number: '583', amount: 5000),
        ],
        idempotencyKey: 'demo-key-0001',
      );
      expect(r.replayed, isFalse);
      expect(r.balanceAfter, demoStartBalance - 15000);
      expect(r.ticket.status, TicketStatus.active);
      expect(r.ticket.drawNo, draw.drawNo);
      expect(r.ticket.lines.map((l) => (l.number, l.digits, l.payoutRate)),
          [('27', 2, 60), ('583', 3, 500)]);
      expect((await api.wallet()).balance, demoStartBalance - 15000);
      expect((await api.ticket(r.ticket.id)).verifyCode, r.ticket.verifyCode);
      expect((await api.tickets(limit: 1)).items.single.id, r.ticket.id);
    });

    test('retrying with the same Idempotency-Key replays without charging', () async {
      final api = await login(customer);
      final draw = await currentDraw(api);
      const lines = [PurchaseLine(number: '27', amount: 10000)];
      final first = await api.purchase(drawId: draw.id, lines: lines, idempotencyKey: 'retry-key-0001');
      final again = await api.purchase(drawId: draw.id, lines: lines, idempotencyKey: 'retry-key-0001');
      expect(again.replayed, isTrue);
      expect(again.ticket.id, first.ticket.id);
      expect(again.balanceAfter, first.balanceAfter);
      expect((await api.wallet()).balance, demoStartBalance - 10000);
      expect((await api.tickets(limit: 50)).items.where((t) => t.drawId == draw.id), hasLength(1));

      final bad = await fails(api.purchase(drawId: draw.id, lines: lines, idempotencyKey: 'short'));
      expect(bad.code, ErrorCode.validation);
    });

    test('per-number caps: closed, sold out and nearly full numbers', () async {
      final api = await login(customer);
      final draw = await currentDraw(api);
      final e = await fails(api.purchase(
        drawId: draw.id,
        lines: const [
          PurchaseLine(number: demoSoldOutNumber, amount: 1000),
          PurchaseLine(number: demoNearCapNumber, amount: 50000),
          PurchaseLine(number: demoClosedNumber, amount: 1000),
          PurchaseLine(number: '27', amount: 1000),
        ],
        idempotencyKey: 'limit-key-0001',
      ));
      expect(e.code, ErrorCode.numberLimit);
      expect(e.statusCode, 409);
      final byNumber = {for (final d in e.numberLimits) d.number: d};
      expect(byNumber.keys, unorderedEquals([demoSoldOutNumber, demoNearCapNumber, demoClosedNumber]));
      expect(byNumber[demoSoldOutNumber]!.reason, NumberLimitReason.full);
      expect(byNumber[demoSoldOutNumber]!.remaining, 0);
      expect(byNumber[demoNearCapNumber]!.reason, NumberLimitReason.full);
      expect(byNumber[demoNearCapNumber]!.remaining, demoNearCapRemaining);
      expect(byNumber[demoClosedNumber]!.reason, NumberLimitReason.closed);
      // All or nothing: nothing was charged.
      expect((await api.wallet()).balance, demoStartBalance);

      // Buying exactly the remaining amount works, then the number is full.
      await api.purchase(
        drawId: draw.id,
        lines: const [PurchaseLine(number: demoNearCapNumber, amount: demoNearCapRemaining)],
        idempotencyKey: 'limit-key-0002',
      );
      final full = await fails(api.purchase(
        drawId: draw.id,
        lines: const [PurchaseLine(number: demoNearCapNumber, amount: 1000)],
        idempotencyKey: 'limit-key-0003',
      ));
      expect(full.numberLimits.single.remaining, 0);
    });

    test('rule validation: min amount, max per line', () async {
      final api = await login(customer);
      final draw = await currentDraw(api);
      for (final line in const [
        PurchaseLine(number: '27', amount: 500),
        PurchaseLine(number: '27', amount: 100001),
        PurchaseLine(number: '123456', amount: 6000),
      ]) {
        final e = await fails(api.purchase(drawId: draw.id, lines: [line], idempotencyKey: 'rule-key-${line.amount}'));
        expect(e.code, ErrorCode.validation, reason: '${line.number} ${line.amount}');
        expect(e.statusCode, 400);
      }
    });

    test('INSUFFICIENT_BALANCE when the total exceeds the wallet', () async {
      final api = await login(customer);
      final draw = await currentDraw(api);
      final e = await fails(api.purchase(
        drawId: draw.id,
        lines: [
          for (final n in ['10', '11', '12', '14', '15', '16'])
            PurchaseLine(number: n, amount: 100000),
        ],
        idempotencyKey: 'balance-key-01',
      ));
      expect(e.code, ErrorCode.insufficientBalance);
      expect(e.statusCode, 402);
      expect((await api.wallet()).balance, demoStartBalance);
    });

    test('daily cap and self-exclusion block purchases', () async {
      final api = await login(customer);
      final draw = await currentDraw(api);
      await api.setPin('482915');
      await api.updateSettings(dailySpendCap: 20000, pin: '482915');
      await api.purchase(
        drawId: draw.id,
        lines: const [PurchaseLine(number: '27', amount: 15000)],
        idempotencyKey: 'cap-key-0001',
      );
      final cap = await fails(api.purchase(
        drawId: draw.id,
        lines: const [PurchaseLine(number: '28', amount: 10000)],
        idempotencyKey: 'cap-key-0002',
      ));
      expect(cap.code, ErrorCode.dailyCap);

      final user = await api.selfExclude(days: 7, pin: '482915');
      expect(user.selfExcludedUntil, now.add(const Duration(days: 7)));
      final excluded = await fails(api.purchase(
        drawId: draw.id,
        lines: const [PurchaseLine(number: '29', amount: 1000)],
        idempotencyKey: 'cap-key-0003',
      ));
      expect(excluded.code, ErrorCode.userNotAllowed);
    });

    test('a closed draw refuses sales (DRAW_NOT_OPEN)', () async {
      final api = await login(customer);
      final draw = await currentDraw(api);
      now = draw.salesCloseAt.add(const Duration(minutes: 1));
      final e = await fails(api.purchase(
        drawId: draw.id,
        lines: const [PurchaseLine(number: '27', amount: 1000)],
        idempotencyKey: 'closed-key-01',
      ));
      expect(e.code, ErrorCode.drawNotOpen);
      // A new draw is already on sale.
      final next = await currentDraw(api);
      expect(next.id, isNot(draw.id));
      expect(next.status, DrawStatus.open);
      // 30 minutes after closing the old draw gets its result.
      now = now.add(const Duration(minutes: 30));
      final old = await api.draw(draw.id);
      expect(old.status, DrawStatus.resulted);
      expect(old.resultNumber, matches(RegExp(r'^\d{6}$')));
    });
  });

  group('settlement (demo draw control)', () {
    test('the latest line wins; prizes are last-N digits × payout rate', () async {
      final api = await login(customer);
      final draw = await currentDraw(api);
      final t = await api.purchase(
        drawId: draw.id,
        lines: const [
          PurchaseLine(number: '45', amount: 10000),
          PurchaseLine(number: '345', amount: 2000),
        ],
        idempotencyKey: 'settle-key-01',
      );
      final balanceBefore = (await api.wallet()).balance;

      final r = await api.demoSettleDraw();
      expect(r.drawNo, draw.drawNo);
      expect(r.resultNumber, endsWith('345'));
      // "45" (2 digits × 60) and "345" (3 digits × 500) both match.
      const prize = 10000 * 60 + 2000 * 500;
      expect(r.yourWin, prize);
      expect(r.winners, 1);
      expect(r.totalWin, prize);
      expect(r.autoPaid, 1);

      final settled = await api.ticket(t.ticket.id);
      expect(settled.status, TicketStatus.paid);
      expect(settled.totalWin, prize);
      expect(settled.lines.map((l) => l.winAmount), [600000, 1000000]);
      expect((await api.wallet()).balance, balanceBefore + prize);
      final payout = (await api.transactions(limit: 1)).items.single;
      expect(payout.type, WalletTxType.payout);
      expect(payout.amount, prize);
      expect((await api.notifications(limit: 1)).items.single.title, contains('ງວດທີ'));

      final resulted = await api.draw(draw.id);
      expect(resulted.status, DrawStatus.resulted);
      expect(resulted.resultNumber, r.resultNumber);
      final next = await currentDraw(api);
      expect(next.drawNo, r.nextDrawNo);
      expect(int.parse(next.drawNo), int.parse(draw.drawNo) + 1);
      expect(next.isOpen, isTrue);
      expect(next.salesCloseAt, DateTime.utc(2026, 10, 21, 13));
    });

    test('a prize above payout_auto_limit stays won (pending approval)', () async {
      final api = await login(customer);
      final draw = await currentDraw(api);
      final t = await api.purchase(
        drawId: draw.id,
        lines: const [PurchaseLine(number: '123456', amount: 5000)],
        idempotencyKey: 'big-win-key-1',
      );
      final balance = (await api.wallet()).balance;
      final r = await api.demoSettleDraw();
      expect(r.resultNumber, '123456');
      expect(r.yourPendingWin, 5000 * 100000);
      expect(r.pendingPayouts, 1);
      expect(r.yourWin, 0);
      final won = await api.ticket(t.ticket.id);
      expect(won.status, TicketStatus.won);
      expect(won.totalWin, 500000000);
      expect((await api.wallet()).balance, balance);
      final notes = await api.notifications(limit: 5);
      expect(notes.items.any((n) => n.body.contains('ຍອດໃຫຍ່ຕ້ອງກວດສອບກ່ອນໂອນ')), isTrue);
    });

    test('losing tickets and agent commission on settlement', () async {
      final agent = await login(demoAgentPhone);
      final draw = await currentDraw(agent);
      final sale = await agent.agentSale(
        drawId: draw.id,
        buyerPhone: '030 123 4567',
        lines: const [PurchaseLine(number: '27', amount: 20000)],
        idempotencyKey: 'agent-key-001',
      );
      expect(sale.ticket.buyerPhone, '0301234567');
      var s = await agent.agentSummary();
      expect(s.commissionPending, 1000); // 5 % of 20,000

      // The customer's latest line decides the result (…0815), so the
      // agent's "27" loses.
      final cust = await login(customer);
      await cust.purchase(
        drawId: draw.id,
        lines: const [PurchaseLine(number: '0815', amount: 1000)],
        idempotencyKey: 'cust-key-0001',
      );
      final balance = (await agent.wallet()).balance;
      final r = await cust.demoSettleDraw();
      expect(r.resultNumber, endsWith('0815'));
      expect(r.yourWin, 1000 * 3000);

      final agentTicket = await agent.ticket(sale.ticket.id);
      expect(agentTicket.status, TicketStatus.lost);
      s = await agent.agentSummary();
      expect(s.commissionPending, 0);
      expect(s.commissionSettled, 4000 + 1000);
      expect((await agent.wallet()).balance, balance + 1000);
    });

    test('top up and reset', () async {
      final api = await login(customer);
      final w = await api.demoTopUp();
      expect(w.balance, demoStartBalance + demoTopUpAmount);
      await api.demoReset();
      expect((await fails(api.me())).code, ErrorCode.unauthorized);
      final again = await login(customer);
      expect((await again.wallet()).balance, demoStartBalance);
    });
  });

  group('wallet', () {
    test('deposit QR, polling and simulated payment', () async {
      final api = await login(customer);
      expect((await fails(api.createDeposit(5000))).code, ErrorCode.validation);
      final d = await api.createDeposit(100000);
      expect(d.status, DepositStatus.pending);
      expect(d.qrPayload, startsWith('MOCKPAY|'));
      expect((await api.deposit(d.id)).status, DepositStatus.pending);
      final paid = await api.simulateDeposit(d.id, success: true);
      expect(paid.status, DepositStatus.success);
      expect((await api.wallet()).balance, demoStartBalance + 100000);

      final expiring = await api.createDeposit(20000);
      now = now.add(const Duration(minutes: 16));
      expect((await api.deposit(expiring.id)).status, DepositStatus.expired);
    });

    test('withdrawal needs the PIN, holds the money, then is paid', () async {
      final api = await login(customer);
      expect(
        (await fails(api.withdraw(
          amount: 100000,
          bankName: 'BCEL',
          accountNo: '0101000123',
          accountName: 'DEMO USER',
          pin: '482915',
        )))
            .code,
        ErrorCode.pinRequired,
      );
      await api.setPin('482915');
      expect(
        (await fails(api.withdraw(
          amount: 10000,
          bankName: 'BCEL',
          accountNo: '0101000123',
          accountName: 'DEMO USER',
          pin: '482915',
        )))
            .code,
        ErrorCode.validation,
      );
      final w = await api.withdraw(
        amount: 100000,
        bankName: 'BCEL',
        accountNo: '0101000123',
        accountName: 'DEMO USER',
        pin: '482915',
      );
      expect(w.status, WithdrawalStatus.requested);
      var wallet = await api.wallet();
      expect(wallet.balance, demoStartBalance - 100000);
      expect(wallet.held, 100000);

      now = now.add(const Duration(seconds: 5));
      final history = await api.withdrawals(limit: 20);
      expect(history.items.single.status, WithdrawalStatus.paid);
      wallet = await api.wallet();
      expect(wallet.held, 0);
      expect(wallet.balance, demoStartBalance - 100000);
      expect((await api.notifications(limit: 1)).items.single.title, 'ຖອນເງິນສຳເລັດ');
    });
  });
}
