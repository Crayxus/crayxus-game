#!/usr/bin/env python3
"""
Generate Switch Plate DXF for Guandan Keyboard
===============================================
定位板：1.5mm FR4/铝板，只有轴孔和安装孔，无电路。
从 PCB 布局提取完全一致的轴位坐标。

轴孔: 14mm × 14mm (MX standard cutout)
2U轴孔: 14mm × 33.05mm (2U vertical cutout)
稳定器孔: 额外开口 (Cherry PCB-mount stabilizer)

Output: switch_plate.dxf
可直接导入 KiCad / LCEDA 或发给工厂激光切割。
也可当 PCB 下单（嘉立创 FR4 板，只有 Edge.Cuts 层）。

Run:  python gen_plate.py
"""
import os
import math

# ── Layout constants (与 PCB 完全一致) ──
KEY_PITCH = 19.05  # mm, Cherry MX standard
COLS = 14
ROWS = 8
MARGIN_L = 5.0
MARGIN_R = 5.0
MARGIN_T = 5.0
MARGIN_B = 5.0
CORNER_R = 3.0

BOARD_W = round(COLS * KEY_PITCH + MARGIN_L + MARGIN_R, 1)  # 276.7
BOARD_H = round(ROWS * KEY_PITCH + MARGIN_T + MARGIN_B, 1)  # 162.4

# MX switch cutout size
MX_CUT = 14.0  # 14mm × 14mm standard

# 2U vertical key: cutout spans 2 rows
# height = 14 + 19.05 = 33.05mm (two rows merged)
U2_CUT_H = MX_CUT + KEY_PITCH  # 33.05mm

# Cherry PCB-mount stabilizer for 2U keys
# Stabilizer slot: 6.65mm wide × 12.3mm tall, offset ±7mm from center
STAB_W = 6.65
STAB_H = 12.3
STAB_OFFSET_Y = 7.0  # ±7mm from key center along the 2U axis

# Mounting holes (M3, same positions as PCB)
MH_R = 1.6
MH_INSET = 4.0
MOUNT_HOLES = [
    (MH_INSET, MH_INSET),
    (BOARD_W / 2, MH_INSET),
    (BOARD_W - MH_INSET, MH_INSET),
    (MH_INSET, BOARD_H - MH_INSET),
    (BOARD_W / 2, BOARD_H - MH_INSET),
    (BOARD_W - MH_INSET, BOARD_H - MH_INSET),
]

# Keys that are "second row" of a 2U key (no switch here)
SKIP_SWITCH = {(1, 0), (3, 0), (5, 0)}

# 2U keys (these span 2 rows vertically)
U2_KEYS = {(0, 0), (2, 0), (4, 0)}  # MODE, PASS, PLAY


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
        """Rectangular cutout."""
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
            f.write("0\nTABLE\n2\nLAYER\n70\n3\n")
            for name, color in [('Edge_Cuts', 7), ('Mounting', 3), ('Cmts_User', 5)]:
                f.write(f"0\nLAYER\n2\n{name}\n70\n0\n62\n{color}\n6\nCONTINUOUS\n")
            f.write("0\nENDTAB\n")
            f.write("0\nENDSEC\n")
            f.write("0\nSECTION\n2\nENTITIES\n")
            for e in self.entities:
                f.write(e + "\n")
            f.write("0\nENDSEC\n")
            f.write("0\nEOF\n")


def main():
    dxf = DXFWriter()

    # ── Board outline (same as PCB) ──
    dxf.rounded_rect(0, 0, BOARD_W, BOARD_H, CORNER_R)

    # ── Mounting holes (M3, same as PCB for alignment) ──
    for mx, my in MOUNT_HOLES:
        dxf.circle(mx, my, MH_R, 'Edge_Cuts')

    # ── Switch cutouts ──
    n_1u = 0
    n_2u = 0

    for r in range(ROWS):
        for c in range(COLS):
            if (r, c) in SKIP_SWITCH:
                continue

            # Key center position (same as PCB)
            cx = MARGIN_L + c * KEY_PITCH + KEY_PITCH / 2
            cy = MARGIN_T + r * KEY_PITCH + KEY_PITCH / 2

            if (r, c) in U2_KEYS:
                # 2U vertical key: center between two rows
                cy_2u = cy + KEY_PITCH / 2  # center of 2U span

                # Main cutout: 14mm wide × 33.05mm tall
                cut_x = cx - MX_CUT / 2
                cut_y = cy_2u - U2_CUT_H / 2
                dxf.rect(cut_x, cut_y, MX_CUT, U2_CUT_H, 'Edge_Cuts')

                # Cherry stabilizer slots (top and bottom of 2U key)
                for sign in [-1, 1]:
                    sx = cx - STAB_W / 2
                    sy = cy_2u + sign * STAB_OFFSET_Y - STAB_H / 2
                    dxf.rect(sx, sy, STAB_W, STAB_H, 'Edge_Cuts')

                n_2u += 1
            else:
                # Standard 1U key: 14mm × 14mm cutout
                cut_x = cx - MX_CUT / 2
                cut_y = cy - MX_CUT / 2
                dxf.rect(cut_x, cut_y, MX_CUT, MX_CUT, 'Edge_Cuts')

                n_1u += 1

    # ── Column labels (reference, on comment layer) ──
    RANKS = ['2', 'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3']
    for c in range(1, COLS):
        lx = MARGIN_L + c * KEY_PITCH + KEY_PITCH / 2
        dxf.text(lx, MARGIN_T - 2, 1.5, RANKS[c - 1], 'Cmts_User')

    # Function labels
    FUNC = {0: 'MODE', 2: 'PASS', 4: 'PLAY', 6: 'BgJK', 7: 'SmJK'}
    for r, label in FUNC.items():
        ly = MARGIN_T + r * KEY_PITCH + KEY_PITCH / 2
        if r in (0, 2, 4):
            ly += KEY_PITCH / 2
        dxf.text(MARGIN_L + KEY_PITCH / 2, ly + (U2_CUT_H / 2 + 3 if r in (0, 2, 4) else MX_CUT / 2 + 3), 1.2, label, 'Cmts_User')

    # ── Board info ──
    dxf.text(BOARD_W / 2, BOARD_H + 5, 2.5,
             f'GUANDAN SWITCH PLATE  {BOARD_W}x{BOARD_H}mm  1.5mm FR4/AL',
             'Cmts_User')
    dxf.text(BOARD_W / 2, BOARD_H + 10, 1.8,
             f'{n_1u} x 1U cutouts (14x14mm) + {n_2u} x 2U cutouts (14x{U2_CUT_H:.2f}mm)',
             'Cmts_User')

    # Save
    outpath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'switch_plate.dxf')
    dxf.save(outpath)

    print(f"Switch Plate: {BOARD_W} x {BOARD_H} mm")
    print(f"Cutouts: {n_1u} x 1U (14x14mm) + {n_2u} x 2U (14x{U2_CUT_H:.2f}mm)")
    print(f"Stabilizer slots: {n_2u * 2} x Cherry PCB-mount")
    print(f"Mounting holes: {len(MOUNT_HOLES)} x M3")
    print(f"Saved: {outpath}")
    print()
    print("下单方式:")
    print("  方案A: 当PCB下单 (嘉立创/捷配)")
    print("    - 导入DXF为Edge.Cuts层")
    print("    - 板厚选1.5mm, 无铜层, 黑色阻焊")
    print("    - 5片约30-50元")
    print()
    print("  方案B: 激光切割")
    print("    - 1.5mm铝板/钢板/亚克力")
    print("    - 直接用此DXF文件")


if __name__ == '__main__':
    main()
