#!/usr/bin/env python3
"""Génère icons/icon-192.png et icons/icon-512.png sans dépendance externe.

L'icône reprend icon.svg : carré arrondi orange, disque crème, étoile verte.
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

ORANGE = (194, 65, 12)
CREAM = (255, 247, 237)
GREEN = (22, 163, 74)


def star_points(cx, cy, outer, inner, branches=5, rot=-math.pi / 2):
    pts = []
    for i in range(branches * 2):
        r = outer if i % 2 == 0 else inner
        a = rot + i * math.pi / branches
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def in_polygon(x, y, pts):
    inside = False
    j = len(pts) - 1
    for i, (xi, yi) in enumerate(pts):
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def rounded(x, y, size, radius):
    """Vrai si le point est dans le carré aux coins arrondis (astuce du clamp)."""
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= radius * radius


def render(size):
    s = float(size)
    radius = 0.22 * s
    circle_c = (0.5 * s, 0.46 * s)
    circle_r = 0.29 * s
    star = star_points(0.5 * s, 0.46 * s, 0.22 * s, 0.095 * s)

    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            if not rounded(px, py, s, radius):
                row += bytes((0, 0, 0, 0))
                continue
            color = ORANGE
            if (px - circle_c[0]) ** 2 + (py - circle_c[1]) ** 2 <= circle_r * circle_r:
                color = CREAM
            if in_polygon(px, py, star):
                color = GREEN
            row += bytes(color + (255,))
        rows.append(row)
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for size in (192, 512):
        write_png(os.path.join(OUT, f"icon-{size}.png"), size, render(size))
        print(f"icons/icon-{size}.png")
