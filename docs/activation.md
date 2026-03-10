# Ativação de licença – TradeTrackerMT5

## Para quem opera as licenças
1. Defina o segredo (mesmo valor no servidor e no gerador):
   - `LICENSE_SECRET=TTMT5-PRD-20260310-X9E4FQ3K`
   - Configure no ambiente do backend e no terminal ao gerar chaves.
2. Suba o backend (FastAPI):
   - `cd backend`
   - `uvicorn app.main:app --host 0.0.0.0 --port 8000`
3. Endpoints de licença:
   - `GET  /api/license/status` → `{ activated, machine_code }`
   - `POST /api/license/activate { "key": "<license_key>" }` → `{ activated, machine_code }`
4. Gerar chave para um cliente (usando o código de máquina que o app mostra):
   - `cd backend`
   - `set LICENSE_SECRET=TTMT5-PRD-20260310-X9E4FQ3K` (PowerShell/Windows)
   - `python tools/generate_license_keys.py --machine <MACHINE_CODE>`
   - Resultado: `license_key=XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`
   - Envie essa chave ao cliente.

## Para o cliente
1. Instale o TradeTrackerMT5 pelo instalador fornecido.
2. Abra o app: na tela de ativação, copie o **Código da máquina**.
3. Envie o código para receber a chave de licença.
4. Cole a **Chave de licença** no app e clique em **Ativar**.
5. Após ativar, faça login normalmente e use o app.

## Observações
- Uma chave ativa somente na primeira máquina em que for usada (vinculada pelo machine_code).
- Se a chave for reutilizada em outra máquina, o backend rejeita.
- Para revogar/trocar máquina, gere nova chave ou implemente endpoint de revogação.
