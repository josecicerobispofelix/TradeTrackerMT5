import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';
import 'screens/login_screen.dart';
import 'services/auth_service.dart';
import 'theme/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  runApp(const TradersTrackerApp());
}

class TradersTrackerApp extends StatelessWidget {
  const TradersTrackerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TradersTrackerMT5',
      debugShowCheckedModeBanner: false,
      theme: TradeTheme.dark(),
      home: const AppShell(),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final AuthService _auth = AuthService();
  bool _checked = false;
  bool _authenticated = false;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final data = await _auth.loginWithToken();
    if (!mounted) return;
    setState(() {
      _authenticated = data != null;
      _checked = true;
    });
  }

  void _onLogin() {
    setState(() => _authenticated = true);
  }

  Future<void> _onLogout() async {
    await _auth.logout();
    if (!mounted) return;
    setState(() => _authenticated = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!_checked) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (!_authenticated) {
      return LoginScreen(onLogin: _onLogin);
    }
    return App(authService: _auth, onLogout: _onLogout);
  }
}
