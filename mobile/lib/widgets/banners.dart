import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme.dart';

/// Responsible-gaming footer: 18+ notice.
class ResponsibleGamingFooter extends StatelessWidget {
  const ResponsibleGamingFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: S.rgNotice,
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Brand.red, width: 2),
              ),
              child: const Text(
                S.rgNoticeShort,
                style: TextStyle(
                  color: Brand.red,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Flexible(
              child: Text(
                S.rgNotice,
                style: TextStyle(color: Brand.grey, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Small amber banner for development-only information (e.g. `devCode`).
class DevBanner extends StatelessWidget {
  const DevBanner({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF4D6),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2B64B)),
      ),
      child: Row(
        children: [
          const Icon(Icons.bug_report_outlined, size: 18, color: Brand.gold),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Brand.gold,
                fontWeight: FontWeight.w700,
                fontFeatures: tabular,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
