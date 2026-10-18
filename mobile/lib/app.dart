import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'api/lottery_api.dart';
import 'l10n/strings.dart';
import 'screens/auth/phone_screen.dart';
import 'screens/auth/set_pin_screen.dart';
import 'screens/home_shell.dart';
import 'screens/splash_screen.dart';
import 'state/app_data.dart';
import 'state/auth_state.dart';
import 'state/cart.dart';
import 'state/events.dart';
import 'theme.dart';

/// Root widget. The [api] is injected so tests can use a mock HTTP client.
class LotteryApp extends StatelessWidget {
  const LotteryApp({super.key, required this.api});

  final LotteryApi api;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<LotteryApi>.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthState(api)..init()),
        ChangeNotifierProvider(create: (_) => WalletState(api)),
        ChangeNotifierProvider(create: (_) => DrawState(api)),
        ChangeNotifierProvider(create: (_) => NotificationState(api)),
        ChangeNotifierProvider(create: (_) => Cart()),
        ChangeNotifierProvider(create: (_) => TicketEvents()),
        ChangeNotifierProvider(create: (_) => ShellTabs()),
      ],
      child: const _AppView(),
    );
  }
}

class _AppView extends StatefulWidget {
  const _AppView();

  @override
  State<_AppView> createState() => _AppViewState();
}

class _AppViewState extends State<_AppView> {
  final _navigatorKey = GlobalKey<NavigatorState>();
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();
  late final AuthState _auth;
  AuthStatus? _lastStatus;

  @override
  void initState() {
    super.initState();
    _auth = context.read<AuthState>();
    _auth.addListener(_onAuthChanged);
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onAuthChanged() {
    final status = _auth.status;
    if (status == _lastStatus) return;
    final previous = _lastStatus;
    _lastStatus = status;

    // Any screen pushed for the previous state (OTP entry, profile...) is
    // dropped so the gate below shows the right root screen.
    _navigatorKey.currentState?.popUntil((route) => route.isFirst);

    if (status == AuthStatus.signedOut && previous != null) {
      context.read<WalletState>().reset();
      context.read<NotificationState>().reset();
      context.read<Cart>().clear();
      context.read<ShellTabs>().go(ShellTabs.home);
      if (_auth.sessionExpired) {
        _auth.acknowledgeSessionExpired();
        _messengerKey.currentState?.showSnackBar(
          const SnackBar(content: Text(S.sessionExpired)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: S.appName,
      debugShowCheckedModeBanner: false,
      navigatorKey: _navigatorKey,
      scaffoldMessengerKey: _messengerKey,
      theme: buildTheme(),
      locale: const Locale('lo'),
      supportedLocales: const [Locale('lo'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: const AuthGate(),
    );
  }
}

/// Shows the root screen for the current auth status.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    return switch (auth.status) {
      AuthStatus.loading => const SplashScreen(),
      AuthStatus.error => SplashScreen(error: auth.error, onRetry: auth.init),
      AuthStatus.signedOut => const PhoneScreen(),
      AuthStatus.needsPin => const SetPinScreen(),
      AuthStatus.signedIn => const HomeShell(),
    };
  }
}
