import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../l10n/strings.dart';
import '../../state/auth_state.dart';
import '../../widgets/common.dart';
import '../../widgets/pin_dialog.dart';

class ChangePinScreen extends StatefulWidget {
  const ChangePinScreen({super.key});

  @override
  State<ChangePinScreen> createState() => _ChangePinScreenState();
}

class _ChangePinScreenState extends State<ChangePinScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _pin = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _current.dispose();
    _pin.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false) || _busy) return;
    setState(() => _busy = true);
    try {
      await context
          .read<AuthState>()
          .changePin(currentPin: _current.text, pin: _pin.text);
      if (!mounted) return;
      showSnack(context, S.pinSaved);
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(S.changePin)),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              PinField(
                controller: _current,
                label: S.currentPin,
                autofocus: true,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 16),
              PinField(
                controller: _pin,
                label: S.newPin,
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
                controller: _confirm,
                label: S.confirmPin,
                validator: (v) => v == _pin.text ? null : S.pinMismatch,
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 24),
              FilledButton(
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
    );
  }
}
