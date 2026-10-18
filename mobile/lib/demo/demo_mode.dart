import '../api/api_client.dart';
import '../api/lottery_api.dart';
import '../api/token_store.dart';
import '../models/json.dart';
import '../models/wallet.dart';
import 'demo_backend.dart';

/// Owns the in-process [DemoBackend] used by `--dart-define=DEMO_MODE=true`.
class DemoController {
  DemoController({DemoBackend? backend})
      : backend = backend ??
            DemoBackend(latency: const Duration(milliseconds: 150));

  /// Never resolved: every request is answered by [DemoBackend.client].
  static const baseUrl = 'http://demo.invalid/v1';

  final DemoBackend backend;

  /// The normal API stack, wired to the in-memory backend. Tokens live in
  /// memory only.
  LotteryApi createApi() => LotteryApi(
        ApiClient(
          baseUrl: baseUrl,
          tokenStore: MemoryTokenStore(),
          httpClient: backend.client,
        ),
      );

  void dispose() => backend.dispose();
}

/// Response of `POST /demo/draws/settle`.
class DemoSettleResult {
  const DemoSettleResult({
    required this.drawNo,
    required this.resultNumber,
    required this.winners,
    required this.totalWin,
    required this.autoPaid,
    required this.pendingPayouts,
    required this.yourTickets,
    required this.yourWin,
    required this.yourPendingWin,
    required this.nextDrawNo,
  });

  factory DemoSettleResult.fromJson(Json json) => DemoSettleResult(
        drawNo: json.string('drawNo'),
        resultNumber: json.string('resultNumber'),
        winners: json.integer('winners'),
        totalWin: json.integer('totalWin'),
        autoPaid: json.integer('autoPaid'),
        pendingPayouts: json.integer('pendingPayouts'),
        yourTickets: json.integer('yourTickets'),
        yourWin: json.integer('yourWin'),
        yourPendingWin: json.integer('yourPendingWin'),
        nextDrawNo: json.string('nextDrawNo'),
      );

  final String drawNo;
  final String resultNumber;
  final int winners;
  final int totalWin;
  final int autoPaid;
  final int pendingPayouts;
  final int yourTickets;
  final int yourWin;
  final int yourPendingWin;
  final String nextDrawNo;
}

/// Demo-only endpoints served by [DemoBackend].
extension DemoApi on LotteryApi {
  Future<DemoSettleResult> demoSettleDraw() async =>
      DemoSettleResult.fromJson(asJson(await client.post('/demo/draws/settle')));

  Future<WalletBalance> demoTopUp() async =>
      WalletBalance.fromJson(asJson(await client.post('/demo/topup')));

  Future<void> demoReset() async {
    await client.post('/demo/reset', auth: false);
  }
}
