import 'package:flutter/material.dart';

/// Brand palette.
abstract final class Brand {
  static const deepGreen = Color(0xFF0E4D3C);
  static const mint = Color(0xFF3EB489);
  static const midGreen = Color(0xFF1F8A66);
  static const mintSurface = Color(0xFFE9F7F1);
  static const text = Color(0xFF14181F);
  static const grey = Color(0xFF5A6273);
  static const red = Color(0xFFB4232F);
  static const white = Color(0xFFFFFFFF);
  static const outline = Color(0xFFCFE3DA);
  static const gold = Color(0xFF8A5A00);
}

/// Font family names registered in pubspec.yaml.
abstract final class AppFonts {
  static const lao = 'NotoSansLao';
  static const latin = 'NotoSansLaoLatin';
  static const fallback = <String>[latin];
}

/// Tabular figures so money and numbers line up.
const tabular = <FontFeature>[FontFeature.tabularFigures()];

ThemeData buildTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: Brand.deepGreen,
    onPrimary: Brand.white,
    primaryContainer: Brand.mintSurface,
    onPrimaryContainer: Brand.deepGreen,
    secondary: Brand.mint,
    onSecondary: Brand.deepGreen,
    secondaryContainer: Color(0xFFC9EEDD),
    onSecondaryContainer: Brand.deepGreen,
    tertiary: Brand.midGreen,
    onTertiary: Brand.white,
    error: Brand.red,
    onError: Brand.white,
    surface: Brand.white,
    onSurface: Brand.text,
    onSurfaceVariant: Brand.grey,
    surfaceContainerLowest: Brand.white,
    surfaceContainerLow: Color(0xFFF6FBF9),
    surfaceContainer: Brand.mintSurface,
    surfaceContainerHigh: Color(0xFFDDF1E8),
    surfaceContainerHighest: Color(0xFFD2ECE0),
    outline: Color(0xFF9DB8AD),
    outlineVariant: Brand.outline,
  );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: AppFonts.lao,
    fontFamilyFallback: AppFonts.fallback,
    scaffoldBackgroundColor: Brand.mintSurface,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.standard,
  );

  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));
  const minButton = Size(64, 52);

  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: Brand.text,
      displayColor: Brand.text,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Brand.deepGreen,
      foregroundColor: Brand.white,
      centerTitle: false,
      elevation: 0,
      titleTextStyle: TextStyle(
        fontFamily: AppFonts.lao,
        fontFamilyFallback: AppFonts.fallback,
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: Brand.white,
      ),
    ),
    cardTheme: CardThemeData(
      color: Brand.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Brand.outline),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.mint,
        foregroundColor: Brand.deepGreen,
        disabledBackgroundColor: const Color(0xFFCFDCD6),
        disabledForegroundColor: Brand.grey,
        minimumSize: minButton,
        shape: shape,
        textStyle: const TextStyle(
          fontFamily: AppFonts.lao,
          fontFamilyFallback: AppFonts.fallback,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Brand.deepGreen,
        side: const BorderSide(color: Brand.midGreen),
        minimumSize: minButton,
        shape: shape,
        textStyle: const TextStyle(
          fontFamily: AppFonts.lao,
          fontFamilyFallback: AppFonts.fallback,
          fontSize: 16,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: Brand.midGreen,
        minimumSize: const Size(48, 48),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: Brand.white,
      selectedColor: Brand.mint,
      side: const BorderSide(color: Brand.outline),
      labelStyle: const TextStyle(
        fontFamily: AppFonts.lao,
        fontFamilyFallback: AppFonts.fallback,
        color: Brand.text,
        fontWeight: FontWeight.w700,
        fontFeatures: tabular,
      ),
      secondaryLabelStyle: const TextStyle(
        fontFamily: AppFonts.lao,
        fontFamilyFallback: AppFonts.fallback,
        color: Brand.deepGreen,
        fontWeight: FontWeight.w700,
        fontFeatures: tabular,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Brand.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Brand.outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Brand.outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Brand.midGreen, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Brand.red),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Brand.white,
      indicatorColor: Brand.mint.withValues(alpha: 0.35),
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontFamily: AppFonts.lao,
          fontFamilyFallback: AppFonts.fallback,
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w400,
          color: states.contains(WidgetState.selected)
              ? Brand.deepGreen
              : Brand.grey,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? Brand.deepGreen
              : Brand.grey,
        ),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Brand.text,
    ),
    dividerTheme: const DividerThemeData(color: Brand.outline, space: 1),
    listTileTheme: const ListTileThemeData(minVerticalPadding: 12),
  );
}
