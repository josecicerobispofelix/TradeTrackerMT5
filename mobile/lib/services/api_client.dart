import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();

  factory ApiClient() {
    return _instance;
  }

  ApiClient._internal();

  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> get _headers {
    final map = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (_token != null && _token!.isNotEmpty) {
      map['Authorization'] = 'Bearer $_token';
    }

    return map;
  }

  Future<http.Response> get(String path, {Map<String, String>? queryParams}) async {
    var uri = Uri.parse('${ApiConfig.baseUrl}$path');

    if (queryParams != null && queryParams.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParams);
    }

    return http.get(uri, headers: _headers);
  }

  Future<http.Response> post(String path,
      {Object? body, Map<String, String>? extraHeaders}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');

    final headers = Map<String, String>.from(_headers);

    if (extraHeaders != null) headers.addAll(extraHeaders);

    return http.post(
      uri,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );
  }

  Future<http.Response> postMultipart(
      String path, String fieldName, List<int> fileBytes, String filename) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');

    final request = http.MultipartRequest('POST', uri);

    request.headers.addAll({
      'Accept': 'application/json',
      if (_token != null && _token!.isNotEmpty)
        'Authorization': 'Bearer $_token',
    });

    request.files.add(
      http.MultipartFile.fromBytes(
        fieldName,
        fileBytes,
        filename: filename,
      ),
    );

    final streamed = await request.send();

    return http.Response.fromStream(streamed);
  }

  static String errorMessage(dynamic body) {
    if (body == null) return 'Erro na API';

    if (body is String) return body;

    if (body is Map) {
      final detail = body['detail'];

      if (detail is String) return detail;

      if (detail is List) return detail.join(' | ');
    }

    return 'Erro na API';
  }
}