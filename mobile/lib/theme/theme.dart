import 'package:flutter/material.dart';

/// Centraliza a identidade visual do TradersTrackerMT5.
///
/// Os valores aqui foram espelhados do frontend desktop (CSS),
/// para manter cores, contraste e sensação visual equivalentes.
class TradeTheme {
  TradeTheme._();

  /// Tema escuro principal baseado no layout desktop.
  static ThemeData dark() {
    const bg = Color(0xFF0B0F14); // --bg
    const surface = Color(0xD010141B); // --surface com alpha
    const surface2 = Color(0xB3121821); // --surface-2
    const ink = Color(0xFFE5E7EB); // --ink
    const muted = Color(0xFF9AA4B2); // --muted
    const accent = Color(0xFF22D3EE); // --accent
    const accent2 = Color(0xFF38BDF8); // --accent-2
    const accent3 = Color(0xFFF97316); // --accent-3
    const success = Color(0xFF22C55E); // --success
    const danger = Color(0xFFEF4444); // --danger

    final colorScheme = ColorScheme.fromSeed(
      seedColor: accent2,
      brightness: Brightness.dark,
      primary: accent2,
      secondary: accent,
      surface: surface,
      background: bg,
      onBackground: ink,
      onSurface: ink,
      error: danger,
    );

    const radius = 18.0;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: bg,
      fontFamily: 'Manrope', // equivalente web
      textTheme: _textTheme(ink, muted),
      appBarTheme: const AppBarTheme(
        elevation: 0,
        centerTitle: false,
        backgroundColor: Color(0xE10A0E14),
        foregroundColor: ink,
        titleTextStyle: TextStyle(
          fontFamily: 'SpaceGrotesk',
          fontSize: 20,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.6,
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 10,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: muted.withOpacity(0.2)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xA3090E14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: muted.withOpacity(0.3)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: muted.withOpacity(0.3)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: accent2, width: 1.4),
        ),
        labelStyle: const TextStyle(
          fontSize: 13,
          color: muted,
          letterSpacing: 0.4,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 12,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          backgroundColor: accent2,
          foregroundColor: const Color(0xFF031018),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          backgroundColor: accent2,
          foregroundColor: const Color(0xFF031018),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: const Color(0x1FFFFFFF),
        selectedColor: accent,
        labelStyle: const TextStyle(
          fontSize: 11,
          letterSpacing: 0.6,
          fontWeight: FontWeight.w600,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
          side: BorderSide(color: muted.withOpacity(0.35)),
        ),
      ),
      tabBarTheme: const TabBarThemeData(
        indicatorSize: TabBarIndicatorSize.label,
        labelColor: ink,
        unselectedLabelColor: muted,
        labelStyle: TextStyle(
          fontWeight: FontWeight.w600,
          fontSize: 13,
          letterSpacing: 0.6,
        ),
        unselectedLabelStyle: TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 13,
          letterSpacing: 0.4,
        ),
        indicator: UnderlineTabIndicator(
          borderSide: BorderSide(width: 2, color: accent2),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: muted.withOpacity(0.25),
      ),
    );
  }

  static TextTheme _textTheme(Color ink, Color muted) {
    return TextTheme(
      headlineSmall: TextStyle(
        fontFamily: 'SpaceGrotesk',
        fontSize: 24,
        fontWeight: FontWeight.w600,
        color: ink,
      ),
      titleLarge: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        color: ink,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        color: ink,
      ),
      bodySmall: TextStyle(
        fontSize: 12,
        color: muted,
      ),
    );
  }
}

