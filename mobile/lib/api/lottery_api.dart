import '../l10n/strings.dart';
import '../models/json.dart';
import '../models/models.dart';
import 'api_client.dart';
import 'api_exception.dart';
import 'token_store.dart';

/// Typed endpoints of the v1 API (see docs/API.md).
class LotteryApi {
  LotteryApi(this.client);

  final ApiClient client;

  T _parse<T>(Object? body, T Function(Json json) parse) {
    try {
      return parse(asJson(body));
    } on FormatException catch (e) {
      throw ApiException(
        code: ErrorCode.badResponse,
        message: S.errorGeneric,
        details: e.message,
      );
    }
  }

  static Map<String, Object?> _page(int? limit, int? before) => {
        'limit': limit,
        'before': before,
      };

  // ---------------------------------------------------------------- Auth

  Future<OtpRequestResult> requestOtp(String phone) async => _parse(
        await client.post(
          '/auth/otp/request',
          body: {'phone': phone},
          auth: false,
        ),
        OtpRequestResult.fromJson,
      );

  /// Verifies the code and stores the issued tokens.
  Future<AuthResult> verifyOtp(String phone, String code) async {
    final result = _parse(
      await client.post(
        '/auth/otp/verify',
        body: {'phone': phone, 'code': code},
        auth: false,
      ),
      AuthResult.fromJson,
    );
    await client.setTokens(
      AuthTokens(
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      ),
    );
    return result;
  }

  /// Revokes the refresh token on the server (best effort) and forgets the
  /// session locally.
  Future<void> logout() async {
    final tokens = client.tokens;
    try {
      if (tokens != null) {
        await client.post(
          '/auth/logout',
          body: {'refreshToken': tokens.refreshToken},
          headers: {'Authorization': 'Bearer ${tokens.accessToken}'},
          auth: false,
        );
      }
    } on ApiException {
      // Ignore: the local session is cleared either way.
    } finally {
      await client.clearSession();
    }
  }

  // ------------------------------------------------------------------ Me

  Future<User> me() async => _parse(await client.get('/me'), User.fromJson);

  /// Sets the PIN; [currentPin] is required when a PIN already exists.
  Future<void> setPin(String pin, {String? currentPin}) async {
    await client.post(
      '/me/pin',
      body: {'pin': pin, 'currentPin': ?currentPin},
    );
  }

  /// [dailySpendCap] null removes the cap.
  Future<User> updateSettings({
    required int? dailySpendCap,
    required String pin,
  }) async =>
      _parse(
        await client.patch(
          '/me/settings',
          body: {'dailySpendCap': dailySpendCap, 'pin': pin},
        ),
        User.fromJson,
      );

  Future<User> selfExclude({required int days, required String pin}) async =>
      _parse(
        await client.post(
          '/me/self-exclusion',
          body: {'days': days, 'pin': pin},
        ),
        User.fromJson,
      );

  /// Multipart KYC submission. [birthDate] is `YYYY-MM-DD`.
  Future<User> submitKyc({
    required String fullName,
    required String birthDate,
    required String idCardNo,
    required List<int> photoBytes,
    required String photoFilename,
    required String photoContentType,
  }) async =>
      _parse(
        await client.postMultipart(
          '/me/kyc',
          fields: {
            'fullName': fullName,
            'birthDate': birthDate,
            'idCardNo': idCardNo,
          },
          files: [
            UploadFile(
              field: 'photo',
              bytes: photoBytes,
              filename: photoFilename,
              contentType: photoContentType,
            ),
          ],
        ),
        User.fromJson,
      );

  // --------------------------------------------------------------- Draws

  /// The open draw, else the next scheduled one; null when there is none.
  Future<Draw?> currentDraw() async {
    try {
      final body = await client.get('/draws/current', auth: false);
      return _parse<Draw>(body, Draw.fromJson);
    } on ApiException catch (e) {
      if (e.statusCode == 404 || e.code == ErrorCode.notFound) return null;
      rethrow;
    }
  }

  /// Newest first.
  Future<List<Draw>> draws({DrawStatus? status, int? limit}) async => _parse(
        await client.get(
          '/draws',
          query: {'status': status?.name, 'limit': limit},
          auth: false,
        ),
        (json) => json.listOf('items', Draw.fromJson),
      );

  Future<Draw> draw(int id) async =>
      _parse(await client.get('/draws/$id', auth: false), Draw.fromJson);

  // ------------------------------------------------------------- Tickets

  /// Buys [lines] in draw [drawId]. Use a new [idempotencyKey] per purchase
  /// attempt and the same one when retrying after a network error.
  Future<PurchaseResult> purchase({
    required int drawId,
    required List<PurchaseLine> lines,
    required String idempotencyKey,
  }) async =>
      _parse(
        await client.post(
          '/draws/$drawId/tickets',
          body: {
            'lines': [for (final l in lines) l.toJson()],
          },
          headers: {'Idempotency-Key': idempotencyKey},
        ),
        PurchaseResult.fromJson,
      );

  Future<CursorPage<Ticket>> tickets({int? limit, int? before}) async =>
      _parse(
        await client.get('/tickets', query: _page(limit, before)),
        (json) => CursorPage.fromJson(json, Ticket.fromJson),
      );

  Future<Ticket> ticket(int id) async =>
      _parse(await client.get('/tickets/$id'), Ticket.fromJson);

  // -------------------------------------------------------------- Wallet

  Future<WalletBalance> wallet() async =>
      _parse(await client.get('/wallet'), WalletBalance.fromJson);

  Future<CursorPage<WalletTx>> transactions({int? limit, int? before}) async =>
      _parse(
        await client.get('/wallet/transactions', query: _page(limit, before)),
        (json) => CursorPage.fromJson(json, WalletTx.fromJson),
      );

  Future<Deposit> createDeposit(int amount) async => _parse(
        await client.post('/wallet/deposits', body: {'amount': amount}),
        Deposit.fromJson,
      );

  Future<Deposit> deposit(int id) async =>
      _parse(await client.get('/wallet/deposits/$id'), Deposit.fromJson);

  /// Development only: the server must run the mock payment provider.
  Future<Deposit> simulateDeposit(int id, {required bool success}) async =>
      _parse(
        await client.post(
          '/dev/deposits/$id/simulate',
          body: {'status': success ? 'success' : 'failed'},
        ),
        Deposit.fromJson,
      );

  Future<Withdrawal> withdraw({
    required int amount,
    required String bankName,
    required String accountNo,
    required String accountName,
    required String pin,
  }) async =>
      _parse(
        await client.post(
          '/wallet/withdrawals',
          body: {
            'amount': amount,
            'bankName': bankName,
            'accountNo': accountNo,
            'accountName': accountName,
            'pin': pin,
          },
        ),
        Withdrawal.fromJson,
      );

  Future<CursorPage<Withdrawal>> withdrawals({int? limit, int? before}) async =>
      _parse(
        await client.get('/wallet/withdrawals', query: _page(limit, before)),
        (json) => CursorPage.fromJson(json, Withdrawal.fromJson),
      );

  // ------------------------------------------------------- Notifications

  Future<NotificationPage> notifications({int? limit, int? before}) async =>
      _parse(
        await client.get('/notifications', query: _page(limit, before)),
        NotificationPage.fromJson,
      );

  Future<void> markNotificationRead(int id) async {
    await client.post('/notifications/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await client.post('/notifications/read-all');
  }

  // --------------------------------------------------------------- Agent

  /// Sells a ticket paid from the agent's wallet.
  Future<PurchaseResult> agentSale({
    required int drawId,
    String? buyerPhone,
    required List<PurchaseLine> lines,
    required String idempotencyKey,
  }) async =>
      _parse(
        await client.post(
          '/agent/sales',
          body: {
            'drawId': drawId,
            'buyerPhone': ?buyerPhone,
            'lines': [for (final l in lines) l.toJson()],
          },
          headers: {'Idempotency-Key': idempotencyKey},
        ),
        PurchaseResult.fromJson,
      );

  Future<AgentSummary> agentSummary() async =>
      _parse(await client.get('/agent/summary'), AgentSummary.fromJson);
}
