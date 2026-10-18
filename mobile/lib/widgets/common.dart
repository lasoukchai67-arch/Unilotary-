import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../l10n/strings.dart';
import '../theme.dart';

/// Lao message for any error thrown by the API layer.
String errorMessage(Object error) {
  if (error is ApiException) return error.message;
  return S.errorGeneric;
}

void showSnack(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Brand.red : Brand.text,
        // Info messages are brief so they do not sit on the pay bar.
        duration: Duration(seconds: error ? 4 : 2),
      ),
    );
}

void showError(BuildContext context, Object error) =>
    showSnack(context, errorMessage(error), error: true);

/// Simple OK dialog.
Future<void> showMessageDialog(
  BuildContext context, {
  required String title,
  required String message,
}) =>
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(S.ok),
          ),
        ],
      ),
    );

/// Yes/no dialog; resolves to true when confirmed.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = S.confirm,
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text(S.cancel),
        ),
        FilledButton(
          style: destructive
              ? FilledButton.styleFrom(
                  backgroundColor: Brand.red,
                  foregroundColor: Brand.white,
                )
              : null,
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: CircularProgressIndicator(semanticsLabel: S.loading),
        ),
      );
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 48, color: Brand.grey),
            const SizedBox(height: 12),
            Text(
              errorMessage(error),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Brand.grey),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text(S.retry),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.text, this.icon = Icons.inbox_outlined});

  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: Brand.grey),
            const SizedBox(height: 8),
            Text(
              text,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Brand.grey),
            ),
          ],
        ),
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
        child: Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(
                  text,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Brand.deepGreen,
                  ),
                ),
              ),
            ),
            ?trailing,
          ],
        ),
      );
}

/// Label/value row used in detail cards.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.label, required this.value});

  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 2,
              child: Text(label, style: const TextStyle(color: Brand.grey)),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 3,
              child: Align(alignment: Alignment.centerRight, child: value),
            ),
          ],
        ),
      );
}
