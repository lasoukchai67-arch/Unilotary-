import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Shown while the saved session is restored, or when that failed offline.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key, this.error, this.onRetry});

  final Object? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Brand.deepGreen,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AppLogo(size: 88),
              const SizedBox(height: 16),
              const Text(
                S.appName,
                style: TextStyle(
                  color: Brand.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 24),
              if (error == null)
                const CircularProgressIndicator(
                  color: Brand.mint,
                  semanticsLabel: S.loading,
                )
              else
                Card(
                  margin: const EdgeInsets.symmetric(horizontal: 24),
                  child: ErrorView(error: error!, onRetry: onRetry),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Simple brand mark: a ticket icon on a mint rounded square.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 72});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: Brand.mint,
          borderRadius: BorderRadius.circular(size * 0.28),
        ),
        alignment: Alignment.center,
        child: Icon(
          Icons.confirmation_number_rounded,
          size: size * 0.55,
          color: Brand.deepGreen,
        ),
      ),
    );
  }
}
