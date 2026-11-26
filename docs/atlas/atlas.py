"""Keep the documented repository CLI entry point stable."""

from pathlib import Path
from runpy import run_path


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    run_path(str(root / "backend" / "atlas_content" / "atlas.py"), run_name="__main__")