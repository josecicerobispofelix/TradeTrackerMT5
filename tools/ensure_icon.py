from pathlib import Path

from PIL import Image


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    assets = root / "assets"
    png_path = assets / "app.png"
    ico_path = assets / "app.generated.ico"

    if not png_path.exists():
        raise SystemExit(f"PNG nao encontrado: {png_path}")

    img = Image.open(png_path).convert("RGBA")
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    if ico_path.exists():
        ico_path.unlink()
    img.save(ico_path, format="ICO", sizes=sizes)
    print(f"ICO atualizado: {ico_path}")


if __name__ == "__main__":
    main()
