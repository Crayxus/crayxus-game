#!/usr/bin/env python3
"""
Generate board outline DXF for Guandan Keyboard PCB — V2 Integrated
====================================================================
Changes from V1:
  - Removed external dev board pin header (J1 2x20)
  - Added RP2040 MCU area (left side, below keys)
  - Added USB Type-C connector cutout (left edge)
  - Added crystal, LDO, ESD, decoupling caps area markings
  - Board width extended slightly for MCU area

Output: board_outline_v2.dxf (import into LCEDA as Edge.Cuts)
"""
import os

# ── Board dimensions ──
KEY_PITCH = 19.05  # mm, Cherry MX standard
COLS = 14
ROWS = 8
MARGIN_L = 5.0
MARGIN_R = 5.0
MARGIN_T = 20.0   # V2: extra top margin for MCU area (was 5.0)
MARGIN_B = 5.0
CORNER_R = 3.0

BOARD_W = round(COLS * KEY_PITCH + MARGIN_L + MARGIN_R, 1)  # 276.7
BOARD_H = round(ROWS * KEY_PITCH + MARGIN_T + MARGIN_B, 1)  # 177.4 (was 162.4)

# ── USB Type-C connector position (top edge, centered) ──
TYPEC_W = 9.0    # connector width
TYPEC_H = 7.5    # connector depth (protrudes from top edge)

# ── RP2040 MCU area (top, between top edge and first key row) ──
MCU_AREA_X = BOARD_W / 2 - 40.0  # centered horizontally
MCU_AREA_Y = 2.0                  # near top edge
MCU_AREA_W = 80.0
MCU_AREA_H = 13.0

# USB Type-C: centered on top edge
TYPEC_X = BOARD_W / 2 - TYPEC_W / 2

# ── Component positions within MCU area ──
# RP2040: QFN-56, 7×7mm
RP2040_X = MCU_AREA_X + 10.0
RP2040_Y = MCU_AREA_Y + MCU_AREA_H / 2
RP2040_SIZE = 7.0

# Crystal: 12MHz, 3.2×2.5mm
XTAL_X = RP2040_X + 15.0
XTAL_Y = RP2040_Y
XTAL_W = 3.2
XTAL_H = 2.5

# LDO (3.3V): SOT-23-5
LDO_X = MCU_AREA_X + 40.0
LDO_Y = RP2040_Y

# USB ESD: SOT-23-6
ESD_X = MCU_AREA_X + 55.0
ESD_Y = RP2040_Y

# Flash: W25Q16, SOIC-8
FLASH_X = MCU_AREA_X + 65.0
FLASH_Y = RP2040_Y

# ── Mounting holes (M3, ø3.2mm) ──
MH_R = 1.6
MH_INSET = 4.0
MOUNT_HOLES = [
    (MH_INSET, MH_INSET),                          # top-left
    (BOARD_W / 2, MH_INSET),                        # top-center
    (BOARD_W - MH_INSET, MH_INSET),                 # top-right
    (MH_INSET, BOARD_H - MH_INSET),                 # bottom-left
    (BOARD_W / 2, BOARD_H - MH_INSET),              # bottom-center
    (BOARD_W - MH_INSET, BOARD_H - MH_INSET),       # bottom-right
    # Extra mounting near MCU area
    (MCU_AREA_X + MCU_AREA_W + 5, BOARD_H - MH_INSET),  # MCU area right
]

# Keys that skip (second row of 2U)
SKIP = {(1, 0), (3, 0), (5, 0)}


# ── DXF Writer ──
class DXFWriter:
    def __init__(self):
        self.entities = []

    def line(self, x1, y1, x2, y2, layer='Edge_Cuts'):
        self.entities.append(
            f"0\nLINE\n8\n{layer}\n"
            f"10\n{x1:.4f}\n20\n{y1:.4f}\n30\n0.0\n"
            f"11\n{x2:.4f}\n21\n{y2:.4f}\n31\n0.0"
        )

    def arc(self, cx, cy, radius, start_angle, end_angle, layer='Edge_Cuts'):
        self.entities.append(
            f"0\nARC\n8\n{layer}\n"
            f"10\n{cx:.4f}\n20\n{cy:.4f}\n30\n0.0\n"
            f"40\n{radius:.4f}\n"
            f"50\n{start_angle:.4f}\n51\n{end_angle:.4f}"
        )

    def circle(self, cx, cy, radius, layer='Edge_Cuts'):
        self.entities.append(
            f"0\nCIRCLE\n8\n{layer}\n"
            f"10\n{cx:.4f}\n20\n{cy:.4f}\n30\n0.0\n"
            f"40\n{radius:.4f}"
        )

    def rect(self, x, y, w, h, layer='Edge_Cuts'):
        self.line(x, y, x + w, y, layer)
        self.line(x + w, y, x + w, y + h, layer)
        self.line(x + w, y + h, x, y + h, layer)
        self.line(x, y + h, x, y, layer)

    def rounded_rect(self, x, y, w, h, r, layer='Edge_Cuts'):
        self.line(x + r, y, x + w - r, y, layer)
        self.line(x + w, y + r, x + w, y + h - r, layer)
        self.line(x + w - r, y + h, x + r, y + h, layer)
        self.line(x, y + h - r, x, y + r, layer)
        self.arc(x + r, y + r, r, 90, 180, layer)
        self.arc(x + w - r, y + r, r, 0, 90, layer)
        self.arc(x + w - r, y + h - r, r, 270, 360, layer)
        self.arc(x + r, y + h - r, r, 180, 270, layer)

    def text(self, x, y, height, content, layer='Cmts_User'):
        self.entities.append(
            f"0\nTEXT\n8\n{layer}\n"
            f"10\n{x:.4f}\n20\n{y:.4f}\n30\n0.0\n"
            f"40\n{height:.4f}\n"
            f"1\n{content}\n"
            f"72\n1\n"
            f"11\n{x:.4f}\n21\n{y:.4f}\n31\n0.0"
        )

    def save(self, filepath):
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("0\nSECTION\n2\nHEADER\n")
            f.write("9\n$ACADVER\n1\nAC1015\n")
            f.write("9\n$INSUNITS\n70\n4\n")
            f.write("0\nENDSEC\n")
            f.write("0\nSECTION\n2\nTABLES\n")
            f.write("0\nTABLE\n2\nLAYER\n70\n5\n")
            for name, color in [('Edge_Cuts', 7), ('Mounting', 3), ('Cmts_User', 5),
                                ('MCU_Area', 1), ('USB_Area', 4)]:
                f.write(f"0\nLAYER\n2\n{name}\n70\n0\n62\n{color}\n6\nCONTINUOUS\n")
            f.write("0\nENDTAB\n")
            f.write("0\nENDSEC\n")
            f.write("0\nSECTION\n2\nENTITIES\n")
            for e in self.entities:
                f.write(e + "\n")
            f.write("0\nENDSEC\n")
            f.write("0\nEOF\n")


def key_positions():
    RANKS = ['2', 'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3']
    SUITS = ['D', 'D', 'S', 'S', 'H', 'H', 'C', 'C']
    FUNC = {0: 'MODE', 2: 'PASS', 4: 'PLAY', 6: 'BgJK', 7: 'SmJK'}

    positions = []
    for r in range(ROWS):
        for c in range(COLS):
            if (r, c) in SKIP:
                continue
            x = MARGIN_L + c * KEY_PITCH + KEY_PITCH / 2
            y = MARGIN_T + r * KEY_PITCH + KEY_PITCH / 2
            if c == 0:
                label = FUNC.get(r, '')
                if r in (0, 2, 4):
                    y += KEY_PITCH / 2
            else:
                label = f"{SUITS[r]}{RANKS[c - 1]}"
            positions.append((x, y, label))
    return positions


def main():
    dxf = DXFWriter()

    # ── Board outline with USB tab protruding from top center ──
    # Tab dimensions (protruding upward from top edge)
    TAB_W = 30.0   # tab width
    TAB_H = 12.0   # how far it protrudes above main board
    TAB_R = 2.0    # tab corner radius
    tab_x1 = BOARD_W / 2 - TAB_W / 2
    tab_x2 = BOARD_W / 2 + TAB_W / 2

    # Main board outline with tab cutout at top
    # Bottom edge
    dxf.line(CORNER_R, BOARD_H, BOARD_W - CORNER_R, BOARD_H)
    # Right edge
    dxf.line(BOARD_W, BOARD_H - CORNER_R, BOARD_W, CORNER_R)
    # Top edge (split by tab)
    dxf.line(CORNER_R, 0, tab_x1, 0)           # top-left to tab-left
    dxf.line(tab_x1, 0, tab_x1, -TAB_H + TAB_R)       # tab left wall down
    dxf.arc(tab_x1 + TAB_R, -TAB_H + TAB_R, TAB_R, 90, 180)  # tab top-left corner
    dxf.line(tab_x1 + TAB_R, -TAB_H, tab_x2 - TAB_R, -TAB_H) # tab top edge
    dxf.arc(tab_x2 - TAB_R, -TAB_H + TAB_R, TAB_R, 0, 90)    # tab top-right corner
    dxf.line(tab_x2, -TAB_H + TAB_R, tab_x2, 0)       # tab right wall down
    dxf.line(tab_x2, 0, BOARD_W - CORNER_R, 0)  # tab-right to top-right
    # Left edge
    dxf.line(0, CORNER_R, 0, BOARD_H - CORNER_R)
    # Four main corners
    dxf.arc(CORNER_R, CORNER_R, CORNER_R, 90, 180)
    dxf.arc(BOARD_W - CORNER_R, CORNER_R, CORNER_R, 0, 90)
    dxf.arc(BOARD_W - CORNER_R, BOARD_H - CORNER_R, CORNER_R, 270, 360)
    dxf.arc(CORNER_R, BOARD_H - CORNER_R, CORNER_R, 180, 270)

    # USB-C label on tab
    dxf.text(BOARD_W / 2, -TAB_H - 3, 1.5, 'USB-C TAB', 'USB_Area')

    # ── Mounting holes ──
    for mx, my in MOUNT_HOLES:
        dxf.circle(mx, my, MH_R, 'Mounting')

    # ── Key position marks ──
    for x, y, label in key_positions():
        cr = 2.0
        dxf.line(x - cr, y, x + cr, y, 'Cmts_User')
        dxf.line(x, y - cr, x, y + cr, 'Cmts_User')
        dxf.circle(x, y, 2.0, 'Cmts_User')
        if label:
            dxf.text(x, y - 5, 1.5, label, 'Cmts_User')

    # ── MCU Area (bottom-left) ──
    dxf.rect(MCU_AREA_X, MCU_AREA_Y, MCU_AREA_W, MCU_AREA_H, 'MCU_Area')
    dxf.text(MCU_AREA_X + MCU_AREA_W / 2, MCU_AREA_Y - 2, 1.5,
             'MCU AREA (RP2040 + Crystal + LDO + ESD + Flash)', 'MCU_Area')

    # RP2040 QFN-56 footprint outline
    rp_half = RP2040_SIZE / 2
    dxf.rect(RP2040_X - rp_half, RP2040_Y - rp_half,
             RP2040_SIZE, RP2040_SIZE, 'MCU_Area')
    dxf.text(RP2040_X, RP2040_Y, 1.0, 'RP2040', 'MCU_Area')
    dxf.text(RP2040_X, RP2040_Y - rp_half - 1.5, 0.8, 'QFN56 7x7', 'MCU_Area')

    # Crystal 12MHz
    dxf.rect(XTAL_X - XTAL_W / 2, XTAL_Y - XTAL_H / 2,
             XTAL_W, XTAL_H, 'MCU_Area')
    dxf.text(XTAL_X, XTAL_Y - XTAL_H / 2 - 1.5, 0.8, '12MHz', 'MCU_Area')

    # LDO 3.3V
    dxf.rect(LDO_X - 1.5, LDO_Y - 1.5, 3.0, 3.0, 'MCU_Area')
    dxf.text(LDO_X, LDO_Y - 3.0, 0.8, 'LDO 3.3V', 'MCU_Area')

    # ESD protection
    dxf.rect(ESD_X - 1.5, ESD_Y - 1.5, 3.0, 3.0, 'MCU_Area')
    dxf.text(ESD_X, ESD_Y - 3.0, 0.8, 'ESD', 'MCU_Area')

    # Flash (optional)
    dxf.rect(FLASH_X - 2.5, FLASH_Y - 2.0, 5.0, 4.0, 'MCU_Area')
    dxf.text(FLASH_X, FLASH_Y - 3.5, 0.8, 'W25Q16', 'MCU_Area')

    # USB Type-C footprint inside the tab
    tc_pcb_x = BOARD_W / 2 - 6.0
    tc_pcb_y = -TAB_H + 1.0
    dxf.rect(tc_pcb_x, tc_pcb_y, 12.0, TYPEC_W, 'USB_Area')
    dxf.text(BOARD_W / 2, tc_pcb_y - 1.5, 1.0, 'USB-C 16P', 'USB_Area')

    # ── Trace routing hints ──
    # USB D+/D- from Type-C (in tab) down to RP2040 (in MCU area)
    dxf.line(BOARD_W / 2, tc_pcb_y + TYPEC_W, RP2040_X, RP2040_Y - rp_half, 'MCU_Area')
    dxf.text(BOARD_W / 2 + 5, MCU_AREA_Y - 2, 0.8, 'USB D+/D- (90ohm diff)', 'MCU_Area')

    # ── Key matrix connection hint ──
    # Matrix rows/cols from RP2040 GPIO to key matrix
    dxf.text(MCU_AREA_X + MCU_AREA_W + 5, MCU_AREA_Y + MCU_AREA_H / 2,
             1.0, 'GPIO -> 8 ROW + 14 COL = 22 pins', 'MCU_Area')

    # ── Board info ──
    dxf.text(BOARD_W / 2, BOARD_H + 5, 2.5,
             f'GUANDAN KEYBOARD V2 (INTEGRATED)  {BOARD_W}x{BOARD_H}mm', 'Cmts_User')
    dxf.text(BOARD_W / 2, BOARD_H + 10, 1.8,
             f'109 Keys + RGB LED | RP2040 MCU | USB-C | No external dev board', 'Cmts_User')
    dxf.text(BOARD_W / 2, BOARD_H + 15, 1.5,
             f'Matrix: 8 rows x 14 cols | Key pitch: {KEY_PITCH}mm', 'Cmts_User')

    # Save
    outpath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'board_outline_v2.dxf')
    dxf.save(outpath)

    print(f"=" * 60)
    print(f"  GUANDAN KEYBOARD V2 — Integrated RP2040 + USB-C")
    print(f"=" * 60)
    print(f"  Board:          {BOARD_W} x {BOARD_H} mm")
    print(f"  Keys:           109 (8x14 matrix, 3x 2U)")
    print(f"  MCU:            RP2040 QFN-56 (bottom-left)")
    print(f"  USB:            Type-C 16pin (left edge)")
    print(f"  Crystal:        12MHz 3.2x2.5mm")
    print(f"  LDO:            3.3V SOT-23-5")
    print(f"  ESD:            USB ESD protection")
    print(f"  Flash:          W25Q16 SOIC-8 (optional)")
    print(f"  Mounting:       {len(MOUNT_HOLES)}x M3 holes")
    print(f"  Removed:        External dev board pin header")
    print(f"  Saved:          {outpath}")
    print(f"=" * 60)
    print()
    print("给PCB画师的说明:")
    print("  1. 去掉原来的2x20排针(J1)")
    print("  2. 左下角MCU区域放RP2040 + 12MHz晶振 + 3.3V LDO")
    print("  3. 左边缘开USB Type-C母口(16pin)")
    print("  4. USB D+/D-走90欧姆差分对到RP2040")
    print("  5. RP2040 GPIO接矩阵(8行+14列=22个IO)")
    print("  6. 剩余GPIO接RGB LED (WS2812 data line)")
    print("  7. 固件用QMK/VIAL, RP2040方案成熟")


if __name__ == '__main__':
    main()
