import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.app.license import generate_key


def main():
    if len(sys.argv) < 2:
        print("Uso: python tools/generate_license.py <MACHINE_CODE> [SECRET]")
        sys.exit(1)

    machine_code = sys.argv[1].strip()
    secret = sys.argv[2].strip() if len(sys.argv) >= 3 else os.getenv("LICENSE_SECRET")
    key = generate_key(machine_code, secret)
    print("CHAVE:", key)


if __name__ == "__main__":
    main()
