import 'dart:async';

import 'package:flutter/material.dart';

import '../theme.dart';
import '../utils/format.dart';

/// Live countdown to [target] using the server clock
/// (`DateTime.now() + serverOffset`), so a wrong device clock does not show
/// a wrong closing time.
class Countdown extends StatefulWidget {
  const Countdown({
    super.key,
    required this.target,
    required this.serverOffset,
    this.style,
    this.onFinished,
  });

  final DateTime target;
  final Duration serverOffset;
  final TextStyle? style;
  final VoidCallback? onFinished;

  @override
  State<Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<Countdown> {
  Timer? _timer;

  Duration get _remaining =>
      widget.target.difference(DateTime.now().add(widget.serverOffset));

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void didUpdateWidget(Countdown old) {
    super.didUpdateWidget(old);
    if (old.target != widget.target ||
        old.serverOffset != widget.serverOffset) {
      _start();
    }
  }

  void _start() {
    _timer?.cancel();
    _timer = null;
    if (_remaining <= Duration.zero) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_remaining <= Duration.zero) {
        _timer?.cancel();
        _timer = null;
        widget.onFinished?.call();
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final parts = CountdownParts.of(_remaining);
    return Text(
      parts.label,
      style: (widget.style ?? const TextStyle()).copyWith(
        fontFeatures: tabular,
      ),
    );
  }
}
