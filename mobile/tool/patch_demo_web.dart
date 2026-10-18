// Post-processes `flutter build web` output for the offline investor demo so
// the page makes no requests to other hosts:
//  * no service worker (Flutter's deprecated cleanup worker is removed);
//  * CanvasKit loaded from ./canvaskit/ (build with --no-web-resources-cdn);
//  * font fallback pointed at a local path instead of fonts.gstatic.com;
//  * a local "Roboto" registered, otherwise CanvasKit downloads it from
//    fonts.gstatic.com at start-up;
//  * demo <title> and a mint background so there is no white flash.
//
// Usage: dart run tool/patch_demo_web.dart build/web <flutter-sdk-root>
import 'dart:convert';
import 'dart:io';

void main(List<String> args) {
  if (args.length != 2) {
    stderr.writeln('usage: patch_demo_web.dart <build/web> <flutter-root>');
    exit(64);
  }
  final web = Directory(args[0]);
  final flutterRoot = args[1];
  if (!File('${web.path}/index.html').existsSync()) {
    stderr.writeln('${web.path}/index.html not found: run flutter build web first');
    exit(66);
  }

  // index.html: title, background, no indexing.
  final index = File('${web.path}/index.html');
  var html = index.readAsStringSync();
  html = html.replaceFirst(
    RegExp(r'<title>[^<]*</title>'),
    '<title>ຫວຍພັດທະນາ · ສາທິດ</title>\n'
    '  <meta name="robots" content="noindex">\n'
    '  <style>html, body { margin: 0; background: #E9F7F1; }</style>',
  );
  html = html.replaceFirst(
    RegExp(r'<meta name="apple-mobile-web-app-title" content="[^"]*">'),
    '<meta name="apple-mobile-web-app-title" content="ຫວຍພັດທະນາ · ສາທິດ">',
  );
  html = html.replaceFirst('<body>', '<body style="background: #E9F7F1;">');
  index.writeAsStringSync(html);

  // flutter_bootstrap.js: load without the service worker, local resources.
  final bootstrap = File('${web.path}/flutter_bootstrap.js');
  final js = bootstrap.readAsStringSync();
  final load = RegExp(r'_flutter\.loader\.load\(\{[\s\S]*?\}\);\s*$');
  if (!load.hasMatch(js)) {
    stderr.writeln('flutter_bootstrap.js: loader call not found');
    exit(65);
  }
  bootstrap.writeAsStringSync(js.replaceFirst(load, '''
_flutter.loader.load({
  config: {
    canvasKitBaseUrl: "canvaskit/",
    fontFallbackBaseUrl: "assets/fallback-fonts/",
  },
});
'''));
  final sw = File('${web.path}/flutter_service_worker.js');
  if (sw.existsSync()) sw.deleteSync();

  // Register a bundled Roboto so the engine does not fetch one.
  final manifestFile = File('${web.path}/assets/FontManifest.json');
  final manifest = (jsonDecode(manifestFile.readAsStringSync()) as List)
      .cast<Map<String, dynamic>>();
  if (!manifest.any((f) => f['family'] == 'Roboto')) {
    const fonts = 'bin/cache/artifacts/material_fonts';
    final src = File('$flutterRoot/$fonts/Roboto-Regular.ttf');
    if (!src.existsSync()) {
      stderr.writeln('${src.path} not found (run flutter precache)');
      exit(66);
    }
    Directory('${web.path}/assets/assets/fonts').createSync(recursive: true);
    src.copySync('${web.path}/assets/assets/fonts/Roboto-Regular.ttf');
    File('$flutterRoot/$fonts/Roboto_LICENSE.txt')
        .copySync('${web.path}/assets/assets/fonts/Roboto_LICENSE.txt');
    manifest.add({
      'family': 'Roboto',
      'fonts': [
        {'asset': 'assets/fonts/Roboto-Regular.ttf'},
      ],
    });
    manifestFile.writeAsStringSync(jsonEncode(manifest));
  }

  // Debug symbols are never loaded at runtime.
  for (final f in web.listSync(recursive: true).whereType<File>()) {
    if (f.path.endsWith('.symbols')) f.deleteSync();
  }

  stdout.writeln('patched ${web.path} for the offline demo');
}
