/// API base URL. Change for production or use env.
class ApiConfig {

  // IP do seu computador na rede
  static const String defaultBaseUrl = 'http://192.168.100.46:8000';

  static String baseUrl = defaultBaseUrl;

  static void setBaseUrl(String url) {
    baseUrl = url.endsWith('/')
        ? url.substring(0, url.length - 1)
        : url;
  }
}