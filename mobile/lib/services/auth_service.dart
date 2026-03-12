import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

class AuthService {
  static const _keyToken = 'ttmt5_token';
  static const _keyUser = 'ttmt5_user';

  final ApiClient _api = ApiClient();

  Future<Map<String, dynamic>?> login(String email, String password) async {
    final res = await _api.post(
      '/api/auth/login',
      body: {
        'email': email.trim().toLowerCase(),
        'password': password,
      },
      extraHeaders: {'X-Return-Token': 'true'},
    );

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;

      // Corrigido aqui
      final token = data['access_token'] ?? data['token'];

      if (token != null && token is String) {
        _api.setToken(token);
        await _saveSession(token, data);
        return data;
      }
    }

    return null;
  }

  Future<Map<String, dynamic>?> loginWithToken() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_keyToken);

    if (token == null || token.isEmpty) return null;

    _api.setToken(token);

    final res = await _api.get('/api/auth/me');

    if (res.statusCode == 200) {
      final user = jsonDecode(res.body) as Map<String, dynamic>;
      return {
        'id': user['id'],
        'email': user['email'],
        'token': token,
      };
    }

    await logout();
    return null;
  }

  Future<Map<String, dynamic>?> register(String email, String password) async {
    final res = await _api.post(
      '/api/auth/register',
      body: {
        'email': email.trim().toLowerCase(),
        'password': password,
      },
      extraHeaders: {'X-Return-Token': 'true'},
    );

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;

      final token = data['access_token'] ?? data['token'];

      if (token != null && token is String) {
        _api.setToken(token);
        await _saveSession(token, data);
        return data;
      }
    }

    return null;
  }

  Future<void> _saveSession(String token, Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString(_keyToken, token);

    await prefs.setString(
      _keyUser,
      jsonEncode({
        'id': data['id'],
        'email': data['email'],
      }),
    );
  }

  Future<void> logout() async {
    _api.setToken(null);

    final prefs = await SharedPreferences.getInstance();

    await prefs.remove(_keyToken);
    await prefs.remove(_keyUser);
  }

  ApiClient get api => _api;
}