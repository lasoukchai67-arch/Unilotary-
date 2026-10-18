import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../l10n/strings.dart';
import '../../state/auth_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/pin_dialog.dart';

/// Forced after the first login when `pinSet` is false.
class SetPinScreen extends StatefulWidget {
  const SetPinScreen({super.key});

  @override
  State<SetPinScreen> createState() => _SetPinScreenState();
}

class _SetPinScreenState extends State<SetPinScreen> {
  final _formKey = GlobalKey<FormState>();
  final _pin = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _pin.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false) || _busy) return;
    setState(() => _busy = true);
    try {
      await context.read<AuthState>().setInitialPin(_pin.text);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(S.setPinTitle),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: S.logout,
            icon: const Icon(Icons.logout_rounded),
            onPressed: _busy ? null : () => context.read<AuthState>().logout(),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(
                      Icons.pin_rounded,
                      size: 56,
                      color: Brand.deepGreen,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      S.setPinSubtitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Brand.grey),
                    ),
                    const SizedBox(height: 24),
                    PinField(
                      key: const ValueKey('new-pin'),
                      controller: _pin,
                      label: S.newPin,
                      autofocus: true,
                      textInputAction: TextInputAction.next,
                      validator: (v) {
                        final pin = v ?? '';
                        if (!isValidPin(pin)) return S.pinInvalid;
                        if (isWeakPin(pin)) return S.pinWeak;
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    PinField(
                      key: const ValueKey('confirm-pin'),
                      controller: _confirm,
                      label: S.confirmPin,
                      validator: (v) => v == _pin.text ? null : S.pinMismatch,
                      onSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      key: const ValueKey('save-pin'),
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox.square(
                              dimension: 22,
                              child: CircularProgressIndicator(strokeWidth: 3),
                            )
                          : const Text(S.save),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
