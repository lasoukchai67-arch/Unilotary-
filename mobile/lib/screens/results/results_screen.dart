import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../utils/lottery.dart';
import '../../widgets/common.dart';
import '../../widgets/digit_tiles.dart';

/// Resulted draws and a "check my number" tool.
class ResultsScreen extends StatefulWidget {
  const ResultsScreen({super.key});

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  static const _limit = 30;

  List<Draw>? _draws;
  ApiException? _error;
  Draw? _selected;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final draws = await context
          .read<LotteryApi>()
          .draws(status: DrawStatus.resulted, limit: _limit);
      if (!mounted) return;
      final list = draws.where((d) => d.resultNumber != null).toList();
      final keep = _selected?.id;
      Draw? selected;
      for (final d in list) {
        if (d.id == keep) selected = d;
      }
      setState(() {
        _draws = list;
        _error = null;
        _selected = selected ?? (list.isEmpty ? null : list.first);
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final draws = _draws;
    if (draws == null) {
      return _error != null
          ? ErrorView(error: _error!, onRetry: _load)
          : const LoadingView();
    }
    return RefreshIndicator(
      color: Brand.deepGreen,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          if (_selected != null) _CheckCard(draw: _selected!),
          const SectionTitle(S.resultsTitle),
          if (draws.isEmpty)
            const Card(
              child: EmptyView(
                text: S.noResults,
                icon: Icons.hourglass_empty_rounded,
              ),
            ),
          for (final d in draws)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ResultTile(
                draw: d,
                selected: d.id == _selected?.id,
                onTap: () => setState(() => _selected = d),
              ),
            ),
        ],
      ),
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({
    required this.draw,
    required this.selected,
    required this.onTap,
  });

  final Draw draw;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: selected ? Brand.mint : Brand.outline,
          width: selected ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      S.drawNo(draw.drawNo),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      formatIsoDate(draw.drawDate),
                      style: const TextStyle(color: Brand.grey, fontSize: 13),
                    ),
                  ],
                ),
              ),
              DigitTiles(draw.resultNumber!, size: 28),
            ],
          ),
        ),
      ),
    );
  }
}

class _CheckCard extends StatefulWidget {
  const _CheckCard({required this.draw});

  final Draw draw;

  @override
  State<_CheckCard> createState() => _CheckCardState();
}

class _CheckCardState extends State<_CheckCard> {
  final _controller = TextEditingController();
  TierMatch? _match;
  String? _error;

  @override
  void didUpdateWidget(_CheckCard old) {
    super.didUpdateWidget(old);
    if (old.draw.id != widget.draw.id && _match != null) _check();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _check() {
    final n = _controller.text;
    if (!RegExp(r'^\d{2,6}$').hasMatch(n)) {
      setState(() {
        _error = S.checkHint;
        _match = null;
      });
      return;
    }
    setState(() {
      _error = null;
      _match = checkNumber(n, widget.draw.resultNumber!);
    });
  }

  @override
  Widget build(BuildContext context) {
    final result = widget.draw.resultNumber!;
    final match = _match;
    final rule = match == null ? null : widget.draw.ruleFor(match.digits);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '${S.checkMyNumber} · ${S.drawNo(widget.draw.drawNo)}',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: Brand.deepGreen,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: DigitTiles(
                  result,
                  size: 42,
                  highlightLast: match?.matchedSuffix ?? 0,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    key: const ValueKey('check-number-field'),
                    controller: _controller,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: const TextStyle(
                      fontSize: 20,
                      letterSpacing: 4,
                      fontFeatures: tabular,
                    ),
                    decoration: InputDecoration(
                      hintText: S.checkHint,
                      counterText: '',
                      errorText: _error,
                    ),
                    onSubmitted: (_) => _check(),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton(
                  key: const ValueKey('check-number'),
                  onPressed: _check,
                  child: const Text(S.check),
                ),
              ],
            ),
            if (match != null) ...[
              const SizedBox(height: 12),
              Container(
                key: const ValueKey('check-result'),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: match.wins ? Brand.mint : Brand.mintSurface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      match.wins ? S.winTier(match.digits) : S.noMatch,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: match.wins ? Brand.deepGreen : Brand.text,
                      ),
                    ),
                    if (match.wins && rule != null)
                      Text(
                        S.payoutLabel(rule.payoutRate),
                        style: const TextStyle(color: Brand.deepGreen),
                      ),
                    if (!match.wins && match.matchedSuffix >= 2)
                      Text(
                        S.partialTier(
                          match.matchedSuffix,
                          result.substring(result.length - match.matchedSuffix),
                        ),
                        style: const TextStyle(color: Brand.grey),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
