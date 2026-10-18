import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../l10n/strings.dart';
import '../../models/misc.dart';
import '../../state/auth_state.dart';
import '../../theme.dart';
import '../../utils/phone.dart';
import '../../widgets/banners.dart';
import '../../widgets/common.dart';

/// Step 2 of login: enter the 6-digit code.
class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key, required this.phone, required this.initial});

  final String phone;
  final OtpRequestResult initial;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  /// The server allows one OTP request per 60 s per phone.
  static const _resendDelay = 60;

  final _code = TextEditingController();
  late OtpRequestResult _otp = widget.initial;
  bool _busy = false;
  String? _error;
  int _resendIn = _resendDelay;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startResendTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startResendTimer() {
    _timer?.cancel();
    setState(() => _resendIn = _resendDelay);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _resendIn--);
      if (_resendIn <= 0) t.cancel();
    });
  }

  Future<void> _verify() async {
    final code = _code.text;
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = S.otpInvalid);
      return;
    }
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // On success the auth state changes and the app shows the next screen.
      await context.read<AuthState>().verifyOtp(widget.phone, code);
    } on ApiException catch (e) {
      if (!mounted) return;
      _code.clear();
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _busy = true);
    try {
      final otp = await context.read<AuthState>().requestOtp(widget.phone);
      if (!mounted) return;
      setState(() {
        _otp = otp;
        _error = null;
      });
      _startResendTimer();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(S.otpTitle)),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_otp.devCode != null) ...[
                    DevBanner(
                      key: const ValueKey('dev-code'),
                      text: S.devCode(_otp.devCode!),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Text(
                    S.otpSentTo(formatPhone(widget.phone)),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    key: const ValueKey('otp-field'),
                    controller: _code,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: const TextStyle(
                      fontSize: 30,
                      letterSpacing: 12,
                      fontWeight: FontWeight.w700,
                      fontFeatures: tabular,
                    ),
                    decoration: InputDecoration(
                      labelText: S.otpCode,
                      counterText: '',
                      errorText: _error,
                      errorMaxLines: 3,
                    ),
                    onChanged: (v) {
                      if (v.length == 6) _verify();
                    },
                    onSubmitted: (_) => _verify(),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    key: const ValueKey('verify-otp'),
                    onPressed: _busy ? null : _verify,
                    child: _busy
                        ? const SizedBox.square(
                            dimension: 22,
                            child: CircularProgressIndicator(strokeWidth: 3),
                          )
                        : const Text(S.verify),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _busy || _resendIn > 0 ? null : _resend,
                    child: Text(
                      _resendIn > 0 ? S.resendIn(_resendIn) : S.resendOtp,
                    ),
                  ),
                  TextButton(
                    onPressed: _busy ? null : () => Navigator.of(context).pop(),
                    child: const Text(S.changePhone),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
