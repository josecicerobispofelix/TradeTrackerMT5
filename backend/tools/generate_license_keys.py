"""
Gerador de chaves de licença para o TradeTrackerMT5.

Uso:
  python tools/generate_license_keys.py --machine 1234ABCD5678EF90
  python tools/generate_license_keys.py --machine 1234... --machine ABCD...

Opcional:
  defina LICENSE_SECRET no ambiente para usar o mesmo segredo do backend em produção.
"""

import argparse
import os
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.license import generate_key, _normalize_key  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Gerar chave de licença a partir do machine_code")
    parser.add_argument(
        "--machine",
        action="append",
        dest="machines",
        help="Código da máquina (use o exibido na tela de ativação)",
        required=True,
    )
    parser.add_argument(
        "--secret",
        dest="secret",
        default=os.getenv("LICENSE_SECRET"),
        help="Segredo opcional (se não informado usa LICENSE_SECRET ou padrão).",
    )
    args = parser.parse_args()

    secret = args.secret

    for m in args.machines:
        normalized = _normalize_key(m)
        key = generate_key(normalized, secret=secret)
        print(f"machine_code={normalized}  ->  license_key={key}")


if __name__ == "__main__":
    main()
