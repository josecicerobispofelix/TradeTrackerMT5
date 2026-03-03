# TradeTrackerMT5

Painel web para importar relatórios do MetaTrader 5 (MT5) em XLSX, consolidar histórico e acompanhar metas mensais em BRL com deduplicação forte.

## Licença e uso

Este software é **comercial e proprietário**. O código não é open-source e seu uso, cópia, modificação ou redistribuição sem autorização é proibido.

## Estrutura

- `backend/`: FastAPI + SQLAlchemy async + Alembic (SQLite local)
- `frontend/`: React + Vite (TypeScript) + Recharts

## Pré-requisitos

- Node.js 20+
- Python 3.12+

## Como rodar localmente (Windows)

1. Crie o ambiente Python e instale as dependências:

```bash
py -3.12 -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

2. Suba as migrations e inicie o backend:

```bash
set DATABASE_URL=sqlite+aiosqlite:///./data/tradetracker.db
set CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
cd backend
..\backend\.venv\Scripts\python -m alembic upgrade head
..\backend\.venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3. Em outro terminal, suba o frontend:

```bash
cd frontend
npm install
npm run dev
```

4. Acesse `http://localhost:5173`.

## App Desktop (Windows)

O app desktop abre o painel em uma janela nativa.

1. Instale as dependências (se ainda não fez):

```bash
cd C:\Users\ciler\Documents\TradeTrackerMT5
.\install.ps1
```

2. Gere o app desktop:

```bash
.\build_desktop.ps1
```

3. Instale no Windows (cria atalho na área de trabalho):

```bash
.\install_desktop.bat
```

Depois, abra o atalho "TradeTrackerMT5" criado na área de trabalho.

## Banco MySQL (Hostinger)

Configure o banco em `TradeTrackerMT5.env` (na raiz do projeto). Exemplo:

```
DATABASE_URL=mysql+aiomysql://dados:TradeTracker1411@localhost:3306/TradeTrackerMT5?charset=utf8mb4
```

Observação: `localhost` significa o mesmo computador onde o app roda. Se o MySQL estiver em outro servidor, troque pelo host/IP correto.

## Rotas da API

- `POST /api/upload` - upload do XLSX MT5
- `GET /api/summary?month=YYYY-MM` - resumo mensal
- `GET /api/trades?from=YYYY-MM-DD&to=YYYY-MM-DD&symbol=EURUSD` - histórico filtrado
- `GET /api/fx-rate` - última taxa cadastrada
- `GET /api/fx-rate?date=YYYY-MM-DD` - taxa específica
- `POST /api/fx-rate` - salvar taxa manual
- `GET /api/fx-rate/auto?date=YYYY-MM-DD` - buscar taxa via API pública (opcional)

## Deduplicação forte

- Cada trade recebe `trade_uid` baseado em `deal_id` (se existir) ou hash SHA256 do conteúdo da operação.
- Índice UNIQUE garante que o mesmo trade não é inserido duas vezes.
- Cada arquivo gera um registro em `imports` com `file_hash` e métricas da importação.

## Parser do MT5

O parser procura a seção `Positions`, identifica cabeçalhos e lê linhas até encontrar uma linha vazia. Suporta variações de colunas e extrai metadados como conta, servidor, período e moeda.

## Observações

- A taxa USD/BRL é aplicada por dia. Se não houver taxa para um dia específico, o painel mostra somente valores em USD.
- Se não existir nenhuma taxa cadastrada, o backend tenta buscar automaticamente via API pública e salvar a taxa do dia.
- Para alterar a lógica de "dias restantes" para dias úteis, ajuste o cálculo em `frontend/src/pages/Dashboard.tsx`.
- O banco local SQLite fica em `backend/data/tradetracker.db`.

## Instalador Setup.exe (Inno Setup)

1. Instale o Inno Setup (versão 6).
2. Gere o app desktop:

```
.\build_desktop.ps1
```

3. Gere o instalador:

```
.\build_installer.bat
```

O setup sai em `dist-installer\TradeTrackerMT5-Setup.exe`.
