/* InkReel — сайт. Без залежностей, без мережевих запитів.
   1) палітри (вибір зберігається лише в localStorage браузера);
   2) поява блоків при прокручуванні;
   3) рушій «світло чи тінь»: сцена → тон → чорне й біле (поріг, растр, штрихи, символи);
   4) прикраси: півтонові поля, плівка з кадрами, «пластина» в першому екрані;
   5) жива демонстрація (зокрема власне фото чи відео, яке не залишає браузер);
   6) «душа»: вивертання світла й тіні, слід пера, дрібна тактильність. */
(function () {
    'use strict';

    var root = document.documentElement;
    var KEY = 'inkreel-palette';
    var FLIP_KEY = 'inkreel-flip';
    var SEEN_KEY = 'inkreel-seen';
    var PALETTES = ['paper', 'sepia', 'carmine', 'cyanotype', 'amber', 'terminal'];
    var THEME_COLORS = { paper: '#f1eadb', sepia: '#e9d6af', carmine: '#f7f0e4', cyanotype: '#f3f0e6', amber: '#150d00', terminal: '#06130a' };
    var LEGACY_PALETTES = { night: 'paper', moss: 'terminal', indigo: 'cyanotype' };
    var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function clamp(v, lo, hi) {
        return v < lo ? lo : v > hi ? hi : v;
    }

    function pad(n, len) {
        var s = String(n);
        while (s.length < (len || 2)) {
            s = '0' + s;
        }
        return s;
    }

    /* 1. Палітри й вивертання (світло й тінь міняються місцями в будь-якій палітрі) */
    function updateThemeColor(name) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            return;
        }
        var page = getComputedStyle(root).getPropertyValue('--paper').trim();
        meta.setAttribute('content', /^#[0-9a-f]{6}$/i.test(page) ? page : THEME_COLORS[name || root.getAttribute('data-palette')] || '#f7f5ef');
    }

    function setPalette(name, persist) {
        if (LEGACY_PALETTES[name]) {
            name = LEGACY_PALETTES[name];
        }
        if (PALETTES.indexOf(name) < 0) {
            name = 'paper';
        }
        root.setAttribute('data-palette', name);
        var buttons = document.querySelectorAll('.pal button');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-p') === name));
        }
        updateThemeColor(name);
        if (persist) {
            try {
                localStorage.setItem(KEY, name);
            }
            catch (e) { /* приватний режим: просто не зберігаємо */ }
        }
        window.dispatchEvent(new Event('inkpalette'));
    }

    function initPalette() {
        setPalette(root.getAttribute('data-palette') || 'paper', false);
        var buttons = document.querySelectorAll('.pal button');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function (e) {
                setPalette(e.currentTarget.getAttribute('data-p'), true);
            });
        }
    }

    var flipped = root.hasAttribute('data-flip');
    var flipBusy = false;
    var mouse = { x: -1, y: -1 };

    function applyFlip(on, persist) {
        flipped = !!on;
        if (flipped) {
            root.setAttribute('data-flip', '');
        }
        else {
            root.removeAttribute('data-flip');
        }
        var btns = document.querySelectorAll('[data-flipper]');
        for (var i = 0; i < btns.length; i++) {
            btns[i].setAttribute('aria-pressed', String(flipped));
        }
        updateThemeColor();
        if (persist) {
            try {
                localStorage.setItem(FLIP_KEY, flipped ? '1' : '0');
                localStorage.setItem(SEEN_KEY, '1');
            }
            catch (e) { /* приватний режим */ }
            root.classList.add('seen');
        }
        window.dispatchEvent(new Event('inkpalette'));
    }

    /* Органічна «пляма», що розтікається від точки кліку: полігон із нерівним краєм (однакова кількість вершин на початку й в кінці) */
    var BLOB = (function () {
        var n = 72;
        var k = [];
        for (var i = 0; i < n; i++) {
            var a = (i / n) * Math.PI * 2;
            k.push(1 + 0.07 * Math.sin(3 * a + 1.3) + 0.05 * Math.sin(5 * a + 0.4) + 0.035 * Math.sin(9 * a + 2.1) + 0.03 * (hash(i, 7) - 0.5));
        }
        return k;
    }());

    function blobPath(x, y, r) {
        var pts = [];
        for (var i = 0; i < BLOB.length; i++) {
            var a = (i / BLOB.length) * Math.PI * 2;
            pts.push((x + Math.cos(a) * r * BLOB[i]).toFixed(1) + 'px ' + (y + Math.sin(a) * r * BLOB[i]).toFixed(1) + 'px');
        }
        return 'polygon(' + pts.join(',') + ')';
    }

    function toggleFlip(ox, oy) {
        if (flipBusy) {
            return;
        }
        var next = !flipped;
        if (reduced || typeof document.startViewTransition !== 'function') {
            applyFlip(next, true);
            return;
        }
        var w = window.innerWidth;
        var h = window.innerHeight;
        var x = ox >= 0 ? ox : (mouse.x >= 0 ? mouse.x : w / 2);
        var y = oy >= 0 ? oy : (mouse.y >= 0 ? mouse.y : h / 3);
        var far = Math.sqrt(Math.pow(Math.max(x, w - x), 2) + Math.pow(Math.max(y, h - y), 2)) * 1.14;
        flipBusy = true;
        root.classList.add('vt');
        var vt;
        try {
            vt = document.startViewTransition(function () {
                applyFlip(next, true);
            });
        }
        catch (e) {
            root.classList.remove('vt');
            flipBusy = false;
            applyFlip(next, true);
            return;
        }
        function done() {
            root.classList.remove('vt');
            flipBusy = false;
        }
        vt.ready.then(function () {
            root.animate({ clipPath: [blobPath(x, y, 0), blobPath(x, y, far * 0.55), blobPath(x, y, far)] },
                { duration: 1150, easing: 'cubic-bezier(0.32, 0.02, 0.18, 1)', pseudoElement: '::view-transition-new(root)' });
        }).catch(done);
        vt.finished.then(done, done);
    }

    function initFlip() {
        var targets = document.querySelectorAll('[data-flipper]');
        for (var i = 0; i < targets.length; i++) {
            targets[i].addEventListener('click', function (e) {
                var r = e.currentTarget.getBoundingClientRect();
                var cx = e.clientX || r.left + r.width / 2;
                var cy = e.clientY || r.top + r.height / 2;
                toggleFlip(cx, cy);
            });
        }
        var btns = document.querySelectorAll('[data-flipper]');
        for (var j = 0; j < btns.length; j++) {
            btns[j].setAttribute('aria-pressed', String(flipped));
        }
        document.addEventListener('keydown', function (e) {
            if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) {
                return;
            }
            var t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
                return;
            }
            if (e.code === 'KeyI' || e.key === 'і' || e.key === 'І') {
                toggleFlip(-1, -1);
            }
        });
        updateThemeColor();
    }

    /* 2. Поява блоків */
    function initReveal() {
        var items = document.querySelectorAll('.rv, .dr');
        if (!('IntersectionObserver' in window)) {
            for (var i = 0; i < items.length; i++) {
                items[i].classList.add('in');
            }
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) {
                    en.target.classList.add('in');
                    io.unobserve(en.target);
                }
            });
        }, { threshold: 0.12 });
        for (var j = 0; j < items.length; j++) {
            io.observe(items[j]);
        }
    }

    /* 3. Рушій */
    function hexToRgb(v) {
        v = String(v).trim();
        if (v.charAt(0) !== '#') {
            return [255, 255, 255];
        }
        if (v.length === 4) {
            v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        }
        return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
    }

    function pack(rgb) {
        return ((255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
    }

    function makeBayer(n) {
        var m = [[0, 2], [3, 1]];
        var add = [[0, 2], [3, 1]];
        while (m.length < n) {
            var s = m.length;
            var r = [];
            for (var y = 0; y < s * 2; y++) {
                r.push([]);
                for (var x = 0; x < s * 2; x++) {
                    r[y][x] = m[y % s][x % s] * 4 + add[Math.floor(y / s)][Math.floor(x / s)];
                }
            }
            m = r;
        }
        var flat = new Float32Array(n * n);
        for (var yy = 0; yy < n; yy++) {
            for (var xx = 0; xx < n; xx++) {
                flat[yy * n + xx] = (m[yy][xx] + 0.5) / (n * n);
            }
        }
        return flat;
    }

    var BAYER = makeBayer(8);
    var RAMP = ' .:-=+*#%@';

    function hash(x, y) {
        var h = (x * 374761393 + y * 668265263) | 0;
        h = (h ^ (h >>> 13)) * 1274126177 | 0;
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    function frac(u, period) {
        var m = u % period;
        return (m < 0 ? m + period : m) / period;
    }

    function lumOf(rgb) {
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }

    /* Кольори сторінки. «Світле» — завжди яскравіший із двох кольорів палітри. */
    function readColors() {
        var cs = getComputedStyle(root);
        var ink = hexToRgb(cs.getPropertyValue('--ink'));
        var paper = hexToRgb(cs.getPropertyValue('--paper'));
        return {
            inkU: pack(ink),
            paperU: pack(paper),
            inkCss: 'rgb(' + ink.join(',') + ')',
            paperCss: 'rgb(' + paper.join(',') + ')',
            mono: cs.getPropertyValue('--mono') || 'monospace',
            invert: lumOf(paper) > lumOf(ink)
        };
    }

    var DEMO_CFG = { floor: 0.74, grid: true, sky: [0.13, 0.17], bloom: 0.42,
        balls: [{ x: 0.43, R: 0.27, c: 0.02 }, { x: 0.75, R: 0.115, c: 0.08 }] };
    var PLATE_CFG = { floor: 0.68, grid: false, sky: [0.16, 0.2], bloom: 0.42,
        balls: [{ x: 0.5, R: 0.23, c: 0.03 }, { x: 0.78, R: 0.075, c: 0.085 }] };

    function Scene(W, H, cfg) {
        this.W = W;
        this.H = H;
        this.cfg = cfg;
        this.lum = new Float32Array(W * H);
        this.reg = new Uint8Array(W * H);
        this.off = document.createElement('canvas');
        this.off.width = W;
        this.off.height = H;
        this.octx = this.off.getContext('2d');
        this.img = this.octx.createImageData(W, H);
        this.px = new Uint32Array(this.img.data.buffer);
    }

    /* Сцена: стіна, підлога, дві кулі; світло в точці (lx, ly) у частках кадру. */
    Scene.prototype.render = function (lx, ly) {
        var W = this.W;
        var H = this.H;
        var cfg = this.cfg;
        var lum = this.lum;
        var reg = this.reg;
        var Lx = (lx - 0.5) * 2;
        var Ly = (ly - 0.5) * 2;
        var Lz = 0.62;
        var Ln = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz);
        Lx /= Ln;
        Ly /= Ln;
        Lz /= Ln;
        var floorY = H * cfg.floor;
        var aspect = H / W;
        var balls = [];
        for (var b = 0; b < cfg.balls.length; b++) {
            var c = cfg.balls[b];
            var R = H * c.R;
            var cy = floorY + H * c.c;
            var B = { x: W * c.x, R: R, y: cy - R * 0.92 };
            B.sx = B.x - (Lx / Math.max(Lz, 0.35)) * R * 0.8;
            B.sy = cy + R * 0.04;
            B.rx = R * (1.05 + 0.7 * Math.abs(Lx));
            B.ry = R * 0.3;
            balls.push(B);
        }
        var i = 0;
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++, i++) {
                var v;
                var r = 0;
                if (y < floorY) {
                    v = cfg.sky[0] + cfg.sky[1] * (y / floorY);
                }
                else {
                    var fv = (y - floorY) / (H - floorY);
                    v = 0.3 - 0.14 * fv;
                    if (cfg.grid) {
                        var z = 1 / (0.06 + fv);
                        if ((z * 1.1) % 1 < 0.05) {
                            v *= 0.72;
                        }
                        var u = ((x - W / 2) / W) * z * 6;
                        if (frac(u, 1) < 0.04) {
                            v *= 0.78;
                        }
                    }
                    r = 1;
                }
                var gx = x / W - lx;
                var gy = (y / H - ly) * aspect;
                v += cfg.bloom * Math.exp(-(gx * gx + gy * gy) / 0.035);
                if (y >= floorY) {
                    for (var s = 0; s < balls.length; s++) {
                        var S = balls[s];
                        var ex = (x - S.sx) / S.rx;
                        var ey = (y - S.sy) / S.ry;
                        var d = ex * ex + ey * ey;
                        if (d < 1) {
                            var k = 1 - d;
                            v *= 1 - 0.82 * k * k * (3 - 2 * k);
                        }
                    }
                }
                for (var q = 0; q < balls.length; q++) {
                    var Q = balls[q];
                    var dx = x - Q.x;
                    var dy = y - Q.y;
                    if (dx * dx + dy * dy < Q.R * Q.R) {
                        var nx = dx / Q.R;
                        var ny = dy / Q.R;
                        var nz = Math.sqrt(1 - nx * nx - ny * ny);
                        var dot = nx * Lx + ny * Ly + nz * Lz;
                        if (dot < 0) {
                            dot = 0;
                        }
                        v = 0.04 + 0.92 * Math.pow(dot, 0.85) + 0.05 * Math.max(0, ny);
                        r = 2;
                    }
                }
                lum[i] = v > 1 ? 1 : v;
                reg[i] = r;
            }
        }
    };

    /* Права від плавної S-кривої половина кадру міняє полярність: позитив і негатив одного зображення. */
    Scene.prototype.polarize = function (amp) {
        var W = this.W;
        var H = this.H;
        var lum = this.lum;
        for (var y = 0; y < H; y++) {
            var xs = W * (0.5 + amp * Math.sin(2 * Math.PI * y / H));
            for (var x = Math.max(0, Math.ceil(xs)); x < W; x++) {
                lum[y * W + x] = 1 - lum[y * W + x];
            }
        }
    };

    /* Власне фото чи кадр відео стає «сценою»: яскравість кожного пікселя. Усе відбувається в пам'яті браузера. */
    Scene.prototype.fromSource = function (el, sw, sh) {
        var W = this.W;
        var H = this.H;
        if (!this.sctx) {
            this.src = document.createElement('canvas');
            this.src.width = W;
            this.src.height = H;
            this.sctx = this.src.getContext('2d', { willReadFrequently: true });
        }
        var c = this.sctx;
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.fillStyle = '#000';
        c.fillRect(0, 0, W, H);
        var k = Math.min(W / sw, H / sh);
        var dw = sw * k;
        var dh = sh * k;
        c.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
        var d = c.getImageData(0, 0, W, H).data;
        var lum = this.lum;
        var reg = this.reg;
        for (var i = 0, j = 0; i < W * H; i++, j += 4) {
            lum[i] = (0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) / 255;
            reg[i] = 0;
        }
    };

    /* Автоконтраст: беремо діапазон між 1,5-м і 98,5-м відсотком яскравості, щоб тьмяне фото не стало сірою плямою */
    Scene.prototype.measure = function () {
        var lum = this.lum;
        var bins = new Uint32Array(256);
        var n = lum.length;
        for (var i = 0; i < n; i++) {
            bins[Math.min(255, Math.floor(lum[i] * 255.999))]++;
        }
        var lo = 0;
        var hi = 255;
        var acc = 0;
        for (lo = 0; lo < 255; lo++) {
            acc += bins[lo];
            if (acc > n * 0.015) {
                break;
            }
        }
        acc = 0;
        for (hi = 255; hi > 0; hi--) {
            acc += bins[hi];
            if (acc > n * 0.015) {
                break;
            }
        }
        var a = lo / 255;
        var b = hi / 255;
        if (b - a < 0.2) {
            var mid = (a + b) / 2;
            a = Math.max(0, mid - 0.1);
            b = Math.min(1, mid + 0.1);
        }
        return { lo: a, span: Math.max(0.05, b - a) };
    };

    Scene.prototype.levels = function (lev) {
        var lum = this.lum;
        var n = lum.length;
        for (var i = 0; i < n; i++) {
            var v = (lum[i] - lev.lo) / lev.span;
            v = v < 0 ? 0 : v > 1 ? 1 : v;
            lum[i] = v + 0.3 * (v * v * (3 - 2 * v) - v);
        }
    };

    /* Середня яскравість в околі (коробкове розмиття через інтегральне зображення): потрібна рівню «Контур» */
    Scene.prototype.localMean = function (r) {
        var W = this.W;
        var H = this.H;
        var lum = this.lum;
        var S = this.sat && this.sat.length === (W + 1) * (H + 1) ? this.sat : (this.sat = new Float64Array((W + 1) * (H + 1)));
        var M = this.mean && this.mean.length === W * H ? this.mean : (this.mean = new Float32Array(W * H));
        var W1 = W + 1;
        for (var y = 0; y < H; y++) {
            var row = 0;
            for (var x = 0; x < W; x++) {
                row += lum[y * W + x];
                S[(y + 1) * W1 + x + 1] = S[y * W1 + x + 1] + row;
            }
        }
        for (var yy = 0; yy < H; yy++) {
            var y0 = Math.max(0, yy - r);
            var y1 = Math.min(H, yy + r + 1);
            for (var xx = 0; xx < W; xx++) {
                var x0 = Math.max(0, xx - r);
                var x1 = Math.min(W, xx + r + 1);
                M[yy * W + xx] = (S[y1 * W1 + x1] - S[y0 * W1 + x1] - S[y1 * W1 + x0] + S[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0));
            }
        }
        return M;
    };

    /* Режими: bin = Ескіз (один поріг), edge = Контур (поріг за околом), dot = Півтон (растр), mix = Малюнок (крапки на світлому, штрихи на темному), ink = Гравюра (штрихи за формою), sym = Символи */
    Scene.prototype.paint = function (ctx, cw, ch, mode, bias, colors, cols) {
        if (mode === 'sym') {
            this.symbols(ctx, cw, ch, bias, colors, cols || 96);
            return;
        }
        var W = this.W;
        var H = this.H;
        var lum = this.lum;
        var reg = this.reg;
        var px = this.px;
        var inv = colors.invert;
        var inkU = colors.inkU;
        var paperU = colors.paperU;
        var mean = mode === 'edge' ? this.localMean(Math.max(3, Math.round(W / 60))) : null;
        var i = 0;
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++, i++) {
                var g = (inv ? 1 - lum[i] : lum[i]) + bias;
                g = g < 0 ? 0 : g > 1 ? 1 : g;
                var on = false;
                if (mode === 'bin') {
                    on = g > 0.5;
                }
                else if (mode === 'edge') {
                    var gm = (inv ? 1 - mean[i] : mean[i]) + bias;
                    /* темніше за околом = лінія; суцільне темне лишається темним, решта світла */
                    on = g > 0.16 && g > gm - 0.035;
                }
                else if (mode === 'dot' || (mode === 'mix' && g > 0.62)) {
                    on = g > BAYER[(y & 7) * 8 + (x & 7)];
                }
                else if (g > 0.96) {
                    on = true;
                }
                else {
                    var ball = reg[i] === 2;
                    var u1 = ball ? x * 0.87 + y * 0.5 : x + y;
                    var u2 = ball ? x * 0.87 - y * 0.5 : x - y;
                    var w1 = clamp((g - 0.14) * 1.5, 0, 0.92);
                    if (frac(u1, 5) < w1) {
                        on = true;
                    }
                    else if (g > 0.5) {
                        on = frac(u2, 5) < clamp((g - 0.5) * 1.9, 0, 0.9);
                    }
                    else if (g > 0.03 && g < 0.14) {
                        on = hash(x, y) < g * 0.9;
                    }
                }
                px[i] = on ? inkU : paperU;
            }
        }
        this.octx.putImageData(this.img, 0, 0);
        if (cw === W && ch === H) {
            ctx.drawImage(this.off, 0, 0);
        }
        else {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this.off, 0, 0, cw, ch);
        }
    };

    Scene.prototype.symbols = function (ctx, cw, ch, bias, colors, cols) {
        var W = this.W;
        var H = this.H;
        var lum = this.lum;
        /* на світлій палітрі малюємо світлі знаки на темному тлі: так само, як на темних палітрах */
        var swap = colors.invert;
        var cellW = cw / cols;
        var cellH = cellW * 2;
        var rows = Math.max(1, Math.floor(ch / cellH));
        function tone(i) {
            var d = lum[i] + bias;
            return d < 0 ? 0 : d > 1 ? 1 : d;
        }
        ctx.fillStyle = swap ? colors.inkCss : colors.paperCss;
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = swap ? colors.paperCss : colors.inkCss;
        ctx.font = Math.round(cellH * 0.86) + 'px ' + colors.mono;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var sx = W / cols;
        var sy = H / rows;
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                var cx = Math.min(W - 1, Math.floor((c + 0.5) * sx));
                var cy = Math.min(H - 1, Math.floor((r + 0.5) * sy));
                var g = (tone(cy * W + cx) + tone(cy * W + Math.max(0, cx - 1)) + tone(cy * W + Math.min(W - 1, cx + 1))
                    + tone(Math.max(0, cy - 2) * W + cx) + tone(Math.min(H - 1, cy + 2) * W + cx)) / 5;
                var k = Math.pow(g, 1.5) * 9 + (BAYER[(r & 7) * 8 + (c & 7)] - 0.5) * 0.9;
                var idx = Math.round(k);
                if (idx > 0) {
                    ctx.fillText(RAMP.charAt(idx > 9 ? 9 : idx), (c + 0.5) * cellW, (r + 0.5) * cellH);
                }
            }
        }
    };

    /* Один цикл анімації на всі канви: нічого не малюється, поки вкладка прихована */
    var tickers = [];
    function loop(now) {
        window.requestAnimationFrame(loop);
        if (document.hidden) {
            return;
        }
        for (var i = 0; i < tickers.length; i++) {
            tickers[i](now);
        }
    }

    function onResize(fn) {
        var timer = 0;
        window.addEventListener('resize', function () {
            window.clearTimeout(timer);
            timer = window.setTimeout(fn, 150);
        });
    }

    /* Спільне світло від курсора: у «пластини» й у демонстрації воно своє, але джерело одне */
    var pointer = { x: 0.3, y: 0.28, t: -1e9 };
    window.addEventListener('pointermove', function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        pointer.x = clamp(e.clientX / Math.max(1, window.innerWidth), 0, 1);
        pointer.y = clamp(e.clientY / Math.max(1, window.innerHeight), 0, 1) * 0.9;
        pointer.t = performance.now();
    }, { passive: true });

    /* 4a. Півтонові поля: canvas[data-ht] малюється крапками прямо в кольорі свого оточення */
    function fieldValue(type, u, v, cycles) {
        if (type === 'moon') {
            var nx = (u - 0.5) / 0.46;
            var ny = (v - 0.5) / 0.46;
            var d2 = nx * nx + ny * ny;
            if (d2 >= 1) {
                return 0;
            }
            var dot = nx * -0.5 + ny * -0.42 + Math.sqrt(1 - d2) * 0.76;
            return dot <= 0 ? 0 : Math.pow(dot, 0.9) * 0.97;
        }
        /* «хвиля»: чергування чорного й білого, зсунуте S-подібно по висоті смуги */
        var t = 0.5 + 0.5 * Math.sin(2 * Math.PI * u * cycles + 1.2 * Math.sin(2 * Math.PI * v));
        return clamp((t - 0.5) * 1.2 + 0.5, 0, 1);
    }

    function drawHalftone(canvas) {
        var type = canvas.getAttribute('data-ht') || 'wave';
        var cell = parseInt(canvas.getAttribute('data-cell') || '3', 10);
        var rect = canvas.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 2) {
            return;
        }
        var w = Math.max(4, Math.round(rect.width / cell));
        var h = Math.max(2, Math.round(rect.height / cell));
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        var img = ctx.createImageData(w, h);
        var px = new Uint32Array(img.data.buffer);
        var ink = pack(hexToRgb(getComputedStyle(canvas).getPropertyValue('--ink')));
        var cycles = Math.max(2, rect.width / 360);
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var t = fieldValue(type, x / (w - 1), y / Math.max(1, h - 1), cycles);
                px[y * w + x] = t > BAYER[(y & 7) * 8 + (x & 7)] ? ink : 0;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    function initHalftones() {
        var list = document.querySelectorAll('canvas[data-ht]');
        if (!list.length) {
            return;
        }
        function all() {
            for (var i = 0; i < list.length; i++) {
                drawHalftone(list[i]);
            }
        }
        all();
        window.addEventListener('inkpalette', all);
        onResize(all);
    }

    /* 4b. Плівка: вісім кадрів однієї сцени, світло йде зліва направо, режими чергуються */
    function initReel() {
        var reel = document.querySelector('.reel');
        var track = reel && reel.querySelector('.reel-track');
        if (!track) {
            return;
        }
        var labels = (reel.getAttribute('data-labels') || 'bin,edge,dot,mix,ink,sym').split(',');
        var modes = ['bin', 'edge', 'dot', 'mix', 'ink', 'sym'];
        var N = 12;
        var FIG = 196;                       /* ширина кадру разом з проміжком, px (див. .reel figure у style.css) */
        var canvases = [];
        var sets = 0;

        /* Доріжка складається з однакових наборів кадрів; їде вона на ширину одного набору, тож цикл безшовний.
           Наборів має вистачати, щоб праворуч від екрана ніколи не було порожньо навіть на дуже широкому моніторі. */
        function need() {
            return Math.max(2, Math.ceil(window.innerWidth / (N * FIG)) + 1);
        }

        function addSet() {
            for (var k = 0; k < N; k++) {
                var fig = document.createElement('figure');
                var cv = document.createElement('canvas');
                cv.width = 364;
                cv.height = 248;
                var cap = document.createElement('figcaption');
                var a = document.createElement('span');
                var b = document.createElement('span');
                a.textContent = pad(k + 1, 3);
                b.textContent = labels[k % modes.length] || '';
                cap.appendChild(a);
                cap.appendChild(b);
                fig.appendChild(cv);
                fig.appendChild(cap);
                track.appendChild(fig);
                canvases.push(cv);
            }
            sets++;
        }

        function grow() {
            var fresh = false;
            while (sets < need()) {
                addSet();
                fresh = true;
            }
            track.setAttribute('data-set', String(N * FIG));
            return fresh;
        }
        grow();
        var scene = new Scene(91, 62, DEMO_CFG);

        function copies() {
            for (var s = 1; s < sets; s++) {
                for (var n = 0; n < N; n++) {
                    canvases[s * N + n].getContext('2d').drawImage(canvases[n], 0, 0);
                }
            }
        }

        function draw() {
            var colors = readColors();
            for (var n = 0; n < N; n++) {
                scene.render(0.1 + 0.8 * (n / (N - 1)), 0.26 + 0.12 * Math.sin(n * 1.3));
                scene.paint(canvases[n].getContext('2d'), 364, 248, modes[n % modes.length], 0, colors, 26);
            }
            copies();
        }
        onResize(function () {
            if (grow()) {
                copies();
            }
        });
        draw();
        window.addEventListener('inkpalette', draw);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(draw);
        }
    }

    /* 4c. Пластина: один кадр у двох полярностях, розділених S-кривою; світло йде за курсором */
    function initPlate() {
        var canvas = document.getElementById('plate');
        if (!canvas || !canvas.getContext) {
            return;
        }
        var ctx = canvas.getContext('2d');
        var scene = null;
        var colors = readColors();
        var light = { x: 0.3, y: 0.28 };
        var goal = { x: 0.3, y: 0.28 };
        var dirty = true;
        var visible = true;
        var last = 0;
        var t0 = performance.now();

        function fit() {
            var r = canvas.getBoundingClientRect();
            if (r.width < 20) {
                return false;
            }
            var W = Math.max(40, Math.round(r.width / 2));
            var H = Math.round(W * 1.25);
            if (!scene || scene.W !== W || scene.H !== H) {
                scene = new Scene(W, H, PLATE_CFG);
                canvas.width = W;
                canvas.height = H;
                dirty = true;
            }
            return true;
        }

        function draw() {
            scene.render(light.x, light.y);
            scene.polarize(0.2);
            scene.paint(ctx, scene.W, scene.H, 'dot', 0, colors, 0);
        }

        tickers.push(function (now) {
            if (!visible || !scene || now - last < 50) {
                return;
            }
            if (pointer.t > t0 && now - pointer.t < 2500) {
                goal.x = pointer.x;
                goal.y = pointer.y;
            }
            else if (!reduced) {
                var t = (now - t0) / 1000;
                goal.x = 0.5 + 0.3 * Math.cos(t * 0.33);
                goal.y = 0.3 + 0.1 * Math.sin(t * 0.47);
            }
            var nx = light.x + (goal.x - light.x) * 0.16;
            var ny = light.y + (goal.y - light.y) * 0.16;
            var moved = Math.abs(nx - light.x) + Math.abs(ny - light.y) > 0.0006;
            light.x = nx;
            light.y = ny;
            if (!moved && !dirty) {
                return;
            }
            last = now;
            dirty = false;
            draw();
        });

        if (fit()) {
            draw();
        }
        onResize(function () {
            if (fit()) {
                draw();
            }
        });
        window.addEventListener('inkpalette', function () {
            colors = readColors();
            dirty = true;
        });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                if (visible) {
                    dirty = true;
                }
            }).observe(canvas);
        }
    }

    /* 5. Жива демонстрація: вигадана сцена, яку «ведеш» курсором, або власне фото чи відео (лише в пам'яті браузера) */
    function initDemo() {
        var canvas = document.getElementById('ink');
        if (!canvas || !canvas.getContext) {
            return;
        }
        var ctx = canvas.getContext('2d');
        var frame = document.getElementById('demo');
        var film = canvas.parentNode;
        var tc = document.getElementById('tc');
        var rd = document.getElementById('rd');
        var srcBar = document.getElementById('src');
        var srcName = document.getElementById('srcname');
        var playBtn = document.getElementById('playpause');
        var msg = document.getElementById('srcmsg');
        var W = 480;
        var H = 320;
        var scene = null;
        var source = null;
        var lvMode = 'dot';
        var level = 3;
        var symOn = false;
        var SYM_COLS = [44, 60, 76, 96, 120];
        var bias = 0;
        var colors = readColors();
        var dirty = true;
        var visible = true;
        var userPaused = false;
        var target = { x: 0.5, y: 0.3 };
        var cur = { x: 0.5, y: 0.3 };
        var lastPointer = -1e9;
        var t0 = performance.now();
        var last = 0;

        /* Розмір кадру: близько 160 тисяч пікселів у пропорції файлу (парні числа: полотно рівно вдвічі більше) */
        function dimsFor(a) {
            a = clamp(a, 0.5, 2.4);
            return [Math.round(Math.sqrt(160000 * a) / 2) * 2, Math.round(Math.sqrt(160000 / a) / 2) * 2];
        }

        function useScene(w, h) {
            W = w;
            H = h;
            canvas.width = W * 2;
            canvas.height = H * 2;
            scene = new Scene(W, H, DEMO_CFG);
            if (w === 480 && h === 320) {
                canvas.style.aspectRatio = '';
                canvas.style.maxWidth = '';
            }
            else {
                canvas.style.aspectRatio = W + ' / ' + H;
                canvas.style.maxWidth = 'min(100%, calc(74vh * ' + (W / H).toFixed(4) + '))';
            }
            dirty = true;
        }
        useScene(480, 320);

        function readout() {
            if (!rd) {
                return;
            }
            var active = document.querySelector('[data-level][aria-pressed="true"]');
            var symBtn = document.getElementById('symtoggle');
            var b = Math.round(bias * 100);
            rd.textContent = (active ? active.getAttribute('data-level') + ' · ' + active.querySelector('span').textContent.trim() : '')
                + (symOn && symBtn ? ' · ' + symBtn.textContent.trim() : '') + ' · ' + (rd.getAttribute('data-bias') || '')
                + ' ' + (b > 0 ? '+' : b < 0 ? '−' : '±') + pad(Math.abs(b));
        }

        function updateTimecode(now) {
            if (!tc) {
                return;
            }
            var f = source ? (source.kind === 'video' ? Math.floor(source.el.currentTime * 24) : 0) : Math.floor((now - t0) / 1000 * 24);
            tc.textContent = pad(Math.floor(f / 86400) % 100) + ':' + pad(Math.floor(f / 1440) % 60) + ':' + pad(Math.floor(f / 24) % 60) + ':' + pad(f % 24);
        }

        function draw(now) {
            if (source) {
                if (source.fresh) {
                    scene.fromSource(source.el, source.w, source.h);
                    if (!source.lev) {
                        source.lev = scene.measure();
                    }
                    scene.levels(source.lev);
                    source.fresh = false;
                }
            }
            else {
                scene.render(cur.x, cur.y);
            }
            scene.paint(ctx, canvas.width, canvas.height, symOn ? 'sym' : lvMode, bias, colors, SYM_COLS[level - 1]);
            updateTimecode(now);
        }

        tickers.push(function (now) {
            if (!visible) {
                return;
            }
            if (source) {
                var fresh = false;
                if (source.kind === 'video') {
                    var v = source.el;
                    if (now - last >= 33 && v.readyState >= 2 && v.currentTime !== source.t) {
                        source.t = v.currentTime;
                        source.fresh = true;
                        fresh = true;
                    }
                }
                if (!fresh && !dirty) {
                    return;
                }
                last = now;
                dirty = false;
                draw(now);
                return;
            }
            if (now - last < 33 && !dirty) {
                return;
            }
            if (!reduced && now - lastPointer > 2500) {
                var t = (now - t0) / 1000;
                target.x = 0.5 + 0.36 * Math.cos(t * 0.55);
                target.y = 0.3 + 0.14 * Math.sin(t * 0.8);
            }
            var nx = cur.x + (target.x - cur.x) * 0.2;
            var ny = cur.y + (target.y - cur.y) * 0.2;
            var moved = Math.abs(nx - cur.x) + Math.abs(ny - cur.y) > 0.0004;
            cur.x = nx;
            cur.y = ny;
            if (!moved && !dirty) {
                return;
            }
            last = now;
            dirty = false;
            draw(now);
        });

        function onPointer(e) {
            if (source) {
                return;
            }
            var rect = canvas.getBoundingClientRect();
            target.x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
            target.y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
            lastPointer = performance.now();
            dirty = true;
        }
        window.addEventListener('pointermove', onPointer, { passive: true });
        canvas.addEventListener('pointerdown', onPointer);

        var levelButtons = document.querySelectorAll('[data-level]');
        for (var i = 0; i < levelButtons.length; i++) {
            levelButtons[i].addEventListener('click', function (e) {
                lvMode = e.currentTarget.getAttribute('data-mode');
                level = clamp(parseInt(e.currentTarget.getAttribute('data-level'), 10) || 3, 1, 5);
                for (var j = 0; j < levelButtons.length; j++) {
                    levelButtons[j].setAttribute('aria-pressed', String(levelButtons[j] === e.currentTarget));
                }
                dirty = true;
                readout();
            });
        }
        var symToggle = document.getElementById('symtoggle');
        if (symToggle) {
            symToggle.addEventListener('click', function () {
                symOn = !symOn;
                symToggle.setAttribute('aria-pressed', String(symOn));
                dirty = true;
                readout();
            });
        }

        var slider = document.getElementById('bias');
        if (slider) {
            slider.addEventListener('input', function () {
                bias = parseInt(slider.value, 10) / 100;
                dirty = true;
                readout();
            });
        }

        var save = document.getElementById('save');
        if (save) {
            save.addEventListener('click', function () {
                canvas.toBlob(function (blob) {
                    if (!blob) {
                        return;
                    }
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'inkreel-frame.png';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(function () {
                        URL.revokeObjectURL(a.href);
                    }, 1000);
                }, 'image/png');
            });
        }

        /* --- власний файл --- */
        function say(text) {
            if (msg) {
                msg.textContent = text || '';
            }
        }

        function releaseSource() {
            if (!source) {
                return;
            }
            if (source.kind === 'video') {
                source.el.dead = true;
                source.el.pause();
                source.el.removeAttribute('src');
                source.el.load();
                URL.revokeObjectURL(source.url);
            }
            else if (source.el && source.el.close) {
                source.el.close();
            }
            source = null;
        }

        function clearSource() {
            releaseSource();
            userPaused = false;
            if (srcBar) {
                srcBar.hidden = true;
            }
            say('');
            useScene(480, 320);
            readout();
        }

        function playLabel() {
            if (!playBtn || !source || source.kind !== 'video') {
                return;
            }
            playBtn.textContent = playBtn.getAttribute(source.el.paused ? 'data-play' : 'data-pause');
        }

        function adopt(next) {
            if (!(next.w > 0 && next.h > 0)) {
                if (next.url) {
                    URL.revokeObjectURL(next.url);
                }
                fail();
                return;
            }
            releaseSource();
            var d = dimsFor(next.w / next.h);
            next.fresh = true;
            next.t = -1;
            next.lev = null;
            source = next;
            userPaused = false;
            useScene(d[0], d[1]);
            if (srcName) {
                srcName.textContent = next.name;
            }
            if (srcBar) {
                srcBar.hidden = false;
            }
            if (playBtn) {
                playBtn.hidden = next.kind !== 'video';
            }
            playLabel();
            say('');
            readout();
        }

        function fail() {
            say(frame ? frame.getAttribute('data-bad') : '');
        }

        function loadImage(file) {
            function ok(el, w, h) {
                adopt({ kind: 'image', el: el, w: w, h: h, name: file.name });
            }
            function viaImage() {
                var fr = new FileReader();
                fr.onload = function () {
                    var img = new Image();
                    img.onload = function () {
                        ok(img, img.naturalWidth, img.naturalHeight);
                    };
                    img.onerror = fail;
                    img.src = fr.result;
                };
                fr.onerror = fail;
                fr.readAsDataURL(file);
            }
            if (window.createImageBitmap) {
                window.createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
                    ok(bmp, bmp.width, bmp.height);
                }, viaImage);
            }
            else {
                viaImage();
            }
        }

        function loadVideo(file) {
            var v = document.createElement('video');
            var url = URL.createObjectURL(file);
            v.muted = true;
            v.loop = true;
            v.playsInline = true;
            v.setAttribute('playsinline', '');
            v.preload = 'auto';
            v.addEventListener('error', function () {
                if (v.dead) {
                    return;
                }
                URL.revokeObjectURL(url);
                fail();
            });
            v.addEventListener('loadeddata', function () {
                adopt({ kind: 'video', el: v, w: v.videoWidth, h: v.videoHeight, name: file.name, url: url });
                if (source && source.el === v) {
                    var p = v.play();
                    if (p && p.catch) {
                        p.catch(function () { /* автозапуск заборонено: лишиться кадр і кнопка «Грати» */ });
                    }
                }
            }, { once: true });
            v.addEventListener('play', playLabel);
            v.addEventListener('pause', playLabel);
            v.src = url;
        }

        function loadFile(file) {
            if (!file) {
                return;
            }
            var name = file.name || '';
            var isVideo = /^video\//.test(file.type) || /\.(mp4|m4v|webm|mov|ogv)$/i.test(name);
            var isImage = /^image\//.test(file.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(name);
            if (isVideo) {
                loadVideo(file);
            }
            else if (isImage) {
                loadImage(file);
            }
            else {
                fail();
            }
        }

        var pick = document.getElementById('pick');
        var input = document.getElementById('file');
        if (pick && input) {
            pick.addEventListener('click', function () {
                input.click();
            });
            input.addEventListener('change', function () {
                if (input.files && input.files[0]) {
                    loadFile(input.files[0]);
                }
                input.value = '';
            });
        }
        var reset = document.getElementById('reset');
        if (reset) {
            reset.addEventListener('click', clearSource);
        }
        if (playBtn) {
            playBtn.addEventListener('click', function () {
                if (!source || source.kind !== 'video') {
                    return;
                }
                if (source.el.paused) {
                    userPaused = false;
                    source.el.play();
                }
                else {
                    userPaused = true;
                    source.el.pause();
                }
            });
        }

        function hasFiles(e) {
            return !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0);
        }
        if (frame) {
            var enter = function (e) {
                if (hasFiles(e)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    film.classList.add('drop');
                }
            };
            frame.addEventListener('dragenter', enter);
            frame.addEventListener('dragover', enter);
            frame.addEventListener('dragleave', function (e) {
                if (!e.relatedTarget || !frame.contains(e.relatedTarget)) {
                    film.classList.remove('drop');
                }
            });
            frame.addEventListener('drop', function (e) {
                if (!hasFiles(e)) {
                    return;
                }
                e.preventDefault();
                film.classList.remove('drop');
                loadFile(e.dataTransfer.files[0]);
            });
        }
        document.addEventListener('paste', function (e) {
            var files = e.clipboardData && e.clipboardData.files;
            if (visible && files && files.length) {
                loadFile(files[0]);
            }
        });

        function pauseVideo(hold) {
            if (source && source.kind === 'video' && !source.el.paused && hold) {
                source.el.pause();
            }
        }
        function resumeVideo() {
            if (source && source.kind === 'video' && source.el.paused && !userPaused && visible && !document.hidden) {
                var p = source.el.play();
                if (p && p.catch) {
                    p.catch(function () { /* без автозапуску */ });
                }
            }
        }
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                pauseVideo(true);
            }
            else {
                resumeVideo();
            }
        });

        window.addEventListener('inkpalette', function () {
            colors = readColors();
            dirty = true;
        });
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                dirty = true;
                readout();
            });
        }
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                if (visible) {
                    dirty = true;
                    resumeVideo();
                }
                else {
                    pauseVideo(true);
                }
            }).observe(canvas);
        }
        readout();
    }

    /* 6. «Душа»: слід пера, лінія читання, світло в картках, плівка реагує на прокручування, вкладка з характером */
    var fine = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    var PEN_KEY = 'inkreel-pen';
    var LANG = (root.getAttribute('lang') || 'uk').slice(0, 2);

    function store(key, val) {
        try {
            if (val === undefined) {
                return localStorage.getItem(key);
            }
            localStorage.setItem(key, val);
        }
        catch (e) { /* приватний режим: просто не зберігаємо */ }
        return null;
    }

    function cssRgb(name) {
        return hexToRgb(getComputedStyle(root).getPropertyValue(name));
    }

    /* Слід пера: тонка лінія за курсором, що висихає за секунду. Лише для миші; вимикається кнопкою в підвалі. */
    function initPen() {
        var toggles = document.querySelectorAll('[data-pen]');
        if (!fine || reduced || !toggles.length || !window.CanvasRenderingContext2D) {
            return;
        }
        var on = store(PEN_KEY) !== '0';
        var canvas = document.createElement('canvas');
        canvas.className = 'trail';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.hidden = true;
        document.body.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var LIFE = 1000;
        var pts = [];
        var color = 'rgb(255,255,255)';
        var last = null;
        var speed = 0;

        function fit() {
            canvas.width = Math.round(window.innerWidth * dpr);
            canvas.height = Math.round(window.innerHeight * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }

        /* режим difference: колір мазка = |папір − чорнило|, тож на папері лишається чорнило, а на чорній смузі — папір */
        function tint() {
            var a = cssRgb('--ink');
            var b = cssRgb('--paper');
            color = 'rgb(' + Math.abs(a[0] - b[0]) + ',' + Math.abs(a[1] - b[1]) + ',' + Math.abs(a[2] - b[2]) + ')';
        }

        function label() {
            for (var i = 0; i < toggles.length; i++) {
                toggles[i].hidden = false;
                toggles[i].setAttribute('aria-pressed', String(on));
                toggles[i].textContent = toggles[i].getAttribute(on ? 'data-on' : 'data-off');
            }
        }

        for (var k = 0; k < toggles.length; k++) {
            toggles[k].addEventListener('click', function () {
                on = !on;
                store(PEN_KEY, on ? '1' : '0');
                if (!on) {
                    pts.length = 0;
                    last = null;
                }
                label();
            });
        }

        window.addEventListener('pointermove', function (e) {
            if (!on || e.pointerType === 'touch') {
                return;
            }
            var t = e.target;
            var onCv = !!(t && t.closest && t.closest('canvas'));
            var x = e.clientX;
            var y = e.clientY;
            var start = true;
            if (last) {
                var dx = x - last.x;
                var dy = y - last.y;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d < 2.5) {
                    return;
                }
                var dt = Math.max(1, e.timeStamp - last.t);
                speed = speed * 0.7 + (d / dt) * 0.3;
                start = dt > 160;
            }
            /* над канвою слід приглушений і розпилюється на краплі (c, rx, ry): суцільна лінія на картинці була б надто різкою */
            pts.push({ x: x, y: y, t: performance.now(), w: clamp(3.8 - speed * 1.5, 0.9, 3.8), s: start, c: onCv, rx: Math.random() * 2 - 1, ry: Math.random() * 2 - 1 });
            if (pts.length > 90) {
                pts.shift();
            }
            last = { x: x, y: y, t: e.timeStamp };
            canvas.hidden = false;
        }, { passive: true });

        tickers.push(function (now) {
            if (canvas.hidden) {
                return;
            }
            while (pts.length && now - pts[0].t > LIFE) {
                pts.shift();
            }
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            if (!pts.length) {
                canvas.hidden = true;
                return;
            }
            ctx.strokeStyle = color;
            for (var i = 1; i < pts.length - 1; i++) {
                var p0 = pts[i - 1];
                var p1 = pts[i];
                var p2 = pts[i + 1];
                var life = 1 - (now - p1.t) / LIFE;
                if (life <= 0) {
                    continue;
                }
                if (p1.c) {
                    /* на канві: тьмяні краплі, що з часом розлітаються від місця дотику й меншають */
                    var age = 1 - life;
                    ctx.globalAlpha = life * 0.45;
                    ctx.fillStyle = color;
                    for (var d = 0; d < 2; d++) {
                        var sx = d ? -0.7 * p1.ry : p1.rx;
                        var sy = d ? 0.9 * p1.rx : p1.ry;
                        ctx.beginPath();
                        ctx.arc(p1.x + sx * age * 20, p1.y + sy * age * 20, Math.max(0.35, p1.w * (d ? 0.3 : 0.5) * (1 - age * 0.6)), 0, 6.2832);
                        ctx.fill();
                    }
                    continue;
                }
                if (p1.s || p2.s) {
                    continue;
                }
                ctx.globalAlpha = life * 0.92;
                ctx.lineWidth = p1.w * (0.3 + 0.7 * life);
                ctx.beginPath();
                ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
                ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        });

        fit();
        tint();
        label();
        onResize(fit);
        window.addEventListener('inkpalette', function () {
            tint();
            pts.length = 0;
            last = null;
        });
    }

    /* ---- Підказки й «живі події» ----
       Підказки: сорок коротких фраз (q = цитата, s = про сайт, p = про програму), що в довільні миті з'являються в різних місцях екрана
       в шести виглядах. Події: краплі чорнила, плями, кола на воді, мазки пера. Усе тимчасове, не ловить клацання, не лізе на текст.
       Вимикається кнопкою «Сюрпризи» внизу сторінки; з prefers-reduced-motion події не показуються. */
    var TIPS_UK = [
        ['q', 'Чорне — не відсутність світла. Це рішення.'],
        ['q', 'Розфокусуйся на мить: між чорним і білим відкриються незліченні відтінки.'],
        ['q', 'Око ловить лише різницю: тут світліше, там темніше.'],
        ['q', 'Без тіні немає форми, без світла немає тіні.'],
        ['q', 'Гравюрники знали це п’ять століть тому. Ми лише навчили цьому кадри.'],
        ['q', 'Кожен піксель — одне питання: світло чи тінь?'],
        ['q', 'Біле — пауза. Чорне — слово.'],
        ['q', 'Півтон — чесний обман: око складає його з крапок.'],
        ['q', 'Те саме чорнило при тих самих налаштуваннях. Без «настрою» алгоритму.'],
        ['q', 'Чорно-біле — не бідність, а відбір.'],
        ['q', 'Між чорним і білим не порожнеча, а все решта.'],
        ['q', 'Усе зайве відпадає, лишається форма.'],
        ['s', 'Киньте в демонстрацію власне фото чи відео: воно не залишає браузер.'],
        ['s', 'Натисніть I або слово «двох»: світло й тінь поміняються місцями.'],
        ['s', 'Рухайте курсором по демонстрації: джерело світла піде за ним.'],
        ['s', 'Повзунок «Баланс» зсуває межу між світлом і тінню. Це забавка сайту: у програмі стиль добирається сам.'],
        ['s', 'У демонстрації «Символи» міняють щільність знаків разом із рівнем.'],
        ['s', 'Слід пера й ці тихі сюрпризи вимикаються внизу сторінки.'],
        ['s', 'Угорі шість палітр із програми: чорне й біле не мусить бути чорним і білим.'],
        ['s', 'Наведіть курсор на кнопки рівнів: кожна коротко показує свій почерк.'],
        ['s', 'Плівка під заголовком пришвидшується, коли гортаєте сторінку. Спробуйте погортати назад.'],
        ['s', 'Клавіша I працює і на цій сторінці, і в програмі.'],
        ['p', 'У програмі п’ять рівнів: Ескіз, Контур, Півтон, Малюнок, Гравюра.'],
        ['p', 'IRNM1 — не шостий щабель, а окрема гілка: нейромережа, що вчилася в «Гравюри».'],
        ['p', 'Пробіл — пауза, ←/→ — кадр за кадром.'],
        ['p', 'Клавіша F або подвійний клік — режим «кіно»: лише кадр на весь екран.'],
        ['p', 'Колесо миші в програмі збільшує цілими кроками до 6400 %: піксель завжди лишається квадратом.'],
        ['p', 'У програмі двадцять палітр: від «Туші і паперу» до «Ретро LCD».'],
        ['p', '«Порахувати все»: порахували раз — і граєте, масштабуєте, експортуєте без перерахунку.'],
        ['p', 'Розмір «Авто»: програма сама міряє швидкість вашого ПК і бере найбільший розмір, що йде в реальному часі.'],
        ['p', 'На слабкому ПК програма рахує кожен N-й кадр, а час і звук лишаються на місці.'],
        ['p', 'Експорт відео бере звук з оригіналу.'],
        ['p', 'Ліміт кадрів на секунду зменшує роботу, а тривалість і звук лишаються.'],
        ['p', 'У режимі «Символи» кожен знак — справжній гліф моноширинного шрифту.'],
        ['p', 'Клавіші [ та ] позначають початок і кінець фрагмента для експорту.'],
        ['p', 'Файл можна відкрити через Ctrl+O або перетягнути у вікно.'],
        ['p', 'Програма вгадує тип файлу за вмістом, а не за розширенням.'],
        ['p', '«Кадр → фото» зберігає без втрат: PNG, BMP, TIFF або WebP.'],
        ['p', 'Відеокарта не обов’язкова: IRNM1 сам вибере, на чому рахувати.'],
        ['p', 'Той самий кадр дає те саме чорнило: дрібниці не «пливуть» від запуску до запуску.']
    ];
    var TIPS_EN = [
        ['q', 'Black is not the absence of light. It is a decision.'],
        ['q', 'Unfocus for a moment: between black and white, countless shades open up.'],
        ['q', 'The eye catches only difference: lighter here, darker there.'],
        ['q', 'Without shadow there is no form, without light there is no shadow.'],
        ['q', 'Engravers knew this five centuries ago. We only taught it to frames.'],
        ['q', 'Every pixel is one question: light or shadow?'],
        ['q', 'White is a pause. Black is a word.'],
        ['q', 'A halftone is an honest trick: the eye assembles it from dots.'],
        ['q', 'The same ink with the same settings. No algorithm “mood”.'],
        ['q', 'Black and white is not poverty, it is selection.'],
        ['q', 'Between black and white there is not emptiness, but everything else.'],
        ['q', 'Everything extra falls away; form remains.'],
        ['s', 'Drop your own photo or video into the demo: it never leaves your browser.'],
        ['s', 'Press I or the word “two”: light and shadow swap places.'],
        ['s', 'Move the cursor over the demo: the light source follows it.'],
        ['s', 'The “Balance” slider shifts the line between light and shadow. It is a toy of this site: the app chooses the style by itself.'],
        ['s', 'In the demo, “Symbols” change glyph density along with the level.'],
        ['s', 'The pen trail and these quiet surprises can be switched off at the bottom of the page.'],
        ['s', 'Six palettes from the app are at the top: black and white need not be black and white.'],
        ['s', 'Hover the level buttons: each one briefly shows its own hand.'],
        ['s', 'The film strip under the headline speeds up when you scroll. Try scrolling back.'],
        ['s', 'The I key works on this page and in the app.'],
        ['p', 'The app has five levels: Sketch, Outline, Halftone, Drawing, Engraving.'],
        ['p', 'IRNM1 is not a sixth step but a separate branch: a neural network that learned from “Engraving”.'],
        ['p', 'Space pauses, ←/→ steps frame by frame.'],
        ['p', 'The F key or a double click is “cinema” mode: only the frame, full screen.'],
        ['p', 'In the app the mouse wheel zooms in whole steps up to 6400%: a pixel always stays a square.'],
        ['p', 'The app has twenty palettes: from “Ink & paper” to “Retro LCD”.'],
        ['p', '“Bake it all”: compute once, then play, zoom and export without recomputing.'],
        ['p', 'Size “Auto”: the app measures your PC and picks the largest size that runs in real time.'],
        ['p', 'On a weak PC the app computes every Nth frame, while time and sound stay in place.'],
        ['p', 'Video export takes the sound from the original.'],
        ['p', 'A frame-rate cap reduces the work, while duration and sound stay.'],
        ['p', 'In “Symbols” mode every glyph is a real glyph of a monospaced font.'],
        ['p', 'The [ and ] keys mark the start and end of a fragment for export.'],
        ['p', 'Open a file with Ctrl+O or drag it into the window.'],
        ['p', 'The app recognizes a file by its content, not by its extension.'],
        ['p', '“Frame → photo” saves losslessly: PNG, BMP, TIFF or WebP.'],
        ['p', 'A graphics card is optional: IRNM1 picks what to run on by itself.'],
        ['p', 'The same frame gives the same ink: details do not drift from run to run.']
    ];
    var funOn = true;
    var fxApi = null;

    function rand(a, b) {
        return a + Math.random() * (b - a);
    }

    /* Події: краплі, плями, кола, мазки. Усе малюється елементами з Web Animations, шар один, змішування difference, як у сліду пера */
    function initFx() {
        if (reduced || !document.body.animate) {
            return;
        }
        var layer = document.createElement('div');
        layer.className = 'fx';
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        document.body.appendChild(layer);
        var live = 0;

        function tint() {
            var a = cssRgb('--ink');
            var b = cssRgb('--paper');
            layer.style.setProperty('--fx', 'rgb(' + Math.abs(a[0] - b[0]) + ',' + Math.abs(a[1] - b[1]) + ',' + Math.abs(a[2] - b[2]) + ')');
        }

        function put(el, frames, opts) {
            layer.appendChild(el);
            live++;
            layer.hidden = false;
            var anim = el.animate(frames, opts);
            var done = function () {
                if (el.parentNode) {
                    el.remove();
                    live = Math.max(0, live - 1);
                    if (!live) {
                        layer.hidden = true;
                    }
                }
            };
            anim.onfinish = done;
            anim.oncancel = done;
            return anim;
        }

        function bit(x, y, w, h, radius) {
            var e = document.createElement('i');
            e.className = 'fx-i';
            e.style.left = x.toFixed(1) + 'px';
            e.style.top = y.toFixed(1) + 'px';
            e.style.width = w.toFixed(1) + 'px';
            e.style.height = (h || w).toFixed(1) + 'px';
            e.style.borderRadius = radius || '50%';
            return e;
        }

        function wobble() {
            var r = [];
            for (var i = 0; i < 8; i++) {
                r.push(Math.round(rand(36, 64)) + '%');
            }
            return r.slice(0, 4).join(' ') + ' / ' + r.slice(4).join(' ');
        }

        /* удар краплі: пляма, коло на воді, бризки вгору й убік */
        function splash(x, y, k) {
            var s = rand(11, 20) * k;
            put(bit(x - s / 2, y - s / 2, s, s, wobble()), [
                { transform: 'scale(0)', opacity: 0.95 },
                { transform: 'scale(1.18)', opacity: 0.95, offset: 0.1 },
                { transform: 'scale(1)', opacity: 0.88, offset: 0.35 },
                { transform: 'scale(1)', opacity: 0 }
            ], { duration: 5200, easing: 'ease-out' });
            var ring = bit(x - 3, y - 3, 6, 6, '50%');
            ring.style.background = 'none';
            ring.style.border = '1px solid var(--fx)';
            put(ring, [{ transform: 'scale(0.3)', opacity: 0.9 }, { transform: 'scale(' + (8 * k).toFixed(1) + ')', opacity: 0 }], { duration: 950, easing: 'cubic-bezier(.2,.7,.2,1)' });
            var n = 4 + Math.floor(Math.random() * 4);
            for (var i = 0; i < n; i++) {
                var sz = rand(1.6, 3.8) * k;
                var ang = -Math.PI * rand(0.08, 0.92);
                var dist = rand(16, 46) * k;
                var dx = Math.cos(ang) * dist;
                var dy = Math.sin(ang) * dist;
                put(bit(x - sz / 2, y - sz / 2, sz, sz, '50%'), [
                    { transform: 'translate(0,0)', opacity: 0.9 },
                    { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)', opacity: 0.9, offset: 0.5 },
                    { transform: 'translate(' + (dx * 1.15).toFixed(1) + 'px,' + (dy + 22 * k).toFixed(1) + 'px)', opacity: 0 }
                ], { duration: rand(600, 1000), easing: 'cubic-bezier(.2,.6,.4,1)' });
            }
        }

        /* крапля набухає, відривається, падає й б'ється об сторінку */
        function drip(x, y0, fall) {
            var w = rand(6, 9);
            var e = bit(x - w / 2, y0, w, w * 1.25, '50% 50% 50% 50% / 62% 62% 38% 38%');
            var hang = rand(1100, 1900);
            var dur = 520 + fall * 0.9;
            var cut = hang / (hang + dur);
            var a = put(e, [
                { transform: 'translateY(0) scale(0.2)', opacity: 0 },
                { transform: 'translateY(0) scale(1)', opacity: 1, offset: cut * 0.55 },
                { transform: 'translateY(2px) scale(0.85,1.5)', opacity: 1, offset: cut, easing: 'cubic-bezier(.5,0,1,.5)' },
                { transform: 'translateY(' + fall.toFixed(0) + 'px) scale(0.7,2.1)', opacity: 1 }
            ], { duration: hang + dur, easing: 'linear' });
            a.addEventListener('finish', function () {
                splash(x, y0 + fall, rand(0.8, 1.2));
            });
        }

        function ripple(x, y) {
            for (var i = 0; i < 3; i++) {
                var ring = bit(x - 4, y - 4, 8, 8, '50%');
                ring.style.background = 'none';
                ring.style.border = '1px solid var(--fx)';
                put(ring, [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1.5)', opacity: 0.8, offset: 0.12 }, { transform: 'scale(' + (14 + i * 4) + ')', opacity: 0 }],
                    { duration: 2300, delay: i * 260, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'backwards' });
            }
        }

        /* мазок пера з тих самих масок, що й підкреслення (assets/pen) */
        var STROKES = [['u1', 240, 30], ['u2', 260, 28], ['u3', 210, 32], ['swash-s', 560, 38], ['flourish', 460, 70]];
        function streak(x, y) {
            var s = STROKES[Math.floor(Math.random() * STROKES.length)];
            var w = rand(120, 260);
            var e = bit(x, y, w, w * s[2] / s[1], '0');
            var url = 'url("/assets/pen/' + s[0] + '.svg")';
            e.style.webkitMask = url + ' center / 100% 100% no-repeat';
            e.style.mask = url + ' center / 100% 100% no-repeat';
            e.style.rotate = rand(-4, 4).toFixed(1) + 'deg';
            put(e, [
                { clipPath: 'inset(-4px 100% -4px -4px)', opacity: 1 },
                { clipPath: 'inset(-4px -4px -4px -4px)', opacity: 1, offset: 0.3 },
                { clipPath: 'inset(-4px -4px -4px -4px)', opacity: 0.9, offset: 0.7 },
                { clipPath: 'inset(-4px -4px -4px -4px)', opacity: 0 }
            ], { duration: 4200, easing: 'cubic-bezier(.3,.6,.2,1)' });
        }

        function visibleHeading() {
            var list = document.querySelectorAll('h1, h2');
            var pick = [];
            for (var i = 0; i < list.length; i++) {
                var r = list[i].getBoundingClientRect();
                if (r.top > 90 && r.bottom < window.innerHeight - 40 && r.width > 40) {
                    pick.push([list[i], r]);
                }
            }
            return pick.length ? pick[Math.floor(Math.random() * pick.length)] : null;
        }

        /* чорнило «пробиває» літери заголовка й крапля скочується з нього */
        function bleed() {
            var h = visibleHeading();
            if (!h) {
                return false;
            }
            h[0].classList.add('bleed');
            window.setTimeout(function () {
                h[0].classList.remove('bleed');
            }, 2300);
            drip(h[1].left + rand(0.1, 0.8) * Math.min(h[1].width, 600), h[1].bottom - 6, rand(60, 160));
            return true;
        }

        function fire() {
            if (!funOn || document.hidden || root.classList.contains('vt')) {
                return;
            }
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            var top = (document.querySelector('.top') || { offsetHeight: 50 }).offsetHeight;
            var r = Math.random();
            if (r < 0.34) {
                drip(rand(vw * 0.05, vw * 0.95), top - 2, rand(vh * 0.3, vh * 0.8));
            }
            else if (r < 0.52) {
                splash(rand(vw * 0.08, vw * 0.92), rand(vh * 0.2, vh * 0.88), rand(1.4, 2.4));
            }
            else if (r < 0.7) {
                ripple(rand(vw * 0.08, vw * 0.92), rand(vh * 0.2, vh * 0.85));
            }
            else if (r < 0.86) {
                streak(rand(vw * 0.04, vw * 0.7), rand(vh * 0.15, vh * 0.85));
            }
            else if (!bleed()) {
                drip(rand(vw * 0.05, vw * 0.95), top - 2, rand(vh * 0.3, vh * 0.7));
            }
        }

        function loop() {
            window.setTimeout(function () {
                fire();
                loop();
            }, rand(7000, 17000));
        }
        window.setTimeout(function () {
            fire();
            loop();
        }, rand(4500, 8500));

        tint();
        window.addEventListener('inkpalette', tint);
        fxApi = {
            /* підказка зникає: з її нижнього краю зриваються дві-три краплі */
            dissolve: function (rect) {
                var n = 2 + Math.floor(Math.random() * 2);
                for (var i = 0; i < n; i++) {
                    var sz = rand(2.5, 5);
                    var x = rect.left + rect.width * rand(0.15, 0.85);
                    var y = rect.bottom - 2;
                    var d = rand(30, 90);
                    put(bit(x - sz / 2, y, sz, sz * 1.3, '50% 50% 50% 50% / 62% 62% 38% 38%'), [
                        { transform: 'translateY(0)', opacity: 0.9 },
                        { transform: 'translateY(' + d.toFixed(0) + 'px) scale(0.8,1.6)', opacity: 0 }
                    ], { duration: rand(700, 1300), delay: i * 140, easing: 'cubic-bezier(.5,0,1,.6)', fill: 'backwards' });
                }
            }
        };
    }

    var TIP_STYLES = { q: ['note', 'blot', 'tag'], p: ['stamp', 'film', 'margin', 'tag'], s: ['note', 'margin', 'stamp'] };
    var TIP_BLOCK = 'p,h1,h2,h3,h4,li,a,button,canvas,input,label,summary,blockquote,figcaption,small,span,svg,img,nav,.inv,.pen,.disc,.sw,.film,.plate,.reel';

    function initWhispers() {
        var tips = LANG === 'en' ? TIPS_EN : TIPS_UK;
        var FUN_KEY = 'inkreel-fun';
        funOn = store(FUN_KEY) !== '0';
        var layer = document.createElement('div');
        layer.className = 'whispers';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);

        /* кнопка в підвалі поруч зі «Слідом пера» */
        var toggles = [];
        var acts = document.querySelectorAll('.ps-act');
        function label() {
            for (var i = 0; i < toggles.length; i++) {
                toggles[i].setAttribute('aria-pressed', String(funOn));
                toggles[i].textContent = LANG === 'en' ? (funOn ? 'Surprises: on' : 'Surprises: off') : (funOn ? 'Сюрпризи: є' : 'Сюрпризи: нема');
            }
        }
        for (var a = 0; a < acts.length; a++) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mini';
            btn.addEventListener('click', function () {
                funOn = !funOn;
                store(FUN_KEY, funOn ? '1' : '0');
                if (!funOn) {
                    layer.textContent = '';
                }
                label();
            });
            acts[a].appendChild(btn);
            toggles.push(btn);
        }
        label();

        var bag = [];
        var lastIdx = -1;
        function nextIndex() {
            if (!bag.length) {
                for (var i = 0; i < tips.length; i++) {
                    bag.push(i);
                }
                for (var j = bag.length - 1; j > 0; j--) {
                    var k = Math.floor(Math.random() * (j + 1));
                    var t = bag[j];
                    bag[j] = bag[k];
                    bag[k] = t;
                }
            }
            var idx = bag.pop();
            if (idx === lastIdx && bag.length) {
                var other = bag.pop();
                bag.push(idx);
                idx = other;
            }
            lastIdx = idx;
            return idx;
        }

        /* скільки з дванадцяти пробних точок прямокутника лежать на тексті, кнопках, картинках чи темній смузі */
        function blocked(x, y, w, h) {
            var hits = 0;
            for (var i = 0; i < 4; i++) {
                for (var j = 0; j < 3; j++) {
                    var els = document.elementsFromPoint(x + 4 + (w - 8) * i / 3, y + 4 + (h - 8) * j / 2);
                    var t = els[0];
                    if (t && t.closest && t.closest(TIP_BLOCK)) {
                        hits++;
                    }
                }
            }
            return hits;
        }

        function place(el) {
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            var w = el.offsetWidth;
            var h = el.offsetHeight;
            var best = null;
            var bestHits = 99;
            for (var t = 0; t < 16; t++) {
                var x = rand(12, Math.max(13, vw - w - 12));
                var y = rand(70, Math.max(71, vh - h - 14));
                var hits = blocked(x, y, w, h);
                if (hits < bestHits) {
                    bestHits = hits;
                    best = [x, y];
                    if (!hits) {
                        break;
                    }
                }
            }
            if (!best || bestHits > 1) {
                return false;
            }
            el.style.left = best[0].toFixed(0) + 'px';
            el.style.top = best[1].toFixed(0) + 'px';
            return true;
        }

        function show() {
            if (!funOn || document.hidden || layer.firstChild || root.classList.contains('vt')) {
                return false;
            }
            var idx = nextIndex();
            var tip = tips[idx];
            var styles = TIP_STYLES[tip[0]];
            var style = styles[Math.floor(Math.random() * styles.length)];
            var el = document.createElement('div');
            el.className = 'wh wh-' + style;
            el.style.setProperty('--r', rand(-2.6, 2.6).toFixed(1) + 'deg');
            el.style.visibility = 'hidden';
            if (style === 'stamp' || style === 'film') {
                var lab = document.createElement('b');
                lab.className = 'wh-lab';
                lab.textContent = style === 'film' ? pad(idx + 1, 3) + ' ◐' : (LANG === 'en' ? 'Hint ' : 'Підказка ') + pad(idx + 1);
                el.appendChild(lab);
            }
            var text = document.createElement('span');
            text.textContent = tip[1];
            el.appendChild(text);
            layer.appendChild(el);
            if (!place(el)) {
                el.remove();
                return false;
            }
            el.style.visibility = '';
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () {
                    el.classList.add('in');
                });
            });
            window.setTimeout(function () {
                var rect = el.getBoundingClientRect();
                el.classList.add('out');
                if (fxApi && (style === 'note' || style === 'blot' || style === 'tag')) {
                    fxApi.dissolve(rect);
                }
                window.setTimeout(function () {
                    el.remove();
                }, 1300);
            }, 4800 + tip[1].length * 60);
            return true;
        }

        function wait(ms) {
            window.setTimeout(function () {
                wait(show() ? rand(17000, 38000) : 3500);
            }, ms);
        }
        wait(rand(12000, 22000));
    }

    /* Прокручування: лінія читання, висока S-крива «пишеться» разом із рухом, плівка біжить швидше (а назад — навпаки) */
    function initScroll() {
        var top = document.querySelector('.top');
        var scrub = document.querySelectorAll('[data-scrub]');
        var track = document.querySelector('.reel-track');
        var reelBox = document.querySelector('.reel');
        var driven = false;
        var half = 0;
        var pos = 0;
        var prevT = 0;
        var reelOn = true;
        var rate = 1;
        var vel = 0;
        var lastY = window.pageYOffset;
        var lastT = performance.now();
        var queued = false;

        /* Плівка їде від коду, а не від CSS-анімації: змінювати playbackRate щокадру смикало її й губило кадри при прокручуванні вгору */
        if (track && !reduced) {
            driven = true;
            track.style.animation = 'none';
            track.style.willChange = 'transform';
            if (reelBox && window.IntersectionObserver) {
                new IntersectionObserver(function (entries) {
                    reelOn = entries[entries.length - 1].isIntersecting;
                }).observe(reelBox);
            }
            onResize(function () {
                half = 0;
            });
        }

        function update() {
            queued = false;
            var y = window.pageYOffset;
            var now = performance.now();
            var dt = Math.max(8, now - lastT);
            vel = vel * 0.55 + ((y - lastY) / dt) * 0.45;
            lastY = y;
            lastT = now;
            var vh = window.innerHeight;
            if (top) {
                var h = document.documentElement.scrollHeight - vh;
                top.style.setProperty('--read', (h > 0 ? clamp(y / h, 0, 1) : 0).toFixed(4));
            }
            for (var i = 0; i < scrub.length; i++) {
                var r = scrub[i].getBoundingClientRect();
                scrub[i].style.setProperty('--p', clamp((vh * 0.82 - r.top) / (r.height * 0.9), 0, 1).toFixed(4));
            }
        }

        window.addEventListener('scroll', function () {
            if (!queued) {
                queued = true;
                window.requestAnimationFrame(update);
            }
        }, { passive: true });
        onResize(update);
        update();

        if (driven) {
            tickers.push(function (now) {
                var dt = prevT ? Math.min(0.2, (now - prevT) / 1000) : 0;
                prevT = now;
                vel *= Math.pow(0.9, dt * 60);
                var goal = 1 + clamp(vel * 4, -5, 16);
                rate += (goal - rate) * (1 - Math.exp(-dt * 7));
                if (!half) {
                    half = parseFloat(track.getAttribute('data-set')) || 0;
                }
                if (!half || !reelOn) {
                    return;
                }
                /* один набір кадрів = один цикл; швидкість стала в пікселях (≈16 px/с), працює в обидва боки без межі */
                pos = (((pos + 16 * rate * dt) % half) + half) % half;
                track.style.transform = 'translate3d(' + (-pos).toFixed(1) + 'px,0,0)';
            });
        }
    }

    /* Світло з крапок у картках іде за курсором */
    function initGlow() {
        var grid = document.querySelector('.grid');
        if (!fine || !grid) {
            return;
        }
        var queued = false;
        var ev = null;
        grid.addEventListener('pointermove', function (e) {
            ev = e;
            if (queued) {
                return;
            }
            queued = true;
            window.requestAnimationFrame(function () {
                queued = false;
                var card = ev.target && ev.target.closest ? ev.target.closest('.card') : null;
                if (!card) {
                    return;
                }
                var r = card.getBoundingClientRect();
                card.style.setProperty('--gx', (ev.clientX - r.left).toFixed(1) + 'px');
                card.style.setProperty('--gy', (ev.clientY - r.top).toFixed(1) + 'px');
            });
        }, { passive: true });
    }

    /* Головні кнопки ледь тягнуться до курсора */
    function initMagnet() {
        var items = document.querySelectorAll('[data-magnet]');
        if (!fine || reduced || !items.length) {
            return;
        }
        var queued = false;
        var px = -1e4;
        var py = -1e4;
        function apply() {
            queued = false;
            for (var i = 0; i < items.length; i++) {
                var el = items[i];
                var r = el.getBoundingClientRect();
                var near = px > r.left - 70 && px < r.right + 70 && py > r.top - 70 && py < r.bottom + 70;
                if (near) {
                    var dx = px - (r.left + r.width / 2);
                    var dy = py - (r.top + r.height / 2);
                    el.style.translate = clamp(dx * 0.14, -7, 7).toFixed(1) + 'px ' + clamp(dy * 0.24, -5, 5).toFixed(1) + 'px';
                }
                else if (el.style.translate) {
                    el.style.translate = '';
                }
            }
        }
        window.addEventListener('pointermove', function (e) {
            px = e.clientX;
            py = e.clientY;
            if (!queued) {
                queued = true;
                window.requestAnimationFrame(apply);
            }
        }, { passive: true });
        root.addEventListener('mouseleave', function () {
            px = -1e4;
            py = -1e4;
            apply();
        });
    }

    /* Вкладка: значок і заголовок підлаштовуються під світло/тінь, а коли ви пішли в іншу вкладку, перевертаються */
    function initTab() {
        var link = document.querySelector('link[rel="icon"]');
        var title = document.title;
        var away = document.body.getAttribute('data-away') || title;
        if (!link) {
            return;
        }
        function icon(inverse) {
            var a = cssRgb('--ink');
            var b = cssRgb('--paper');
            var tile = 'rgb(' + (inverse ? b : a).join(',') + ')';
            var mark = 'rgb(' + (inverse ? a : b).join(',') + ')';
            /* та сама котушка, що й знак у шапці (assets/mark.svg) і значок програми: ліва половина суцільна, права розсипається в растр, шість отворів */
            var holes = '';
            for (var k = 0; k < 6; k++) {
                var ang = (30 + 60 * k) * Math.PI / 180;
                holes += '<circle cx="' + (16 + Math.cos(ang) * 7.3).toFixed(2) + '" cy="' + (16 + Math.sin(ang) * 7.3).toFixed(2) + '" r="2.5" fill="' + tile + '"/>';
            }
            return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="' + tile
                + '"/><defs><pattern id="p" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.75" fill="' + mark + '"/></pattern></defs>'
                + '<path d="M16 3.5a12.5 12.5 0 0 0 0 25z" fill="' + mark + '"/><path d="M16 3.5a12.5 12.5 0 0 1 0 25z" fill="url(#p)"/>'
                + holes + '<circle cx="16" cy="16" r="1.9" fill="' + tile + '"/><circle cx="16" cy="16" r="0.9" fill="' + mark + '"/></svg>');
        }
        function show() {
            link.setAttribute('type', 'image/svg+xml');
            link.setAttribute('href', icon(document.hidden));
            document.title = document.hidden ? away : title;
        }
        window.addEventListener('inkpalette', show);
        document.addEventListener('visibilitychange', show);
        show();
    }

    /* Привітання тим, хто зазирнув у консоль */
    function greet() {
        if (!window.console || !console.log) {
            return;
        }
        var uk = LANG === 'uk';
        console.log('%c InkReel %c ' + (uk ? 'Світло чи тінь? Натисніть I. Пишіть: raimex.crucible@gmail.com' : 'Light or shadow? Press I. Write to: raimex.crucible@gmail.com'),
            'background:#13110e;color:#f7f5ef;padding:3px 8px;font:600 12px Georgia,serif', 'font:12px Georgia,serif');
    }

    function initSoul() {
        initPen();
        initWhispers();
        initFx();
        initScroll();
        initGlow();
        initMagnet();
        initTab();
        greet();
    }

    function start() {
        initPalette();
        initFlip();
        initReveal();
        initHalftones();
        initReel();
        initPlate();
        initDemo();
        initSoul();
        window.requestAnimationFrame(loop);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    }
    else {
        start();
    }
}());
