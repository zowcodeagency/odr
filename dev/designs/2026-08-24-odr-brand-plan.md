# Odr Brand Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a complete Odr logo system, three marketing posters, and a polished product-overview PDF in `dev/designs`.

**Architecture:** One small Python build script owns the shared palette, logo geometry, page primitives, and exports so every artifact remains consistent and reproducible. SVG is the master logo format; ReportLab generates PDFs, and Poppler renders final PNG previews for inspection.

**Tech Stack:** Python 3, ReportLab, SVG, Poppler (`pdftoppm`, `pdfinfo`)

**Spec:** `dev/designs/2026-08-24-odr-brand-design.md`

## Global Constraints

- Primary product name is `odr`; Odr logo files carry no parent endorsement.
- Zowcode Green is `#40D39A`; Deep Ink is `#111713`; Cool White is `#F7FAF8`; Light Mint is `#78E8BF`.
- Do not claim an in-product payment gateway.
- Mark planned capabilities explicitly.
- Write only under `dev/designs`.
- Preserve unrelated working-tree changes.

---

### Task 1: Reproducible brand generator

**Files:**
- Create: `dev/designs/build_brand.py`
- Create: `dev/designs/test_brand.py`

**Interfaces:**
- Produces: `build_all(output_dir: Path) -> list[Path]`
- Produces: shared color constants and logo drawing helpers used by every artifact.

- [ ] **Step 1: Write the failing smoke test**

Create a test that imports `build_all`, builds into a temporary directory, and
asserts that the expected SVG/PDF files exist, have non-zero sizes, and contain
no placeholder strings.

- [ ] **Step 2: Run the test to verify it fails**

Run: `python3 dev/designs/test_brand.py`

Expected: import failure because `build_brand.py` does not exist.

- [ ] **Step 3: Implement the shared primitives**

Implement palette constants, page typography, rounded cards, the Service Loop
symbol and the `odr` wordmark in one dependency-light module.

- [ ] **Step 4: Run the test**

Run: `python3 dev/designs/test_brand.py`

Expected: PASS.

### Task 2: Logo source and exports

**Files:**
- Generated: `dev/designs/logo/odr-logo-primary.svg`
- Generated: `dev/designs/logo/odr-logo-reversed.svg`
- Generated: `dev/designs/logo/odr-mark.svg`
- Generated: `dev/designs/logo/odr-mark-monochrome.svg`
- Generated: `dev/designs/logo/odr-app-icon.pdf`
- Generated: `dev/designs/logo/odr-app-icon.png`

**Interfaces:**
- Consumes: logo primitives from `build_brand.py`.
- Produces: scalable identity assets for product and marketing use.

- [ ] **Step 1: Generate the SVG master files and app-icon PDF**

Run: `python3 dev/designs/build_brand.py`

- [ ] **Step 2: Render the exact-size app icon**

Run: `pdftoppm -png -r 72 -singlefile dev/designs/logo/odr-app-icon.pdf dev/designs/logo/odr-app-icon`

- [ ] **Step 3: Verify SVG structure and dimensions**

Run: `python3 dev/designs/test_brand.py`

Expected: PASS with all logo assets present and valid SVG roots/viewBoxes.

### Task 3: Marketing poster set

**Files:**
- Generated: `dev/designs/posters/01-one-clear-flow.pdf`
- Generated: `dev/designs/posters/02-whole-restaurant.pdf`
- Generated: `dev/designs/posters/03-start-small-run-big.pdf`
- Generated: matching `.png` previews.

**Interfaces:**
- Consumes: shared palette, typography, and logo primitives.
- Produces: three self-contained A3 portrait marketing creatives.

- [ ] **Step 1: Build the three poster PDFs**

Run: `python3 dev/designs/build_brand.py`

- [ ] **Step 2: Render poster previews**

Run `pdftoppm -png -r 150 -singlefile` for each poster PDF.

- [ ] **Step 3: Inspect all three previews**

Check hierarchy, margins, color consistency, legibility, and absence of clipped
copy or accidental placeholder content.

### Task 4: Product overview PDF

**Files:**
- Generated: `dev/designs/odr-product-overview.pdf`
- Generated: `dev/designs/previews/odr-product-overview-01.png` through page 10.

**Interfaces:**
- Consumes: the approved content and shared brand primitives.
- Produces: a ten-page landscape sales and product narrative.

- [ ] **Step 1: Generate the ten-page PDF**

Run: `python3 dev/designs/build_brand.py`

- [ ] **Step 2: Verify file structure and copy**

Run: `pdfinfo dev/designs/odr-product-overview.pdf`

Expected: 10 pages with landscape dimensions.

- [ ] **Step 3: Render every page for review**

Run: `pdftoppm -png -r 120 dev/designs/odr-product-overview.pdf dev/designs/previews/odr-product-overview`

- [ ] **Step 4: Inspect all rendered pages**

Verify consistent headers/footers, page numbering, clean transitions, sharp
graphics, and no overlap, clipping, black squares, or unreadable text.

### Task 5: Final quality gate

**Files:**
- Create: `dev/designs/README.md`

**Interfaces:**
- Consumes: all final exports.
- Produces: a short usage guide and verified deliverables index.

- [ ] **Step 1: Run the complete smoke test**

Run: `python3 dev/designs/test_brand.py`

Expected: PASS.

- [ ] **Step 2: Extract PDF text for factual review**

Run a short Python check with `pypdf` or `pdfplumber` and confirm forbidden
claims such as an included payment gateway are absent.

- [ ] **Step 3: Record build and usage instructions**

Document the source files, final outputs, color values, safe logo usage, and
one-command rebuild in `dev/designs/README.md`.
