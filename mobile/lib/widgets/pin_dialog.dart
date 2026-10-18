import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/strings.dart';
import '../theme.dart';

final _sixDigits = RegExp(r'^\d{6}$');

bool isValidPin(String pin) => _sixDigits.hasMatch(pin);

/// Obvious PINs we refuse client-side (the server may have its own rules).
bool isWeakPin(String pin) {
  if (!isValidPin(pin)) return true;
  if (pin.split('').toSet().length == 1) return true;
  const ascending = '0123456789';
  const descending = '9876543210';
  return ascending.contains(pin) || descending.contains(pin);
}

/// A 6-digit, obscured, numeric text field.
class PinField extends StatelessWidget {
  const PinField({
    super.key,
    required this.controller,
    required this.label,
    this.validator,
    this.autofocus = false,
    this.onSubmitted,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String label;
  final FormFieldValidator<String>? validator;
  final bool autofocus;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      autofocus: autofocus,
      obscureText: true,
      obscuringCharacter: '•',
      keyboardType: TextInputType.number,
      textInputAction: textInputAction,
      maxLength: 6,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      autofillHints: const [AutofillHints.password],
      style: const TextStyle(
        fontSize: 24,
        letterSpacing: 10,
        fontFeatures: tabular,
      ),
      decoration: InputDecoration(
        labelText: label,
        counterText: '',
        prefixIcon: const Icon(Icons.lock_outline_rounded),
      ),
      validator: validator ??
          (v) => isValidPin(v ?? '') ? null : S.pinInvalid,
      onFieldSubmitted: onSubmitted,
    );
  }
}

/// Asks for the PIN; resolves to the 6 digits or null when cancelled.
Future<String?> showPinDialog(
  BuildContext context, {
  String title = S.enterPin,
  String? message,
}) =>
    showDialog<String>(
      context: context,
      builder: (_) => _PinDialog(title: title, message: message),
    );

class _PinDialog extends StatefulWidget {
  const _PinDialog({required this.title, this.message});

  final String title;
  final String? message;

  @override
  State<_PinDialog> createState() => _PinDialogState();
}

class _PinDialogState extends State<_PinDialog> {
  final _controller = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      Navigator.of(context).pop(_controller.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.message != null) ...[
              Text(widget.message!),
              const SizedBox(height: 12),
            ],
            PinField(
              controller: _controller,
              label: S.pin,
              autofocus: true,
              onSubmitted: (_) => _submit(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text(S.cancel),
        ),
        FilledButton(onPressed: _submit, child: const Text(S.confirm)),
      ],
    );
  }
}
