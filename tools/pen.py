"""Одне «перо»: штрихи зі змінною товщиною (натиск, кут, крапля на початку, тонкий кінчик, живий край).
Усе, що малює сайт пером, іде звідси, щоб був єдиний почерк. Результат: assets/pen/*.svg (маски)."""
import math
import os
import random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'pen') + os.sep


# ---------- допоміжне ----------
def catmull(points, step=2.0):
    """Рівномірний сплайн Катмулла-Рома через опорні точки; повертає густі вибірки (x, y)."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        seg = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
        n = max(4, int(seg / step))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


def interp(knots, s):
    """Гладке (косинусне) інтерполювання між вузлами (s, value)."""
    if s <= knots[0][0]:
        return knots[0][1]
    for (s0, v0), (s1, v1) in zip(knots, knots[1:]):
        if s <= s1:
            u = (s - s0) / (s1 - s0) if s1 > s0 else 0
            u = (1 - math.cos(math.pi * u)) / 2
            return v0 + (v1 - v0) * u
    return knots[-1][1]


def smooth(vals, k=1):
    for _ in range(k):
        vals = [vals[0]] + [(vals[i - 1] + 2 * vals[i] + vals[i + 1]) / 4 for i in range(1, len(vals) - 1)] + [vals[-1]]
    return vals


def area(poly):
    a = 0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        a += x1 * y2 - x2 * y1
    return a / 2


def circle(cx, cy, r, rnd, n=22, wob=0.08):
    ph = rnd.random() * 6.28
    return [(cx + math.cos(ph + 6.2832 * i / n) * r * (1 + wob * math.sin(3 * (ph + 6.2832 * i / n) + ph)),
             cy + math.sin(ph + 6.2832 * i / n) * r * (1 + wob * math.cos(2 * (ph + 6.2832 * i / n) - ph))) for i in range(n)]


# ---------- саме перо ----------
def stroke(points, press, wmin=0.35, wmax=5.0, seed=1, down=0.0, rough=0.07, step=2.2, blobs=(), cap=0.0):
    """points  — опорні точки осьової лінії;
    press   — [(s, натиск 0..1)], s по довжині 0..1;
    down    — 0..1, наскільки товщина залежить від руху вниз (пірʼяний натиск на спуску);
    blobs   — [(s, радіус у частках wmax)]: краплі туші, де перо затрималося;
    cap     — радіус круглого початку (частка wmax), 0 = загострений."""
    rnd = random.Random(seed)
    c = catmull(points, step)
    # довжина
    ls = [0.0]
    for i in range(1, len(c)):
        ls.append(ls[-1] + math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]))
    total = ls[-1] or 1.0
    n = len(c)
    ph = [rnd.random() * 6.28 for _ in range(4)]
    left, right = [], []
    for i in range(n):
        s = ls[i] / total
        a = c[max(0, i - 1)]
        b = c[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1.0
        tx, ty = dx / d, dy / d
        nx, ny = -ty, tx
        downness = max(0.0, ty) ** 0.8
        p = interp(press, s)
        k = (1 - down) + down * downness
        w = wmin + (wmax - wmin) * max(0.0, min(1.0, p * k))
        wob = 1 + 0.10 * math.sin(6.28 * 3.1 * s + ph[0]) + 0.05 * math.sin(6.28 * 9.7 * s + ph[1])
        w *= wob
        jl = 1 + rough * (rnd.random() * 2 - 1) + 0.05 * math.sin(6.28 * 17 * s + ph[2])
        jr = 1 + rough * (rnd.random() * 2 - 1) + 0.05 * math.sin(6.28 * 15 * s + ph[3])
        left.append((c[i][0] + nx * w / 2 * jl, c[i][1] + ny * w / 2 * jl))
        right.append((c[i][0] - nx * w / 2 * jr, c[i][1] - ny * w / 2 * jr))
    for side in (left, right):
        xs = smooth([q[0] for q in side], 1)
        ys = smooth([q[1] for q in side], 1)
        for i in range(n):
            side[i] = (xs[i], ys[i])
    poly = left + right[::-1]
    shapes = [poly]
    if cap > 0:
        r = cap * wmax
        shapes.append(circle(c[0][0], c[0][1], r, rnd))
    for s, rr in blobs:
        i = min(n - 1, int(s * (n - 1)))
        shapes.append(circle(c[i][0] + rnd.uniform(-0.6, 0.6), c[i][1] + rnd.uniform(-0.6, 0.6), rr * wmax, rnd))
    return shapes


def dot(x, y, r, seed=1):
    return [circle(x, y, r, random.Random(seed))]


def to_path(shapes):
    parts = []
    for poly in shapes:
        if area(poly) < 0:
            poly = poly[::-1]
        pts = ' L'.join('%.1f %.1f' % p for p in poly)
        parts.append('M' + pts + 'Z')
    return ''.join(parts)


def save(name, w, h, shape_groups):
    os.makedirs(OUT, exist_ok=True)
    shapes = []
    for g in shape_groups:
        shapes.extend(g)
    d = to_path(shapes)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
           '<path fill="#000" d="%s"/></svg>' % (w, h, w, h, d))
    with open(OUT + name + '.svg', 'w', encoding='utf-8') as f:
        f.write(svg)
    return len(svg)


# ---------- набір ----------
def corner(kind, seed, size=30, arm=25, w=3.1):
    """Куток-дужка, намальована пером: два штрихи, що сходяться в куті з легкою краплею."""
    rnd = random.Random(seed)
    fx = kind[1] == 'r'
    fy = kind[0] == 'b'

    def T(x, y):
        x += rnd.uniform(-0.5, 0.5)
        y += rnd.uniform(-0.5, 0.5)
        return ((size - x) if fx else x, (size - y) if fy else y)

    c0 = 3.6
    horiz = stroke([T(arm, c0 + rnd.uniform(-0.3, 0.5)), T(arm * 0.55, c0 + rnd.uniform(-0.4, 0.4)), T(c0, c0)],
                   [(0, 0.0), (0.5, 0.7), (1, 1.0)], wmin=0.25, wmax=w, seed=seed + 1, rough=0.05)
    vert = stroke([T(c0, c0), T(c0 + rnd.uniform(-0.4, 0.4), arm * 0.5), T(c0 + rnd.uniform(-0.3, 0.5), arm)],
                  [(0, 1.0), (0.5, 0.7), (1, 0.0)], wmin=0.25, wmax=w, seed=seed + 2, rough=0.05)
    return [horiz, vert, [circle(T(c0, c0)[0], T(c0, c0)[1], 0.46 * w, rnd)]]


def build():
    sizes = {}

    # Підкреслення під заголовками (три варіанти, щоб не повторювалось механічно)
    sizes['u1'] = save('u1', 240, 30, [
        stroke([(4, 18), (40, 20), (90, 14), (150, 16), (204, 10), (234, 6)],
               [(0, 0.6), (0.10, 1.0), (0.38, 0.7), (0.7, 0.34), (1, 0.0)], wmin=0.35, wmax=6.2, seed=11, blobs=[(0.04, 0.55)], cap=0.52),
        dot(222, 23, 1.7, 2), dot(232, 20, 1.0, 3)])
    sizes['u2'] = save('u2', 260, 28, [
        stroke([(3, 15), (36, 10), (78, 19), (124, 12), (176, 18), (222, 11), (256, 8)],
               [(0, 0.4), (0.14, 1.0), (0.30, 0.5), (0.55, 0.9), (0.78, 0.45), (1, 0.0)], wmin=0.35, wmax=5.6, seed=21, blobs=[(0.02, 0.5)], cap=0.5)])
    sizes['u3'] = save('u3', 210, 32, [
        stroke([(4, 21), (52, 23), (112, 17), (168, 12), (204, 7)],
               [(0, 0.75), (0.18, 1.0), (0.5, 0.6), (0.82, 0.28), (1, 0.0)], wmin=0.35, wmax=6.8, seed=31, blobs=[(0.03, 0.6)], cap=0.58),
        stroke([(22, 28.5), (92, 27.5), (156, 23.5)], [(0, 0.0), (0.4, 0.5), (1, 0.0)], wmin=0.2, wmax=2.2, seed=32)])

    # Довгий розділювач між секціями: тонкий — товстий — тонкий, із двома напливами й краплею
    sizes['swash'] = save('swash', 1100, 48, [
        stroke([(6, 28), (120, 24), (260, 32), (420, 22), (560, 27), (700, 34), (860, 23), (990, 26), (1074, 15)],
               [(0, 0.0), (0.08, 0.5), (0.22, 1.0), (0.34, 0.4), (0.52, 0.2), (0.66, 0.9), (0.78, 0.45), (0.92, 0.22), (1, 0.0)],
               wmin=0.35, wmax=7.2, seed=41, blobs=[(0.22, 0.55), (0.66, 0.5)]),
        dot(1086, 12, 2.0, 5), dot(1095, 18, 1.1, 6), dot(1080, 22, 0.9, 7)])

    # Півдовгий розділювач (під заголовком політики, у паузі, на 404)
    sizes['swash-s'] = save('swash-s', 560, 38, [
        stroke([(5, 22), (90, 19), (190, 26), (300, 17), (410, 22), (500, 16), (550, 9)],
               [(0, 0.0), (0.12, 0.65), (0.3, 1.0), (0.5, 0.4), (0.72, 0.75), (0.9, 0.22), (1, 0.0)],
               wmin=0.35, wmax=6.0, seed=51, blobs=[(0.30, 0.5)]),
        dot(541, 17, 1.6, 8), dot(548, 24, 0.9, 13)])

    # Вертикальна S-крива для «Філософії»: товсті спуски, тонкі підйоми
    sizes['s-tall'] = save('s-tall', 90, 640, [
        stroke([(46, 8), (66, 80), (74, 160), (50, 250), (22, 340), (16, 430), (40, 520), (52, 570), (44, 630)],
               [(0, 0.25), (0.08, 0.75), (0.22, 1.0), (0.4, 0.5), (0.55, 0.92), (0.72, 1.0), (0.9, 0.38), (1, 0.0)],
               wmin=0.5, wmax=9.5, seed=61, down=0.55, blobs=[(0.01, 0.5)], cap=0.48),
        dot(60, 614, 2.0, 9), dot(71, 627, 1.2, 10)])

    # Завиток-підкреслення для героя
    sizes['flourish'] = save('flourish', 460, 70, [
        stroke([(6, 42), (70, 44), (150, 36), (240, 40), (330, 32), (410, 24), (440, 32), (432, 46), (414, 42)],
               [(0, 0.0), (0.06, 0.5), (0.2, 1.0), (0.45, 0.45), (0.7, 0.85), (0.86, 0.55), (1, 0.0)],
               wmin=0.35, wmax=7.4, seed=71, blobs=[(0.2, 0.5), (0.7, 0.4)]),
        dot(448, 14, 2.0, 11), dot(458, 21, 1.1, 12)])

    # Стрілки-позначки (на полях)
    sizes['arrow-r'] = save('arrow-r', 96, 64, [
        stroke([(6, 8), (30, 4), (58, 12), (78, 34), (84, 54)], [(0, 0.15), (0.2, 0.75), (0.55, 1.0), (1, 0.4)], wmin=0.45, wmax=3.9, seed=81, cap=0.38),
        stroke([(84, 54), (74, 43)], [(0, 0.9), (1, 0.1)], wmin=0.35, wmax=3.5, seed=82),
        stroke([(84, 54), (93, 42)], [(0, 0.9), (1, 0.1)], wmin=0.35, wmax=3.5, seed=83)])
    sizes['arrow-l'] = save('arrow-l', 96, 64, [
        stroke([(90, 8), (66, 4), (38, 12), (18, 34), (12, 54)], [(0, 0.15), (0.2, 0.75), (0.55, 1.0), (1, 0.4)], wmin=0.45, wmax=3.9, seed=84, cap=0.38),
        stroke([(12, 54), (22, 43)], [(0, 0.9), (1, 0.1)], wmin=0.35, wmax=3.5, seed=85),
        stroke([(12, 54), (3, 42)], [(0, 0.9), (1, 0.1)], wmin=0.35, wmax=3.5, seed=86)])

    # Штрихування: п'ять похилих рисок різної довжини
    sizes['hatch'] = save('hatch', 64, 64, [
        stroke([(10, 58), (24, 8)], [(0, 0.0), (0.3, 0.9), (1, 0.0)], wmin=0.25, wmax=3.4, seed=91),
        stroke([(20, 60), (36, 5)], [(0, 0.0), (0.3, 1.0), (1, 0.0)], wmin=0.25, wmax=3.8, seed=92),
        stroke([(30, 60), (46, 7)], [(0, 0.0), (0.3, 1.0), (1, 0.0)], wmin=0.25, wmax=3.8, seed=93),
        stroke([(40, 60), (53, 15)], [(0, 0.0), (0.3, 0.9), (1, 0.0)], wmin=0.25, wmax=3.3, seed=94),
        stroke([(50, 60), (60, 27)], [(0, 0.0), (0.3, 0.8), (1, 0.0)], wmin=0.25, wmax=2.9, seed=95)])

    # Галочка й хрестик
    sizes['tick'] = save('tick', 56, 48, [
        stroke([(6, 26), (18, 40), (30, 30), (50, 6)], [(0, 0.2), (0.3, 0.95), (0.6, 0.75), (1, 0.0)], wmin=0.45, wmax=4.8, seed=101, down=0.5, cap=0.34)])
    sizes['cross'] = save('cross', 48, 48, [
        stroke([(8, 8), (24, 26), (40, 42)], [(0, 0.0), (0.45, 1.0), (1, 0.1)], wmin=0.35, wmax=4.4, seed=111),
        stroke([(40, 8), (26, 24), (8, 42)], [(0, 0.0), (0.5, 0.9), (1, 0.1)], wmin=0.35, wmax=3.9, seed=112)])

    # Краплі туші (бризки навколо)
    sizes['drops'] = save('drops', 72, 48, [
        dot(12, 30, 3.8, 121), dot(26, 20, 2.3, 122), dot(38, 30, 1.4, 123), dot(50, 14, 2.7, 124), dot(60, 24, 1.2, 125), dot(30, 38, 1.0, 126)])

    # Кутки-дужки (друкарські мітки, але від руки)
    for k, sd in (('tl', 201), ('tr', 211), ('bl', 221), ('br', 231)):
        sizes['corner-' + k] = save('corner-' + k, 30, 30, corner(k, sd))

    return sizes


if __name__ == '__main__':
    sz = build()
    for k, v in sorted(sz.items()):
        print('%-10s %6d B' % (k, v))
