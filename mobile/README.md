# ຫວຍພັດທະນາ — ແອັບລູກຄ້າ (Lao Development Lottery customer app)

Flutter app (Android, iOS, web) for a licensed seller of the Lao Development
Lottery. Every screen is in Lao. It talks only to the backend API described
in [`../docs/API.md`](../docs/API.md).

ແອັບ Flutter ສຳລັບລູກຄ້າ: ເຂົ້າສູ່ລະບົບດ້ວຍ OTP, ຊື້ເລກ, ບິນ ແລະ QR, ກວດຜົນ,
ກະເປົາເງິນ (ຝາກ/ຖອນ), ຢືນຢັນຕົວຕົນ (KYC), ການຕັ້ງຄ່າການຫຼິ້ນຢ່າງມີສະຕິ ແລະ
ໜ້າຂາຍແທນລູກຄ້າສຳລັບຕົວແທນ.

- App id / bundle id: **`la.lottery.lao_lottery`**
- Display name: **ຫວຍພັດທະນາ**
- Flutter stable 3.47+ / Dart 3.13+; Android minSdk 24 (Android 7.0), iOS 15.0+

## ໂຄງສ້າງ · Structure

```
lib/
  api/        HTTP client (auth header, single-flight token refresh), typed endpoints, errors
  models/     contract models with fromJson
  state/      provider ChangeNotifiers: auth, wallet, draw, notifications, cart
  screens/    auth, home, buy, tickets, results, wallet, kyc, profile (+ agent)
  widgets/    keypad, digit tiles, money text, countdown, PIN dialog, paged list...
  utils/      kip/date formatting, phone normalisation, permutations, winning tiers
  l10n/strings.dart   all Lao text
assets/fonts/ Noto Sans Lao (SIL OFL 1.1, see OFL.txt) — bundled, never downloaded
test/         API client tests (MockClient), unit tests, widget tests
```

## ການຕິດຕັ້ງ · Setup

```bash
cd mobile
flutter pub get
```

## ແລ່ນແອັບ · Run on a device / emulator

ກຳນົດທີ່ຢູ່ API ດ້ວຍ `--dart-define=API_BASE_URL=...` (ຕ້ອງລົງທ້າຍດ້ວຍ `/v1`).
Pass the API base URL with `--dart-define=API_BASE_URL=...` (including `/v1`).

| Target | Default when not set |
|---|---|
| Android emulator | `http://10.0.2.2:3000/v1` (the host machine) |
| Web | `http://localhost:3000/v1` |

```bash
# Android emulator, backend on the host machine (default URL)
flutter run

# Physical phone on the same Wi-Fi as the dev machine
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:3000/v1

# iOS simulator (10.0.2.2 does not exist on iOS)
flutter run -d ios --dart-define=API_BASE_URL=http://localhost:3000/v1

# Web (the backend must allow CORS for the web origin)
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/v1

# Staging / production
flutter run --release --dart-define=API_BASE_URL=https://api.example.la/v1
```

Plain `http://` only works in debug/profile builds: Android allows cleartext
traffic only in the debug/profile manifests, and iOS only allows local
networking (`NSAllowsLocalNetworking`). **Release builds must use `https://`.**

ໃນໂໝດ debug: ຖ້າເຊີບເວີໃຊ້ mock SMS, ລະຫັດ OTP (`devCode`) ຈະສະແດງເທິງໜ້າປ້ອນລະຫັດ,
ແລະ ໜ້າຝາກເງິນມີປຸ່ມ "ຈຳລອງ" (`/dev/deposits/:id/simulate`).
In debug builds the OTP screen shows the `devCode` returned by the mock SMS
provider, and the deposit screen offers "simulate payment" buttons.

## ກວດສອບ · Checks

```bash
flutter analyze
flutter test
```

## ສ້າງໄຟລ໌ຕິດຕັ້ງ · Build

```bash
# Android APK (sideload / testing)
flutter build apk --release --dart-define=API_BASE_URL=https://api.example.la/v1

# Android App Bundle (Google Play)
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.example.la/v1

# iOS (on macOS with Xcode; then archive/upload with Xcode or Transporter)
flutter build ipa --release --dart-define=API_BASE_URL=https://api.example.la/v1

# Web
flutter build web --release --dart-define=API_BASE_URL=https://api.example.la/v1
```

By default Flutter web loads its CanvasKit runtime from Google's CDN. To
serve everything from your own host, add `--no-web-resources-cdn`. App fonts
are always bundled.

Outputs: `build/app/outputs/flutter-apk/app-release.apk`,
`build/app/outputs/bundle/release/app-release.aab`, `build/ios/ipa/`,
`build/web/`.

## ການເຊັນແອັບ · Signing

### Android

Release signing is read from **`android/key.properties`**. If that file is
missing, release builds are signed with the debug key so `flutter build apk
--release` still works locally and in CI. Google Play rejects debug-signed
uploads.

ຫ້າມ commit keystore ຫຼື `key.properties` (ຖືກລະເວັ້ນໃນ `.gitignore` ແລ້ວ).
Never commit the keystore or `key.properties`; both are git-ignored.

1. Create an upload keystore once (keep it and its passwords safe):
   ```bash
   keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA \
     -keysize 2048 -validity 10000 -alias upload
   ```
2. Create `android/key.properties`:
   ```properties
   storePassword=<store password>
   keyPassword=<key password>
   keyAlias=upload
   # absolute path, or relative to android/app/
   storeFile=/home/me/upload-keystore.jks
   ```
3. In CI, write the keystore from a secret (e.g. base64) to a temp file and
   generate `key.properties` before `flutter build appbundle`.

### iOS

Open `ios/Runner.xcworkspace` in Xcode, choose the team under *Signing &
Capabilities* for bundle id `la.lottery.lao_lottery`, and use automatic
signing (or install the distribution certificate and provisioning profile
in CI). Camera and photo-library permission texts (`NSCameraUsageDescription`,
`NSPhotoLibraryUsageDescription`) are in Lao in `ios/Runner/Info.plist`.

## ໝາຍເຫດ · Notes

- Tokens are stored with `flutter_secure_storage` (Keychain / Android
  Keystore). On a 401 `UNAUTHORIZED` the client refreshes the token once
  (one refresh shared by concurrent requests, because refresh tokens rotate)
  and retries. If the refresh token is rejected, the user is logged out. The
  backend also returns 401 for `PIN_REQUIRED` / `PIN_INVALID`; those are
  never retried.
- Every purchase attempt gets a new UUID `Idempotency-Key`. After a network
  error or 5xx the app offers a retry with the **same** key, so the buyer
  cannot be charged twice. Changing the cart starts a new attempt.
- Fonts: the bundled Noto Sans Lao files only contain Lao glyphs, so the
  Latin subset of the same font project (`NotoSansLaoLatin-*.ttf`, also OFL)
  is bundled as the fallback for digits and Latin text.
