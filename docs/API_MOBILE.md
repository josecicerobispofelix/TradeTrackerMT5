# TradersTrackerMT5 – API para o app mobile

O backend FastAPI já existente foi estendido para suportar o app Android (Flutter) via **Bearer token** e novos endpoints.

## Autenticação (mobile)

- O app envia o header **`X-Return-Token: true`** em `POST /api/auth/login` e `POST /api/auth/register`.
- A resposta inclui `token` e `expires_at` no JSON (em vez de apenas `id` e `email`). O cookie de sessão **não** é definido nesse caso.
- Nas demais requisições, o app envia **`Authorization: Bearer <token>`**.

### Exemplo login (mobile)

```http
POST /api/auth/login
Content-Type: application/json
X-Return-Token: true

{"email": "user@example.com", "password": "senha123"}
```

Resposta (200):

```json
{
  "id": 1,
  "email": "user@example.com",
  "token": "abc123...",
  "expires_at": "2025-04-09T12:00:00Z"
}
```

### Exemplo requisição autenticada

```http
GET /api/dashboard/stats?month=2025-03
Authorization: Bearer abc123...
```

## Endpoints usados pelo app

| Método | Caminho | Descrição |
|--------|---------|-----------|
| POST | `/api/auth/login` | Login (com `X-Return-Token: true` para receber token) |
| POST | `/api/auth/register` | Registro (com `X-Return-Token: true`) |
| GET | `/api/auth/me` | Usuário atual (Bearer) |
| GET | `/api/dashboard/stats?month=YYYY-MM` | Estatísticas do mês (Bearer) |
| GET | `/api/trades?from=&to=&symbol=&account=` | Lista de trades (Bearer) |
| GET | `/api/trades/meta?from=&to=` | Símbolos e contas (Bearer) |
| POST | `/api/upload` | Upload de XLSX (multipart, Bearer) |
| GET | `/api/fiscal-profile` | Perfil fiscal (Bearer) |
| POST | `/api/fiscal-profile` | Salvar perfil fiscal (Bearer) |
| GET | `/api/health` | Saúde (sem auth) |

## Dashboard stats (novo)

**GET /api/dashboard/stats?month=YYYY-MM**

Resposta (200):

```json
{
  "month": "2025-03",
  "total_trades": 42,
  "total_wins": 28,
  "total_losses": 14,
  "win_rate_pct": 66.67,
  "net_profit": 1250.50,
  "net_profit_brl": 6250.25,
  "gross_profit": 2000.00,
  "gross_loss": -750.50,
  "profit_factor": 2.67,
  "daily": [
    {
      "date": "2025-03-01",
      "trades": 5,
      "wins": 3,
      "losses": 2,
      "net_profit": 120.00,
      "net_profit_brl": 600.00
    }
  ]
}
```

## CORS para mobile

Se o app mobile acessar o backend em outro host (ex.: servidor na rede), use:

- **MOBILE_CORS=1** – libera CORS com `allow_origins=["*"]` e `allow_credentials=False` (compatível com Bearer token).

Exemplo:

```bash
set MOBILE_CORS=1
set DATABASE_URL=sqlite+aiosqlite:///./data/tradetracker.db
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

No emulador Android, use `http://10.0.2.2:8000` como base URL (equivale ao localhost do PC).
