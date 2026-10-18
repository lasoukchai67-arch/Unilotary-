import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../demo/demo_mode.dart';
import '../../demo/demo_widgets.dart';
import '../../l10n/strings.dart';
import '../../state/auth_state.dart';
import '../../theme.dart';
import '../../utils/phone.dart';
import '../../widgets/banners.dart';
import '../../widgets/common.dart';
import '../splash_screen.dart';
import 'otp_screen.dart';

/// Step 1 of login: phone number → request OTP.
class PhoneScreen extends StatefulWidget {
  const PhoneScreen({super.key});

  @override
  State<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends State<PhoneScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false) || _busy) return;
    final phone = normalizePhone(_phone.text);
    setState(() => _busy = true);
    try {
      final result = await context.read<AuthState>().requestOtp(phone);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => OtpScreen(phone: phone, initial: result),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                    const Center(child: AppLogo(size: 80)),
                    const SizedBox(height: 16),
                    const Text(
                      S.appName,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: Brand.deepGreen,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      S.loginSubtitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Brand.grey),
                    ),
                    const SizedBox(height: 28),
                    TextFormField(
                      key: const ValueKey('phone-field'),
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      textInputAction: TextInputAction.done,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s\-]')),
                        LengthLimitingTextInputFormatter(18),
                      ],
                      style: const TextStyle(
                        fontSize: 20,
                        fontFeatures: tabular,
                      ),
                      decoration: const InputDecoration(
                        labelText: S.phone,
                        hintText: S.phoneHint,
                        prefixIcon: Icon(Icons.phone_iphone_rounded),
                      ),
                      validator: (v) =>
                          isValidLaoPhone(v ?? '') ? null : S.phoneInvalid,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      key: const ValueKey('request-otp'),
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox.square(
                              dimension: 22,
                              child: CircularProgressIndicator(strokeWidth: 3),
                            )
                          : const Text(S.requestOtp),
                    ),
                    if (context.read<DemoController?>() != null) ...[
                      const SizedBox(height: 16),
                      DemoLoginHint(
                        onUseAgentPhone: () =>
                            _phone.text = S.demoAgentPhone,
                      ),
                    ],
                    const SizedBox(height: 32),
                    const ResponsibleGamingFooter(),
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
