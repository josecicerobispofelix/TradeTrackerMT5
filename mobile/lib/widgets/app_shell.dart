import 'package:flutter/material.dart';

/// Contêiner de fundo que replica o gradiente e o limite de largura do desktop.
class TradeAppShell extends StatelessWidget {
  const TradeAppShell({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: RadialGradient(
          center: Alignment.topCenter,
          radius: 1.2,
          colors: <Color>[
            Color(0xFF0F172A),
            Color(0xFF0B0F14),
            Color(0xFF070B10),
          ],
        ),
      ),
      child: Stack(
        children: <Widget>[
          // Brilhos laterais aproximando os blobs do CSS.
          Positioned(
            top: -160,
            right: -140,
            child: _GlowCircle(
              color: const Color(0x8C22D3EE),
            ),
          ),
          Positioned(
            bottom: -200,
            left: -160,
            child: _GlowCircle(
              color: const Color(0x73F97316),
            ),
          ),
          Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1760),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

class _GlowCircle extends StatelessWidget {
  const _GlowCircle({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      ignoring: true,
      child: Container(
        width: 520,
        height: 520,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: color,
              blurRadius: 140,
              spreadRadius: 40,
            ),
          ],
        ),
      ),
    );
  }
}

