"""Builds the InkReel mark for the site: a film reel whose right half dissolves into a black-and-white dither.

The geometry (disc, six holes, hub, Bayer dither with a long left-to-right transition) follows the app icon,
so the site mark is a vector rendition of the same sign rather than a separate drawing.

    python tools/make_mark.py

writes assets/mark.svg (a <symbol id="m"> used from the page header through <use>, drawn with currentColor)
and assets/favicon.svg (the same reel on a rounded tile with a ring, like the app icon).
The output is deterministic and has no dependencies beyond numpy.
"""
import math
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets")

BAYER = np.array([[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38],
                  [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
                  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]], np.float32) / 64.0


def cells(grid, radius, steep):
    """Returns the list of 'on' cells (row, first column, run length) of the dithered disc on a grid x grid raster."""
    n = grid
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    px = (xs + 0.5) / n * 100.0
    py = (ys + 0.5) / n * 100.0
    cx = cy = 50.0
    if steep:
        g = np.clip((px - (cx + radius * 0.25)) / (radius * 0.8), 0, 1)
    else:
        g = np.clip((px - (cx - radius * 0.55)) / (radius * 1.55), 0, 1)
    g = np.clip(g + (py - cy) / (radius * 8), 0, 1)
    th = BAYER[ys.astype(int) % 8, xs.astype(int) % 8]
    near = (px - cx) ** 2 + (py - cy) ** 2 <= (radius + 100.0 / n) ** 2
    on = near & ((g < th) | (g < 0.04))
    runs = []
    for r in range(n):
        c = 0
        while c < n:
            if on[r, c]:
                start = c
                while c < n and on[r, c]:
                    c += 1
                runs.append((r, start, c - start))
            else:
                c += 1
    return runs


def reel_body(grid, radius, steep, ids):
    """Returns SVG elements of the reel in a 100 x 100 box; the clip and the mask ids get the given prefix."""
    cell = 100.0 / grid
    d = []
    for r, c, w in cells(grid, radius, steep):
        d.append("M%s %sh%sv%sh-%sz" % (fmt(c * cell), fmt(r * cell), fmt(w * cell), fmt(cell), fmt(w * cell)))
    holes = []
    for k in range(6):
        a = math.radians(30 + 60 * k)
        holes.append((50 + math.cos(a) * radius * 0.58, 50 + math.sin(a) * radius * 0.58, radius * 0.2))
    hub = radius * 0.14
    parts = [
        '<clipPath id="%sc"><circle cx="50" cy="50" r="%s"/></clipPath>' % (ids, fmt(radius)),
        '<mask id="%sh" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/>%s<circle cx="50" cy="50" r="%s" fill="#000"/></mask>'
        % (ids, "".join('<circle cx="%s" cy="%s" r="%s" fill="#000"/>' % (fmt(x), fmt(y), fmt(r)) for x, y, r in holes), fmt(hub)),
        '<g mask="url(#%sh)"><path clip-path="url(#%sc)" d="%s"/></g>' % (ids, ids, "".join(d)),
        '<circle cx="50" cy="50" r="%s"/>' % fmt(hub * 0.45),
    ]
    return "".join(parts)


def fmt(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return s or "0"


def main():
    # the mark for the header: bare reel, coarse dither (like the app's small sizes)
    mark = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><symbol id="m" viewBox="0 0 100 100" fill="currentColor">%s</symbol></svg>\n' % reel_body(28, 46, True, "k")
    with open(os.path.join(OUT, "mark.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(mark)

    # the favicon: the same reel on a dark rounded tile with a light ring, as the app icon
    tile = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#0b0b0b"/>'
        '<rect x="3.5" y="3.5" width="93" height="93" rx="16.5" fill="none" stroke="#ece9e1" stroke-width="3"/>'
        '<g fill="#ece9e1" transform="translate(10 10) scale(.8)">%s</g></svg>\n' % reel_body(28, 46, True, "f")
    )
    with open(os.path.join(OUT, "favicon.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(tile)
    print("mark.svg %d bytes, favicon.svg %d bytes" % (len(mark), len(tile)))


if __name__ == "__main__":
    main()
