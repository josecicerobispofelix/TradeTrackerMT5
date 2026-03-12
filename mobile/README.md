# TradersTrackerMT5 – App Android (Flutter)

App mobile para acompanhar estatísticas de trading do MetaTrader 5, conectado ao backend FastAPI do TradersTrackerMT5.

## Requisitos

- Flutter SDK >= 3.2 (stable)
- Android SDK (para gerar APK)

## Configuração

1. Clone o repositório e entre na pasta do app:

   ```bash
   cd mobile
   ```

2. Instale as dependências:

   ```bash
   flutter pub get
   ```

3. Configure a URL do backend em `lib/config/api_config.dart` (opcional). Padrão para emulador Android: `http://10.0.2.2:8000`. Em dispositivo físico use o IP da máquina onde o backend roda, ex.: `http://192.168.1.10:8000`.

## Rodar no emulador ou dispositivo

```bash
flutter run
```

## Gerar APK (release)

1. Gerar APK de release (arquivo único para instalação manual):

   ```bash
   flutter build apk --release
   ```

   O APK sai em: `build/app/outputs/flutter-apk/app-release.apk`.

2. (Opcional) Gerar App Bundle para publicar na Play Store:

   ```bash
   flutter build appbundle --release
   ```

   O bundle sai em: `build/app/outputs/bundle/release/app-release.aab`.

## Assinatura (release)

Para assinar o APK/AAB com sua chave, crie `android/key.properties` (não versionado):

```properties
storePassword=...
keyPassword=...
keyAlias=...
storeFile=../caminho/para/keystore.jks
```

E configure `android/app/build.gradle` para usar `key.properties` na build de release (ver documentação Flutter: [Android deployment](https://docs.flutter.dev/deployment/android)).

## Funcionalidades

- **Login/Registro** – autenticação com token (Bearer).
- **Dashboard** – resultado líquido, total de trades, vitórias/derrotas, win rate, gráfico de evolução diária.
- **Histórico** – filtros por período, ativo e conta; lista de trades com resultado.
- **Upload** – envio de relatório MT5 em XLSX.
- **Perfil** – perfil fiscal (nome, CPF, corretora, conta, moeda, alíquota).

## Backend

O backend deve estar rodando (FastAPI). Para uso com app em dispositivo/emulador na rede:

```bash
set MOBILE_CORS=1
set DATABASE_URL=sqlite+aiosqlite:///./data/tradetracker.db
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Documentação dos endpoints: [docs/API_MOBILE.md](../docs/API_MOBILE.md).
