from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from build_brand import build_all


EXPECTED = {
    "logo/odr-logo-primary.svg",
    "logo/odr-logo-reversed.svg",
    "logo/odr-mark.svg",
    "logo/odr-mark-monochrome.svg",
    "logo/odr-app-icon.pdf",
    "logo/odr-logo-primary.pdf",
    "logo/odr-logo-reversed.pdf",
    "posters/01-one-clear-flow.pdf",
    "posters/02-whole-restaurant.pdf",
    "posters/03-start-small-run-big.pdf",
    "odr-product-overview.pdf",
}


def pdf_pages(path: Path) -> int:
    info = subprocess.run(
        ["pdfinfo", str(path)], check=True, capture_output=True, text=True
    ).stdout
    line = next(line for line in info.splitlines() if line.startswith("Pages:"))
    return int(line.split(":", 1)[1].strip())


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="odr-brand-") as directory:
        root = Path(directory)
        built = {path.relative_to(root).as_posix() for path in build_all(root)}
        assert EXPECTED <= built, EXPECTED - built

        for relative in EXPECTED:
            path = root / relative
            assert path.is_file(), relative
            minimum = 250 if path.suffix == ".svg" else 500
            assert path.stat().st_size > minimum, relative

        for path in (root / "logo").glob("*.svg"):
            source = path.read_text(encoding="utf-8")
            assert source.startswith("<svg")
            assert "viewBox=" in source
            assert "TODO" not in source and "TBD" not in source
            assert "Zowcode" not in source

        primary = (root / "logo" / "odr-logo-primary.svg").read_text(encoding="utf-8")
        assert "#40D39A" in primary
        assert "#FF5A36" not in primary

        assert pdf_pages(root / "odr-product-overview.pdf") == 10
        print("PASS: Odr brand package smoke test")


if __name__ == "__main__":
    main()
