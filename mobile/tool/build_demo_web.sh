#!/usr/bin/env bash
# Builds the offline investor demo (no server, no network) into build/web.
#   tool/build_demo_web.sh            # uses `flutter` from PATH
#   FLUTTER=/opt/flutter/bin/flutter tool/build_demo_web.sh
set -euo pipefail
cd "$(dirname "$0")/.."

FLUTTER="${FLUTTER:-flutter}"
FLUTTER_ROOT="$(cd "$(dirname "$(command -v "$FLUTTER")")/.." && pwd)"

"$FLUTTER" build web --release \
  --no-web-resources-cdn \
  --dart-define=DEMO_MODE=true \
  "$@"

"$FLUTTER_ROOT/bin/dart" run tool/patch_demo_web.dart build/web "$FLUTTER_ROOT"

# The loader must use the local CanvasKit and fallback-font paths.
grep -q 'canvasKitBaseUrl: "canvaskit/"' build/web/flutter_bootstrap.js
grep -q '"useLocalCanvasKit":true' build/web/flutter_bootstrap.js
test ! -e build/web/flutter_service_worker.js
du -sh build/web
