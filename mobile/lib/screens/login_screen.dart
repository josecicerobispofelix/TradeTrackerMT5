import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../widgets/app_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onLogin});

  final VoidCallback onLogin;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final AuthService _auth = AuthService();
  final TextEditingController _emailCtrl = TextEditingController();
  final TextEditingController _passCtrl = TextEditingController();

  bool _loading = false;
  bool _isRegister = false;
  String? _error;
  String? _message;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final String email = _emailCtrl.text.trim();
    final String pass = _passCtrl.text;
    if (email.isEmpty) {
      setState(() => _error = 'Informe o e-mail.');
      return;
    }
    if (pass.length < 6) {
      setState(() => _error = 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _message = null;
    });
    try {
      final Map<String, dynamic>? data =
          _isRegister ? await _auth.register(email, pass) : await _auth.login(email, pass);
      if (!mounted) return;
      if (data != null) {
        widget.onLogin();
      } else {
        setState(() => _error = 'E-mail ou senha inválidos.');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: TradeAppShell(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(
                          'Login obrigatório',
                          style: theme.textTheme.titleLarge,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Crie seu login ou entre para continuar.',
                          style: theme.textTheme.bodySmall,
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: <Widget>[
                            SegmentedButton<bool>(
                              segments: const <ButtonSegment<bool>>[
                                ButtonSegment<bool>(
                                  value: false,
                                  label: Text('Entrar'),
                                  icon: Icon(Icons.login),
                                ),
                                ButtonSegment<bool>(
                                  value: true,
                                  label: Text('Criar conta'),
                                  icon: Icon(Icons.person_add),
                                ),
                              ],
                              selected: <bool>{_isRegister},
                              onSelectionChanged: (Set<bool> s) =>
                                  setState(() => _isRegister = s.first),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        TextField(
                          controller: _emailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'E-mail',
                          ),
                          autocorrect: false,
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _passCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Senha (mín. 6 caracteres)',
                          ),
                          obscureText: true,
                        ),
                        if (_error != null) ...<Widget>[
                          const SizedBox(height: 16),
                          Text(
                            _error!,
                            style: TextStyle(color: theme.colorScheme.error),
                          ),
                        ],
                        if (_message != null) ...<Widget>[
                          const SizedBox(height: 16),
                          Text(
                            _message!,
                            style: TextStyle(color: theme.colorScheme.primary),
                          ),
                        ],
                        const SizedBox(height: 20),
                        Align(
                          alignment: Alignment.centerRight,
                          child: FilledButton(
                            onPressed: _loading ? null : _submit,
                            child: _loading
                                ? const SizedBox(
                                    height: 24,
                                    width: 24,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : Text(_isRegister ? 'Criar conta' : 'Entrar'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
