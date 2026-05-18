"""
Gera chave(s) de licença no servidor Render e exibe pronta pra enviar ao cliente.

Uso:
    python tools/generate_license.py <email> [transaction_id]

Exemplos:
    python tools/generate_license.py joao@email.com
    python tools/generate_license.py joao@email.com TXN-12345

Requer a variável ADMIN_TOKEN definida no ambiente ou no arquivo .env.admin
na raiz do projeto.
"""

import os
import sys
from pathlib import Path

# Tenta carregar .env.admin se existir
env_file = Path(__file__).parent.parent / ".env.admin"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
SERVER = os.getenv(
    "LICENSE_SERVER_URL",
    "https://tradetrackermt5.onrender.com",
)


def main():
    if not ADMIN_TOKEN:
        print("ERRO: ADMIN_TOKEN não definido.")
        print("Crie o arquivo .env.admin na raiz do projeto com:")
        print("  ADMIN_TOKEN=sua-senha-aqui")
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Uso: python tools/generate_license.py <email> [transaction_id]")
        sys.exit(1)

    email = sys.argv[1].strip()
    transaction_id = sys.argv[2].strip() if len(sys.argv) >= 3 else None

    try:
        import urllib.request
        import urllib.error
        import json

        payload = {"email": email, "quantity": 1}
        if transaction_id:
            payload["transaction_id"] = transaction_id

        req = urllib.request.Request(
            f"{SERVER}/admin/licenses/generate",
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "X-Admin-Token": ADMIN_TOKEN,
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())

    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"ERRO {e.code}: {body}")
        sys.exit(1)
    except Exception as e:
        print(f"ERRO de conexão: {e}")
        sys.exit(1)

    key = data[0]["key"]
    status = data[0]["status"]
    expires = data[0].get("expires_at") or "vitalícia"

    out = sys.stdout
    if hasattr(out, "reconfigure"):
        out.reconfigure(encoding="utf-8", errors="replace")

    print()
    print("=" * 50)
    print(f"  CHAVE GERADA: {key}")
    print(f"  Email:        {email}")
    if transaction_id:
        print(f"  Transacao:    {transaction_id}")
    print(f"  Validade:     {expires}")
    print(f"  Status:       {status}")
    print("=" * 50)
    print()
    print("--- Mensagem pronta pra enviar ao cliente ---")
    print()
    print("Ola! Segue sua chave de licenca do TradeTrackerMT5:")
    print()
    print(f"  {key}")
    print()
    print("Para ativar, abra o aplicativo e insira a chave na tela de ativacao.")
    print("Em caso de duvidas, entre em contato com o suporte.")
    print()


if __name__ == "__main__":
    main()
