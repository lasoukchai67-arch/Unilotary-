import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import 'api/api_client.dart';
import 'api/lottery_api.dart';
import 'api/token_store.dart';
import 'app.dart';
import 'config.dart';
import 'demo/demo_mode.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Bundled font licence (SIL OFL 1.1) for the licences page.
  LicenseRegistry.addLicense(() async* {
    final text = await rootBundle.loadString('assets/fonts/OFL.txt');
    yield LicenseEntryWithLineBreaks(const ['Noto Sans Lao'], text);
  });

  // Demo builds answer every request in-process; normal builds are unchanged.
  final demo = AppConfig.demoMode ? DemoController() : null;
  final api = demo?.createApi() ??
      LotteryApi(
        ApiClient(baseUrl: AppConfig.apiBaseUrl, tokenStore: SecureTokenStore()),
      );
  runApp(LotteryApp(api: api, demo: demo));
}
