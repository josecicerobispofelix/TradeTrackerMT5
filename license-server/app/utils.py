import secrets

# Caracteres sem ambiguidade (sem 0/O, 1/I/L)
_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_key() -> str:
    """Gera uma chave no formato TRKR-XXXX-XXXX-XXXX."""
    groups = ["".join(secrets.choice(_CHARSET) for _ in range(4)) for _ in range(3)]
    return f"TRKR-{'-'.join(groups)}"
