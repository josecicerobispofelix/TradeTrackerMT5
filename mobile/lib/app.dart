import 'package:flutter/material.dart';

import 'screens/dashboard_screen.dart';
import 'screens/darf_screen.dart';
import 'screens/history_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/upload_screen.dart';
import 'services/auth_service.dart';
import 'widgets/app_shell.dart';

class App extends StatelessWidget {
  const App({
    super.key,
    required AuthService authService,
    required VoidCallback onLogout,
  })  : _auth = authService,
        _onLogout = onLogout;

  final AuthService _auth;
  final VoidCallback _onLogout;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: TradeAppShell(
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            titleSpacing: 24,
            title: const _TopBrand(),
            actions: <Widget>[
              IconButton(
                icon: const Icon(Icons.logout),
                tooltip: 'Sair',
                onPressed: _onLogout,
              ),
            ],
            bottom: const TabBar(
              tabs: <Widget>[
                Tab(text: 'Dashboard'),
                Tab(text: 'Histórico'),
                Tab(text: 'Upload'),
                Tab(text: 'DARF'),
                Tab(text: 'Configurações'),
              ],
            ),
          ),
          body: TabBarView(
            children: <Widget>[
              DashboardScreen(api: _auth.api),
              HistoryScreen(api: _auth.api),
              UploadScreen(api: _auth.api),
              DarfScreen(api: _auth.api),
              ProfileScreen(api: _auth.api),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopBrand extends StatelessWidget {
  const _TopBrand();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        Text(
          'TradersTrackerMT5',
          style: theme.appBarTheme.titleTextStyle,
        ),
        const SizedBox(height: 2),
        Text(
          'Painel de trades MetaTrader 5',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}

