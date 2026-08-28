from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A3
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas


BRAND = HexColor("#40D39A")
INK = HexColor("#111713")
CREAM = HexColor("#F7FAF8")
MINT = HexColor("#78E8BF")
GREEN = HexColor("#087A52")
SAND = HexColor("#E5EDE9")
MUTED = HexColor("#66736D")
WHITE = HexColor("#FFFFFF")

SLIDE = (960, 540)
BASE = Path(__file__).resolve().parent
ZOWCODE_LOGO = BASE.parent / "zowcode-assets" / "zowcode.png"


def rgb(color: HexColor) -> str:
    return "#{:02X}{:02X}{:02X}".format(
        round(color.red * 255), round(color.green * 255), round(color.blue * 255)
    )


def ensure_dirs(root: Path) -> None:
    for name in ("logo", "posters", "previews"):
        (root / name).mkdir(parents=True, exist_ok=True)


def svg_mark(color: HexColor, background: HexColor | None = None) -> str:
    backdrop = (
        f'<rect width="256" height="256" rx="58" fill="{rgb(background)}"/>'
        if background
        else ""
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
        f"{backdrop}"
        f'<circle cx="122" cy="128" r="72" fill="none" stroke="{rgb(color)}" '
        'stroke-width="30" stroke-linecap="round" stroke-dasharray="402 50" '
        'transform="rotate(7 122 128)"/>'
        f'<circle cx="220" cy="128" r="15" fill="{rgb(color)}"/>'
        "</svg>"
    )


def svg_logo(reversed_: bool = False) -> str:
    background = INK if reversed_ else None
    mark = BRAND
    word = CREAM if reversed_ else INK
    backdrop = (
        f'<rect width="820" height="240" rx="28" fill="{rgb(background)}"/>'
        if background
        else ""
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 240">
  {backdrop}
  <circle cx="112" cy="120" r="68" fill="none" stroke="{rgb(mark)}" stroke-width="28" stroke-linecap="round" stroke-dasharray="380 47" transform="rotate(7 112 120)"/>
  <circle cx="204" cy="120" r="14" fill="{rgb(mark)}"/>
  <text x="235" y="144" fill="{rgb(word)}" font-family="Helvetica, Arial, sans-serif" font-size="116" font-weight="700" letter-spacing="-7">odr</text>
</svg>'''


def write_svg_assets(root: Path) -> list[Path]:
    assets = {
        "odr-logo-primary.svg": svg_logo(),
        "odr-logo-reversed.svg": svg_logo(True),
        "odr-mark.svg": svg_mark(BRAND),
        "odr-mark-monochrome.svg": svg_mark(INK),
    }
    paths = []
    for name, source in assets.items():
        path = root / "logo" / name
        path.write_text(source, encoding="utf-8")
        paths.append(path)
    return paths


def draw_mark(c: Canvas, x: float, y: float, size: float, color=BRAND) -> None:
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(size * 0.13)
    c.setLineCap(1)
    inset = size * 0.2
    c.arc(x + inset, y + inset, x + size - inset, y + size - inset, 20, 320)
    c.circle(x + size * 0.91, y + size * 0.5, size * 0.065, fill=1, stroke=0)
    c.restoreState()


def draw_wordmark(
    c: Canvas,
    x: float,
    y: float,
    height: float,
    color=INK,
    mark_color=BRAND,
) -> None:
    draw_mark(c, x, y, height, mark_color)
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", height * 0.62)
    c.drawString(x + height * 1.08, y + height * 0.27, "odr")


def draw_app_icon(path: Path) -> None:
    c = Canvas(str(path), pagesize=(1024, 1024))
    c.setFillColor(BRAND)
    c.roundRect(0, 0, 1024, 1024, 224, fill=1, stroke=0)
    draw_mark(c, 180, 180, 664, CREAM)
    c.showPage()
    c.save()


def draw_logo_preview(path: Path, reversed_: bool = False) -> None:
    c = Canvas(str(path), pagesize=(820, 240))
    c.setFillColor(INK if reversed_ else CREAM)
    c.rect(0, 0, 820, 240, fill=1, stroke=0)
    draw_wordmark(
        c,
        38,
        42,
        156,
        CREAM if reversed_ else INK,
        BRAND,
    )
    c.showPage()
    c.save()


def wrap_lines(text: str, font: str, size: float, width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if stringWidth(candidate, font, size) <= width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def text_block(
    c: Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    size: float,
    color=INK,
    font: str = "Helvetica",
    leading: float | None = None,
) -> float:
    leading = leading or size * 1.25
    c.setFillColor(color)
    c.setFont(font, size)
    for line in wrap_lines(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def label(c: Canvas, text: str, x: float, y: float, color=BRAND) -> None:
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x, y, text.upper())


def pill(c: Canvas, text: str, x: float, y: float, fill, ink=INK) -> float:
    width = stringWidth(text, "Helvetica-Bold", 9) + 22
    c.setFillColor(fill)
    c.roundRect(x, y, width, 24, 12, fill=1, stroke=0)
    c.setFillColor(ink)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x + width / 2, y + 8, text)
    return width


def card(c: Canvas, x: float, y: float, w: float, h: float, fill=WHITE) -> None:
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, 18, fill=1, stroke=0)


def footer(c: Canvas, page: int, dark: bool = False) -> None:
    color = CREAM if dark else MUTED
    c.setFillColor(color)
    c.setFont("Helvetica", 8)
    c.drawString(54, 24, "Odr - restaurant operations, made clear")
    c.drawRightString(SLIDE[0] - 54, 24, f"{page:02d}")


def poster_header(c: Canvas, dark: bool = False) -> None:
    draw_wordmark(c, 64, A3[1] - 126, 62, CREAM if dark else INK, BRAND)


def draw_flow(c: Canvas, y: float, dark: bool = False) -> None:
    names = ("TABLE", "ORDER", "KITCHEN", "BILL")
    descriptions = ("Open table", "Captain or QR", "KOT / KDS", "GST / VAT")
    xs = (120, 320, 520, 720)
    line_color = BRAND
    c.setStrokeColor(line_color)
    c.setLineWidth(8)
    c.setLineCap(1)
    c.line(xs[0], y, xs[-1], y)
    for index, (x, name, description) in enumerate(zip(xs, names, descriptions), 1):
        c.setFillColor(BRAND if index < 4 else GREEN)
        c.circle(x, y, 26, fill=1, stroke=0)
        c.setFillColor(CREAM if dark else WHITE)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(x, y - 4, str(index))
        c.setFillColor(CREAM if dark else INK)
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(x, y - 58, name)
        c.setFillColor(CREAM if dark else MUTED)
        c.setFont("Helvetica", 9)
        c.drawCentredString(x, y - 74, description)


def poster_one(path: Path) -> None:
    w, h = A3
    c = Canvas(str(path), pagesize=A3)
    c.setFillColor(INK)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    poster_header(c, True)
    label(c, "The Odr service loop", 64, h - 202, MINT)
    text_block(c, "Every order,\none clear flow.", 64, h - 292, w - 128, 64, CREAM, "Helvetica-Bold", 68)
    text_block(
        c,
        "From the first tap at the table to the final printed bill - without duplicate entry, lost KOTs, or crowded screens.",
        68,
        h - 462,
        w - 210,
        18,
        SAND,
        leading=26,
    )
    draw_flow(c, 410, True)
    c.setFillColor(BRAND)
    c.roundRect(64, 76, w - 128, 150, 28, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(96, 164, "Table. Kitchen. Bill. Connected.")
    c.setFont("Helvetica", 15)
    c.drawString(96, 126, "Built for the pace of real restaurants.")
    c.showPage()
    c.save()


def poster_two(path: Path) -> None:
    w, h = A3
    c = Canvas(str(path), pagesize=A3)
    c.setFillColor(CREAM)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    poster_header(c)
    label(c, "One calm operating system", 64, h - 202)
    text_block(c, "Built for the whole\nrestaurant.", 64, h - 288, w - 128, 58, INK, "Helvetica-Bold", 62)
    features = (
        ("01", "Table control", "See every open, active, and settled table at a glance."),
        ("02", "Captain ordering", "Take orders on a phone or tablet and fire the KOT instantly."),
        ("03", "Kitchen clarity", "Print KOTs or run a large, readable kitchen display."),
        ("04", "Menu control", "Add items quickly and manage price, tax, stock, and outlet menus."),
        ("05", "Clean billing", "Create sequential GST or VAT invoices and print without friction."),
        ("06", "Daily visibility", "Track sales, top items, channels, and outlet performance."),
    )
    card_w, card_h = (w - 148) / 2, 186
    start_y = 620
    for index, (number, title, body) in enumerate(features):
        col, row = index % 2, index // 2
        x = 64 + col * (card_w + 20)
        y = start_y - row * (card_h + 20)
        card(c, x, y, card_w, card_h, WHITE)
        c.setFillColor(BRAND)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(x + 26, y + card_h - 38, number)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(x + 26, y + card_h - 76, title)
        text_block(c, body, x + 26, y + card_h - 112, card_w - 52, 13, MUTED, leading=19)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(64, 52, "Only what the restaurant needs. Nothing in the way.")
    c.showPage()
    c.save()


def poster_three(path: Path) -> None:
    w, h = A3
    c = Canvas(str(path), pagesize=A3)
    c.setFillColor(BRAND)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    draw_wordmark(c, 64, h - 126, 62, INK, INK)
    label(c, "For every independent restaurant", 64, h - 202, CREAM)
    text_block(c, "Start small.\nRun big.", 64, h - 294, w - 128, 72, INK, "Helvetica-Bold", 76)
    text_block(
        c,
        "The same simple flow works for a ten-item cafe, a busy dining room, or a growing multi-outlet brand.",
        68,
        h - 480,
        w - 180,
        18,
        INK,
        leading=27,
    )
    stages = (
        (110, 230, "CAFE", "Fast menu setup"),
        (286, 310, "RESTAURANT", "Tables + KOT + billing"),
        (512, 400, "MULTI-OUTLET", "One view across locations"),
    )
    for x, height, title, subtitle in stages:
        c.setFillColor(CREAM)
        c.roundRect(x, 160, 180, height, 24, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x + 22, 160 + height - 42, title)
        text_block(c, subtitle, x + 22, 160 + height - 76, 136, 12, MUTED, leading=18)
        for row in range(max(1, int(height / 85))):
            c.setFillColor(SAND)
            c.roundRect(x + 22, 190 + row * 50, 136, 32, 10, fill=1, stroke=0)
    c.setFillColor(INK)
    c.roundRect(64, 62, w - 128, 58, 29, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont("Helvetica-Bold", 17)
    c.drawCentredString(w / 2, 84, "Your menu in. Your first order out.")
    c.showPage()
    c.save()


def slide_base(c: Canvas, page: int, dark: bool = False) -> None:
    c.setFillColor(INK if dark else CREAM)
    c.rect(0, 0, *SLIDE, fill=1, stroke=0)
    footer(c, page, dark)


def slide_title(c: Canvas, eyebrow: str, title: str, page: int, dark: bool = False) -> float:
    slide_base(c, page, dark)
    label(c, eyebrow, 54, 476, MINT if dark else BRAND)
    color = CREAM if dark else INK
    return text_block(c, title, 54, 436, 850, 34, color, "Helvetica-Bold", 39)


def product_pdf(path: Path) -> None:
    c = Canvas(str(path), pagesize=SLIDE)

    # 01 - cover
    slide_base(c, 1, True)
    draw_wordmark(c, 54, 416, 64, CREAM, BRAND)
    label(c, "Restaurant management, made clear", 54, 352, MINT)
    text_block(c, "Every table. Every order.\nOne calm system.", 54, 306, 610, 48, CREAM, "Helvetica-Bold", 53)
    text_block(c, "Odr connects front-of-house, kitchen, billing, and the owner - without the clutter.", 56, 165, 570, 17, SAND, leading=24)
    c.setFillColor(BRAND)
    c.circle(800, 300, 112, fill=1, stroke=0)
    draw_mark(c, 718, 218, 164, CREAM)
    c.showPage()

    # 02 - problem
    slide_title(c, "The daily reality", "Restaurant software should reduce the rush.", 2)
    card(c, 54, 88, 397, 278, WHITE)
    card(c, 473, 88, 433, 278, INK)
    label(c, "What owners fight today", 80, 330)
    pain = ("Repeated order entry", "Lost or unclear KOTs", "Slow table closure", "Menus scattered across channels")
    for index, item in enumerate(pain):
        y = 278 - index * 48
        c.setFillColor(SAND)
        c.circle(92, y + 4, 13, fill=1, stroke=0)
        c.setFillColor(BRAND)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(92, y, "x")
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(120, y - 1, item)
    label(c, "Odr keeps one source of truth", 500, 330, MINT)
    text_block(c, "One order moves through table, kitchen, and bill. Everyone sees the same state.", 500, 286, 350, 25, CREAM, "Helvetica-Bold", 32)
    pill(c, "LESS TRAINING", 500, 128, BRAND, INK)
    pill(c, "FEWER MISTAKES", 632, 128, MINT, INK)
    c.showPage()

    # 03 - connected flow
    slide_title(c, "The service loop", "One order. No duplicate work.", 3)
    draw_flow(c, 278)
    card(c, 76, 76, 808, 82, WHITE)
    text_block(c, "The captain and diner use the same live menu. Staff confirms table-QR orders before the KOT fires. Every item joins one running table bill.", 102, 126, 760, 15, INK, "Helvetica-Bold", 21)
    c.showPage()

    # 04 - captain and cashier
    slide_title(c, "Front of house", "Fast enough for the rush. Clear enough for day one.", 4)
    card(c, 54, 78, 510, 302, WHITE)
    c.setFillColor(INK)
    c.roundRect(82, 104, 178, 246, 26, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.roundRect(94, 122, 154, 208, 18, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(108, 300, "TABLE 08")
    for index, name in enumerate(("Masala dosa", "Paneer tikka", "Lime soda")):
        y = 258 - index * 46
        c.setFillColor(WHITE)
        c.roundRect(106, y, 130, 34, 9, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(116, y + 13, name)
    c.setFillColor(BRAND)
    c.roundRect(106, 138, 130, 36, 12, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(171, 151, "FIRE KOT")
    text_block(c, "Captain", 292, 316, 220, 20, BRAND, "Helvetica-Bold")
    text_block(c, "Open a table, find items fast, add notes, and send the KOT from a phone or tablet.", 292, 278, 230, 14, INK, leading=20)
    text_block(c, "Cashier", 292, 190, 220, 20, GREEN, "Helvetica-Bold")
    text_block(c, "See every active table, settle cleanly, generate the invoice, and print.", 292, 152, 230, 14, INK, leading=20)
    label(c, "Designed for one-handed operation", 600, 340)
    points = ("Large tap targets", "One screen, one job", "Clear order state", "Explicit offline status", "Fast reprint access")
    for index, point in enumerate(points):
        y = 292 - index * 46
        c.setFillColor(BRAND if index < 3 else SAND)
        c.circle(616, y + 5, 8, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 15)
        c.drawString(640, y, point)
    c.showPage()

    # 05 - kitchen
    slide_title(c, "Kitchen", "Readable across the room. Calm under pressure.", 5, True)
    label(c, "KDS view", 54, 366, MINT)
    orders = (("T-08", "04:12", BRAND), ("T-12", "02:46", MINT), ("TAKEAWAY", "01:18", CREAM))
    for index, (table, age, accent) in enumerate(orders):
        x = 54 + index * 226
        c.setFillColor(HexColor("#26201D"))
        c.roundRect(x, 132, 206, 202, 18, fill=1, stroke=0)
        c.setFillColor(accent)
        c.roundRect(x, 310, 206, 24, 12, fill=1, stroke=0)
        c.setFillColor(CREAM)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(x + 18, 274, table)
        c.setFillColor(accent)
        c.setFont("Helvetica-Bold", 11)
        c.drawRightString(x + 188, 278, age)
        items = ("2 x Masala dosa", "1 x Lime soda", "NO ONION")
        for row, item in enumerate(items):
            c.setFillColor(CREAM if row < 2 else accent)
            c.setFont("Helvetica-Bold" if row == 2 else "Helvetica", 12)
            c.drawString(x + 18, 232 - row * 34, item)
    card(c, 756, 132, 150, 202, CREAM)
    label(c, "KOT", 778, 302)
    c.setFillColor(INK)
    c.setFont("Courier-Bold", 14)
    c.drawString(778, 270, "T-08")
    c.setFont("Courier", 10)
    for row, line in enumerate(("2 MASALA DOSA", "1 LIME SODA", "NO ONION", "----", "04:12 PM")):
        c.drawString(778, 238 - row * 25, line)
    text_block(c, "Use the display when available. Print the same clear KOT when it is not.", 54, 88, 650, 16, SAND, "Helvetica-Bold", 22)
    c.showPage()

    # 06 - menu/table/QR
    slide_title(c, "Setup and self-ordering", "Your menu becomes the operating system.", 6)
    columns = (
        ("MENU", "Add categories, items, prices, tax classes, and availability."),
        ("TABLES", "Define every table once and follow its live order state."),
        ("TABLE QR", "Give each table a unique code linked to the same live menu."),
    )
    for index, (title, body) in enumerate(columns):
        x = 54 + index * 286
        card(c, x, 98, 264, 278, WHITE)
        c.setFillColor(BRAND if index != 1 else GREEN)
        c.circle(x + 38, 334, 14, fill=1, stroke=0)
        label(c, title, x + 64, 329, INK)
        text_block(c, body, x + 24, 282, 216, 16, INK, "Helvetica-Bold", 22)
        if index == 2:
            for row in range(5):
                for col in range(5):
                    if (row * 3 + col * 5) % 4 != 0:
                        c.setFillColor(INK)
                        c.rect(x + 76 + col * 19, 126 + row * 19, 14, 14, fill=1, stroke=0)
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 8)
            c.drawCentredString(x + 132, 112, "Illustrative table code")
        else:
            for row in range(3):
                c.setFillColor(SAND)
                c.roundRect(x + 24, 112 + row * 38, 216, 28, 9, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(54, 67, "Recommended guardrail: staff confirms a diner order before its KOT reaches the kitchen.")
    c.showPage()

    # 07 - billing and insight
    slide_title(c, "Billing and visibility", "Close the table cleanly. Know the day clearly.", 7)
    card(c, 54, 76, 352, 314, WHITE)
    label(c, "Invoice", 78, 354)
    c.setFillColor(INK)
    c.setFont("Courier-Bold", 14)
    c.drawString(78, 322, "MC/2026-27/00001")
    rows = (("Masala dosa x2", "240.00"), ("Lime soda x1", "60.00"), ("Subtotal", "300.00"), ("CGST + SGST", "15.00"))
    for index, (name, value) in enumerate(rows):
        y = 276 - index * 42
        c.setFillColor(INK if index > 1 else MUTED)
        c.setFont("Courier-Bold" if index > 1 else "Courier", 11)
        c.drawString(78, y, name)
        c.drawRightString(378, y, value)
    c.setStrokeColor(INK)
    c.setDash(2, 3)
    c.line(78, 128, 378, 128)
    c.setDash()
    c.setFillColor(INK)
    c.setFont("Courier-Bold", 18)
    c.drawString(78, 98, "TOTAL")
    c.drawRightString(378, 98, "315.00")
    card(c, 432, 76, 474, 314, INK)
    label(c, "Owner snapshot", 460, 354, MINT)
    c.setFillColor(CREAM)
    c.setFont("Helvetica-Bold", 42)
    c.drawString(460, 298, "Rs 84,240")
    c.setFillColor(SAND)
    c.setFont("Helvetica", 12)
    c.drawString(462, 274, "today across dine-in and takeaway")
    values = (0.42, 0.62, 0.51, 0.78, 0.72, 0.9, 0.83)
    for index, value in enumerate(values):
        c.setFillColor(BRAND if index == 6 else MINT)
        c.roundRect(468 + index * 52, 126, 28, 120 * value, 8, fill=1, stroke=0)
    c.setFillColor(SAND)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(460, 98, "MON     TUE     WED     THU     FRI     SAT     SUN")
    c.showPage()

    # 08 - scales
    slide_title(c, "Made for independent restaurants", "Start with the essentials. Keep the same clarity as you grow.", 8)
    segments = (
        ("SMALL CAFE", "10 items", "Counter billing", "Printed KOT"),
        ("BUSY DINING", "40 tables", "Captain ordering", "KDS + billing"),
        ("GROWING BRAND", "Multiple outlets", "Shared menu", "Owner visibility"),
    )
    for index, segment in enumerate(segments):
        x = 54 + index * 286
        fill = BRAND if index == 1 else WHITE
        card(c, x, 106, 264, 268, fill)
        title, *items = segment
        c.setFillColor(CREAM if index == 1 else INK)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x + 24, 330, title)
        for row, item in enumerate(items):
            y = 278 - row * 58
            c.setFillColor(INK if index == 1 else SAND)
            c.roundRect(x + 24, y - 8, 216, 40, 12, fill=1, stroke=0)
            c.setFillColor(CREAM if index == 1 else INK)
            c.setFont("Helvetica-Bold", 13)
            c.drawString(x + 42, y + 6, item)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(480, 72, "No enterprise maze. No feature tax. Just the workflow each outlet needs.")
    c.showPage()

    # 09 - now and next
    slide_title(c, "Product reality", "A strong core now. A focused path forward.", 9)
    card(c, 54, 92, 398, 286, WHITE)
    card(c, 474, 92, 432, 286, INK)
    label(c, "Built in the core today", 80, 340, GREEN)
    built = ("Menu categories and items", "Table order lifecycle", "KOT firing and settlement", "GST invoice generation", "Network printing foundation")
    for index, item in enumerate(built):
        y = 294 - index * 43
        c.setFillColor(GREEN)
        c.circle(91, y + 4, 7, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(112, y, item)
    label(c, "Designed next", 500, 340, MINT)
    planned = ("Live table-QR ordering", "Offline order persistence", "Owner daily reports", "Aggregator synchronization", "Arabic RTL and ZATCA readiness")
    for index, item in enumerate(planned):
        y = 294 - index * 43
        c.setFillColor(MINT)
        c.circle(511, y + 4, 7, fill=1, stroke=0)
        c.setFillColor(CREAM)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(532, y, item)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 10)
    c.drawString(54, 65, "Roadmap items are shown as direction, not as currently available customer features.")
    c.showPage()

    # 10 - close
    slide_base(c, 10, True)
    draw_mark(c, 54, 362, 78, BRAND)
    label(c, "The Odr promise", 54, 330, MINT)
    text_block(c, "Restaurant software\nshould feel this simple.", 54, 286, 660, 48, CREAM, "Helvetica-Bold", 53)
    text_block(c, "One menu. One order flow. One clear view of the day.", 56, 150, 660, 18, SAND, "Helvetica-Bold", 25)
    c.setFillColor(BRAND)
    c.roundRect(716, 160, 190, 190, 36, fill=1, stroke=0)
    draw_mark(c, 754, 198, 114, INK)
    if ZOWCODE_LOGO.exists():
        c.drawImage(str(ZOWCODE_LOGO), 54, 62, width=154, height=39, mask="auto", preserveAspectRatio=True)
    c.showPage()
    c.save()


def build_all(output_dir: Path) -> list[Path]:
    root = Path(output_dir)
    ensure_dirs(root)
    built = write_svg_assets(root)
    app_icon = root / "logo" / "odr-app-icon.pdf"
    draw_app_icon(app_icon)
    built.append(app_icon)
    for name, reversed_ in (("odr-logo-primary.pdf", False), ("odr-logo-reversed.pdf", True)):
        path = root / "logo" / name
        draw_logo_preview(path, reversed_)
        built.append(path)
    poster_builders = (
        ("01-one-clear-flow.pdf", poster_one),
        ("02-whole-restaurant.pdf", poster_two),
        ("03-start-small-run-big.pdf", poster_three),
    )
    for name, builder in poster_builders:
        path = root / "posters" / name
        builder(path)
        built.append(path)
    overview = root / "odr-product-overview.pdf"
    product_pdf(overview)
    built.append(overview)
    return built


if __name__ == "__main__":
    paths = build_all(BASE)
    print("\n".join(str(path.relative_to(BASE)) for path in paths))
