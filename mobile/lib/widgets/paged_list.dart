import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../l10n/strings.dart';
import '../models/misc.dart';
import '../theme.dart';
import 'common.dart';

typedef PageFetcher<T> = Future<CursorPage<T>> Function(int? before);

/// Infinite list over a `{ items, nextBefore }` endpoint: loads the next page
/// with `before=<nextBefore>` when the end of the list is reached, and
/// supports pull-to-refresh.
class PagedListView<T> extends StatefulWidget {
  const PagedListView({
    super.key,
    required this.fetch,
    required this.itemBuilder,
    this.header,
    this.emptyText = S.empty,
    this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 24),
    this.onRefresh,
  });

  final PageFetcher<T> fetch;
  final Widget Function(BuildContext context, T item) itemBuilder;

  /// Scrolls with the list (e.g. a balance card).
  final Widget? header;
  final String emptyText;
  final EdgeInsetsGeometry padding;

  /// Extra work on pull-to-refresh (e.g. reloading the balance).
  final Future<void> Function()? onRefresh;

  @override
  State<PagedListView<T>> createState() => PagedListViewState<T>();
}

class PagedListViewState<T> extends State<PagedListView<T>> {
  final List<T> _items = [];
  int? _nextBefore;
  bool _hasMore = true;
  bool _loading = false;
  ApiException? _error;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    reload();
  }

  /// Reloads from the first page.
  Future<void> reload() async {
    _generation++;
    setState(() {
      _items.clear();
      _nextBefore = null;
      _hasMore = true;
      _error = null;
      _loading = false;
    });
    await _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore) return;
    final generation = _generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.fetch(_nextBefore);
      if (!mounted || generation != _generation) return;
      setState(() {
        _items.addAll(page.items);
        _nextBefore = page.nextBefore;
        _hasMore = page.nextBefore != null;
      });
    } on ApiException catch (e) {
      if (!mounted || generation != _generation) return;
      setState(() => _error = e);
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _refresh() async {
    await Future.wait([reload(), if (widget.onRefresh != null) widget.onRefresh!()]);
  }

  @override
  Widget build(BuildContext context) {
    final hasHeader = widget.header != null;
    final count = (hasHeader ? 1 : 0) + _items.length + 1;
    return RefreshIndicator(
      color: Brand.deepGreen,
      onRefresh: _refresh,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: widget.padding,
        itemCount: count,
        itemBuilder: (context, index) {
          if (hasHeader && index == 0) return widget.header!;
          final i = index - (hasHeader ? 1 : 0);
          if (i < _items.length) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: widget.itemBuilder(context, _items[i]),
            );
          }
          return _footer();
        },
      ),
    );
  }

  Widget _footer() {
    if (_error != null) {
      return ErrorView(error: _error!, onRetry: _loadMore);
    }
    if (_hasMore) {
      // Reaching the footer means the user scrolled to the end (or the first
      // page did not fill the screen): fetch the next page.
      if (!_loading) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _loadMore();
        });
      }
      return const LoadingView();
    }
    if (_items.isEmpty) return EmptyView(text: widget.emptyText);
    return const Padding(
      padding: EdgeInsets.all(16),
      child: Center(
        child: Text(S.noMore, style: TextStyle(color: Brand.grey)),
      ),
    );
  }
}
