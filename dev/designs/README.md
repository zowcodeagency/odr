# Odr brand package

A minimal restaurant-operations identity built around the **Service Loop**:
one order moving clearly from table to kitchen to bill.

## Final files

### Logo

- `logo/odr-logo-primary.svg` - master horizontal logo on transparent canvas.
- `logo/odr-logo-primary.png` - ready-to-share light-background preview.
- `logo/odr-logo-reversed.svg` and `.png` - dark-background version.
- `logo/odr-mark.svg` - standalone scalable mark.
- `logo/odr-mark-monochrome.svg` - single-color reproduction.
- `logo/odr-app-icon.png` - 1024 x 1024 app/social icon.

Use the primary logo by default. Use the standalone mark only where the Odr
name already appears nearby. Keep clear space equal to half the mark diameter.

### Posters

- `posters/01-one-clear-flow.pdf` and `.png`
- `posters/02-whole-restaurant.pdf` and `.png`
- `posters/03-start-small-run-big.pdf` and `.png`

The PDFs are print-ready A3 portrait files. The PNGs are high-resolution
digital previews.

### Product overview

- `odr-product-overview.pdf` - ten-page landscape product and sales narrative.
- `previews/odr-product-overview-01.png` through `-10.png` - page previews.

The overview distinguishes the working core from the planned roadmap and does
not claim an in-product payment gateway.

## Brand colors

| Name | Hex |
|---|---|
| Zowcode Green | `#40D39A` |
| Deep Ink | `#111713` |
| Cool White | `#F7FAF8` |
| Light Mint | `#78E8BF` |
| Forest | `#087A52` |
| Soft Sage | `#E5EDE9` |

Zowcode Green is Odr's primary color. The Odr logos contain no parent-brand
endorsement; the supplied Zowcode mark appears only on the product overview's
closing page for now.

## Rebuild

```bash
python3 -m venv .venv
.venv/bin/pip install -r dev/designs/requirements.txt
.venv/bin/python dev/designs/build_brand.py
```

Render the final previews with Poppler:

```bash
pdftoppm -png -r 72 -singlefile dev/designs/logo/odr-app-icon.pdf dev/designs/logo/odr-app-icon
pdftoppm -png -r 150 -singlefile dev/designs/posters/01-one-clear-flow.pdf dev/designs/posters/01-one-clear-flow
pdftoppm -png -r 120 dev/designs/odr-product-overview.pdf dev/designs/previews/odr-product-overview
```

Run the smoke check:

```bash
.venv/bin/python dev/designs/test_brand.py
```

## Source documents

- `2026-08-24-odr-brand-design.md` - approved brand and content direction.
- `2026-08-24-odr-brand-plan.md` - production and verification plan.
- `build_brand.py` - deterministic source for all SVG and PDF assets.
