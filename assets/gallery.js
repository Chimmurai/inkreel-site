/* Галерея InkReel: плитка; перемикач «пікселі ⇄ символи» чорнильною лінією, що в'їжджає з боку входу курсора й рухається за його напрямком. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var KINDS = ['s', 'wave', 'diag', 'torn', 'steps', 'brush'];
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fnv(s) { var h = 2166136261, i; for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function curve(slug, k) {
    var r = rng(fnv(slug)), kind = KINDS[k % 6], N = 81, i, dx = [], ts = [];
    for (i = 0; i < N; i++) { ts.push(i / (N - 1)); }
    function U(a, b) { return a + (b - a) * r(); }
    function sg() { return r() < 0.5 ? -1 : 1; }
    var wd = U(1.1, 1.9), nd = 3 + Math.floor(r() * 4), rmax = 1.7, A, ph, f, D, B, L, cur, lv, m, TP = 6.283;
    if (kind === 's') { A = U(5, 9); ph = U(0, TP); dx = ts.map(function (t) { return A * Math.sin(TP * t + ph); }); }
    else if (kind === 'wave') { A = U(3, 5.5); f = U(1.6, 2.6); ph = U(0, TP); dx = ts.map(function (t) { return A * Math.sin(TP * f * t + ph); }); }
    else if (kind === 'diag') { D = U(9, 16) * sg(); B = U(2, 5) * sg(); dx = ts.map(function (t) { return D * (t - 0.5) + B * Math.sin(Math.PI * t); }); }
    else if (kind === 'torn') {
      A = U(2, 5); ph = U(0, TP);
      var comps = [[7, 1], [13, 0.7], [23, 0.5], [41, 0.35]], phs = comps.map(function () { return U(0, TP); }), kk = U(0.8, 1.2);
      dx = ts.map(function (t) { var s = A * Math.sin(TP * t + ph); comps.forEach(function (c, j) { s += kk * c[1] * Math.sin(TP * c[0] * t / 2 + phs[j]); }); return s + U(-0.5, 0.5); });
      wd = U(1, 1.4);
    } else if (kind === 'steps') {
      L = 7 + Math.floor(r() * 5); lv = []; cur = 0;
      for (i = 0; i < L; i++) { cur += sg() * [3, 4, 5, 6][Math.floor(r() * 4)]; cur = clamp(cur, -12, 12); lv.push(cur); }
      m = lv.reduce(function (a, b) { return a + b; }, 0) / L;
      dx = ts.map(function (t) { return lv[Math.min(L - 1, Math.floor(t * L))] - m; });
      wd = U(1.1, 1.6);
    } else { A = U(4, 7); ph = U(0, TP); dx = ts.map(function (t) { return A * Math.sin(TP * t * 1.2 + ph); }); wd = U(2.6, 3.6); nd = 6 + Math.floor(r() * 4); rmax = 2.3; }
    var ink = [], M = 0;
    for (i = 0; i < nd; i++) { ink.push([U(0.04, 0.96), sg() * U(1.5, 6.5), U(0.5, rmax)]); }
    dx.forEach(function (v) { M = Math.max(M, Math.abs(v)); });
    return { dx: dx, w: wd, ink: ink, M: M + 4 };
  }

  var HOT = [];
  function Card(el) {
    var slug = el.getAttribute('data-s') || 'x', k = parseInt(el.getAttribute('data-k'), 10) || 0;
    var gA = curve(slug, k), gB = curve(slug + '~', k + 3), n = gA.dx.length, MX = Math.max(gA.M, gB.M);
    var imgB = el.querySelector('img.b'), svg = el.querySelector('.ink'), st = el.querySelector('.st'), cap = el.querySelector('.cap');
    var lp = el.getAttribute('data-lp') || '', ls = el.getAttribute('data-ls') || '';
    if (!imgB) { return; }
    var PI = Math.PI, LIM = PI / 3;                                     // кут шторки міняється в межах ±60° (120° загалом)
    var W = 1, H = 1, ang = 0, ang0 = 0, angT = 0, ux = 1, uy = 0, ext = 1, half = 0.5, S = 0.01, Fmin = 0, Fmax = 1;
    var qf = 0, sym = false, tgt = false, ambient = false, ambT = 0, active = false, commit = false, locked = false, inside = false, done = false, drag = false, mouse = true, moved = 0;
    var sx = 0, sy = 0, lx = 0, ly = 0, vx = 0, vy = 0, pv = 0, pt = 0, spd = 0, raf = 0, stT = 0, peeked = false, touched = false, phase = Math.random() * 6.28;
    var path = null, drops = [], i, corner = 'bl', cw = 0, ch = 0, flT = 0;
    if (svg) {
      path = document.createElementNS(NS, 'path'); svg.appendChild(path);
      for (i = 0; i < gA.ink.length; i++) { var c = document.createElementNS(NS, 'circle'); c.setAttribute('class', 'd'); svg.appendChild(c); drops.push(c); }
    }
    function wrap(a) { while (a > PI) { a -= 2 * PI; } while (a < -PI) { a += 2 * PI; } return a; }
    function axis() {
      ux = Math.cos(ang); uy = Math.sin(ang);
      ext = Math.abs(ux) * W + Math.abs(uy) * H; half = ext / 2; S = ext / 100;
      var pad = (MX + 4) * S; Fmin = -half - pad; Fmax = half + pad;
    }
    function size() {
      W = Math.max(1, el.clientWidth); H = Math.max(1, el.clientHeight);
      if (svg) { svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); }
      if (cap) { cw = cap.offsetWidth; ch = cap.offsetHeight; place(corner, true); }
      axis();
    }
    function begin(x, y, to) {
      ang = ang0 = angT = Math.atan2(y, x); axis(); active = true; tgt = to; pv = 0; pt = 0; qf = 0; locked = false; commit = false; done = false; spd = 0; vx = vy = 0;
      if (st) { st.textContent = tgt ? ls : lp; }
      el.classList.add('show'); go();
    }
    function finishState() {
      sym = tgt; active = false; done = true; ambient = false;
      el.setAttribute('aria-pressed', sym ? 'true' : 'false');
      if (st) { st.textContent = sym ? ls : lp; }
      clearTimeout(stT); stT = setTimeout(function () { if (!inside && !drag) { el.classList.remove('show'); } }, 1400);
    }
    function idleClip() { imgB.style.clipPath = sym ? 'none' : 'inset(0 0 0 100%)'; if (svg) { svg.style.display = 'none'; } }
    function draw(ts) {
      if (!active) { idleClip(); return; }
      var Fv = Fmin + pv * (Fmax - Fmin), m = 0.5 + 0.5 * Math.sin(pv * 6.9 + phase), Lh = (Math.abs(uy) * W + Math.abs(ux) * H) / 2 * 1.25;
      var vxx = -uy, vyy = ux, cx = W / 2, cy = H / 2, pts = [], line = [], t, j, d, b, a, X, Y;
      for (j = 0; j < n; j++) {
        t = j / (n - 1); b = (t * 2 - 1) * Lh;
        d = ((1 - m) * gA.dx[j] + m * gB.dx[j]) * S + (RM ? 0 : (0.4 + 1.6 * spd) * S * Math.sin(ts * 0.005 + j * 0.31 + phase));
        a = Fv + d; X = cx + ux * a + vxx * b; Y = cy + uy * a + vyy * b;
        pts.push([X, Y]); line.push(X.toFixed(1) + 'px ' + Y.toFixed(1) + 'px');
      }
      var BIG = Math.hypot(W, H) * 1.6, s0 = pts[0], s1 = pts[n - 1], far = tgt ? -1 : 1;
      var poly = line.concat([(s1[0] + ux * far * BIG).toFixed(1) + 'px ' + (s1[1] + uy * far * BIG).toFixed(1) + 'px', (s0[0] + ux * far * BIG).toFixed(1) + 'px ' + (s0[1] + uy * far * BIG).toFixed(1) + 'px']);
      imgB.style.clipPath = 'polygon(' + poly.join(',') + ')';
      if (path) {
        var vis = pv > 0.004 && pv < 0.996;
        svg.style.display = vis ? '' : 'none';
        if (vis) {
          var wpx = gA.w / 100 * ext * (0.8 + 0.5 * spd), Lp = [], Rp = [];
          for (j = 0; j < n; j++) {
            t = j / (n - 1); var hw = wpx * (0.45 + 0.55 * Math.sin(PI * t)) / 2;
            Lp.push((pts[j][0] - ux * hw).toFixed(1) + ' ' + (pts[j][1] - uy * hw).toFixed(1));
            Rp.push((pts[j][0] + ux * hw).toFixed(1) + ' ' + (pts[j][1] + uy * hw).toFixed(1));
          }
          path.setAttribute('d', 'M' + Lp.join('L') + 'L' + Rp.reverse().join('L') + 'Z');
          gA.ink.forEach(function (dd, q) {
            var idx = Math.round(dd[0] * (n - 1)), cc = drops[q];
            cc.setAttribute('cx', (pts[idx][0] + ux * dd[1] * S * (1 + spd)).toFixed(1)); cc.setAttribute('cy', (pts[idx][1] + uy * dd[1] * S * (1 + spd)).toFixed(1));
            cc.setAttribute('r', (dd[2] / 100 * ext * (0.8 + 0.6 * spd)).toFixed(1));
          });
        }
      }
    }
    function loop(ts) {
      raf = 0;
      var diff = pt - pv, span = Fmax - Fmin, step, da = wrap(angT - ang);
      if (RM) { pv = pt; ang = angT; spd = 0; }
      else {
        var rate = ambient ? 0.045 : 0.22, mn = (ambient ? 0.2 : 0.6) / span;
        step = diff * rate; if (Math.abs(step) < mn && diff !== 0) { step = Math.sign(diff) * Math.min(Math.abs(diff), mn); }
        pv += step; spd = Math.min(1, Math.abs(step) * span / (ext * 0.03)); ang += Math.max(-0.045, Math.min(0.045, da * 0.12));
      }
      axis(); draw(ts);
      if (active && pv >= 0.996 && pt >= 1) { pv = 1; finishState(); draw(ts); }
      else if (active && pv <= 0.004 && pt <= 0 && !inside && !drag) { pv = 0; active = false; ambient = false; draw(ts); }
      else if (active && !inside && !drag && !ambient && pt > 0.001 && pt < 0.999) { settle(); }          // запобіжник: шторка не лишається на півдорозі, коли курсора вже нема
      if (active && (Math.abs(pt - pv) > 0.001 || Math.abs(wrap(angT - ang)) > 0.003 || inside || drag)) { raf = requestAnimationFrame(loop); }
    }
    function go() { if (!raf) { raf = requestAnimationFrame(loop); } }
    function pos(e) { var r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function follow(p) {
      if (commit) { return; }                                              // після кліку лінія доїжджає до кінця прямо, курсор її більше не веде
      var q = ((p[0] - W / 2) * ux + (p[1] - H / 2) * uy + half) / ext, qm = q < 0.1 ? 0 : q > 0.9 ? 1 : (q - 0.1) / 0.8;
      qf += (qm - qf) * (qm > qf ? 0.55 : 0.2);                             // уперед ловимо швидко, назад повільно: хитання миші не смикає лінію
      if (qm >= 1 && qf > 0.97) { qf = 1; } if (qm <= 0 && qf < 0.03) { qf = 0; }
      pt = qf; go();
    }
    function steer(p) {
      if (commit) { return; }                                                    // кут шторки плавно йде за напрямком руху миші, у межах ±60° від початкового
      vx = vx * 0.7 + (p[0] - lx) * 0.3; vy = vy * 0.7 + (p[1] - ly) * 0.3;
      if (Math.hypot(vx, vy) > 1.6) {
        var dd = wrap(Math.atan2(vy, vx) - ang);
        if (Math.abs(dd) < PI / 2) { angT = ang + dd; }                     // рух назад (понад 90° від напрямку лінії) кут не крутить: лінія лише відкочується
      }
    }
    function settle() { if (commit) { return; } pt = pv > 0.5 ? 1 : 0; go(); }
    function flip(x, y) {
      touched = true;
      if (active) { commit = true; angT = ang; pt = 1; go(); return; }   // клік посеред зміни: дожати поточну лінію, без нової
      begin(x, y, !sym); locked = true; commit = true; pt = 1; go();
    }
    function ripple(e) {
      if (RM || !svg) { return; }
      var p = pos(e), c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'rip'); c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1)); c.setAttribute('r', '26');
      svg.style.display = ''; svg.appendChild(c); setTimeout(function () { if (c.parentNode) { c.parentNode.removeChild(c); } }, 800);
    }
    /* назва картки: прилипла до кута; тікає від курсора в інші кути, а коли тікати нікуди (кути зайняті лінією) - тьмяніє й телепортується */
    function rect(cn) { return [cn.indexOf('r') >= 0 ? W - cw : 0, cn.indexOf('t') >= 0 ? 0 : H - ch]; }
    function dist(cn, p) { var r = rect(cn), dx = Math.max(r[0] - p[0], 0, p[0] - (r[0] + cw)), dy = Math.max(r[1] - p[1], 0, p[1] - (r[1] + ch)); return Math.hypot(dx, dy); }
    function place(cn, now) {
      corner = cn; cap.setAttribute('data-c', cn);
      var r = rect(cn); cap.style.transition = now ? 'none' : '';
      cap.style.transform = 'translate(' + r[0].toFixed(1) + 'px,' + (r[1] - (H - ch)).toFixed(1) + 'px)';
      if (now) { void cap.offsetWidth; cap.style.transition = ''; }
    }
    function blocked(cn) {
      if (!active || pv < 0.02 || pv > 0.98) { return false; }
      var r = rect(cn), mx = r[0] + cw / 2, my = r[1] + ch / 2, Fv = Fmin + pv * (Fmax - Fmin);
      return Math.abs((mx - W / 2) * ux + (my - H / 2) * uy - Fv) < Math.max(cw, ch) * 0.75;
    }
    function flee(p) {
      if (!cap || !cw || flT) { return; }
      var R = 64;
      if (dist(corner, p) > R) { return; }
      var all = ['bl', 'br', 'tr', 'tl'], free = all.filter(function (c) { return c !== corner && dist(c, p) > R && !blocked(c); });
      if (free.length) {
        free.sort(function (a, b) { return dist(b, p) - dist(a, p); });
        place(free[0], false); return;
      }
      var any = all.filter(function (c) { return c !== corner; }).sort(function (a, b) { return dist(b, p) - dist(a, p); });
      cap.classList.add('vanish');                                         // тікати нікуди: тьмяніє й телепортується в найдальший кут
      flT = setTimeout(function () { place(any[0], true); cap.classList.remove('vanish'); flT = 0; }, 220);
    }
    size(); idleClip(); el.setAttribute('aria-pressed', 'false');
    if (window.ResizeObserver) { new ResizeObserver(function () { size(); draw(0); }).observe(el); }
    el.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' || drag || el.classList.contains('err')) { return; }
      var p = pos(e), dl = p[0], dr = W - p[0], dt = p[1], db = H - p[1], mn = Math.min(dl, dr, dt, db);
      inside = true; mouse = true; touched = true; ambient = false; clearTimeout(ambT); if (HOT.indexOf(el) < 0) { HOT.push(el); } sx = lx = p[0]; sy = ly = p[1];
      if (active && !done) { qf = pv; commit = false; ambient = false; clearTimeout(ambT); ang0 = ang; angT = ang; locked = true; follow(p); return; }
      begin(mn === dl ? 1 : mn === dr ? -1 : 0, mn === dt ? 1 : mn === db ? -1 : 0, !sym);
    });
    el._leave = function () {
      if (!inside) { return; }
      inside = false; if (active && !drag) { settle(); }
      done = false;
      var k = HOT.indexOf(el); if (k >= 0) { HOT.splice(k, 1); }
    };
    el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { el._leave(); } });
    el.addEventListener('pointerdown', function (e) {
      if ((e.pointerType === 'mouse' && e.button !== 0) || el.classList.contains('err')) { return; }
      ambient = false; clearTimeout(ambT);
      var p = pos(e); drag = true; moved = 0; sx = lx = p[0]; sy = ly = p[1]; mouse = e.pointerType === 'mouse'; touched = true; ripple(e);
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      if (!mouse) { begin(1, 0, !sym); }
    });
    el.addEventListener('pointermove', function (e) {
      var p = pos(e);
      if (e.pointerType === 'mouse') { flee(p); }
      if (drag) {
        moved = Math.max(moved, Math.hypot(p[0] - sx, p[1] - sy));
        if (!mouse && !locked && Math.abs(p[0] - sx) >= 8) { ang = ang0 = angT = p[0] - sx >= 0 ? 0 : PI; axis(); pv = 0; pt = 0; locked = true; }
        if (active) { if (mouse) { steer(p); } follow(p); }
        lx = p[0]; ly = p[1]; return;
      }
      if (e.pointerType === 'mouse' && inside && active && !done) {
        if (!locked && Math.hypot(p[0] - sx, p[1] - sy) >= 10) { ang0 = Math.atan2(p[1] - sy, p[0] - sx); angT = ang0; locked = true; }
        if (locked) { steer(p); follow(p); }
        lx = p[0]; ly = p[1];
      }
    });
    el.addEventListener('pointerup', function (e) {
      if (!drag) { return; }
      drag = false;
      var p = pos(e);
      if (moved < 5) { flip(p[0] < W / 2 ? 1 : -1, 0); }
      else if (active) { settle(); }
    });
    el.addEventListener('pointercancel', function () { drag = false; if (active) { settle(); } });
    el.addEventListener('keydown', function (e) {
      var h = true;
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { flip(1, 0); }
      else if (e.key === 'ArrowLeft') { flip(-1, 0); }
      else if (e.key === 'ArrowDown') { flip(0, 1); }
      else if (e.key === 'ArrowUp') { flip(0, -1); }
      else { h = false; }
      if (h) { e.preventDefault(); }
    });
    el._ambient = function () {                                            /* випадкова повільна «підказка»: шторка трохи виїжджає й повертається; іноді дожимає й міняє вигляд */
      if (RM || active || inside || drag) { return false; }
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], d = dirs[Math.floor(Math.random() * 4)], full = Math.random() < 0.12;
      begin(d[0], d[1], !sym); locked = true; ambient = true; pt = full ? 1 : 0.28 + Math.random() * 0.45; go();
      if (!full) { ambT = setTimeout(function () { if (ambient && !inside && !drag) { pt = 0; go(); } }, 1400 + Math.random() * 1600); }
      return true;
    };
  }

  function start() {
    var all = document.querySelectorAll('.split');
    if (!all.length) { return; }
    function hexc(s) { var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((s || '').trim()); if (!m) { return null; } var h = m[1]; if (h.length === 3) { h = h.replace(/./g, '$&$&'); } return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function theme() {                                                   /* картинки теж слухаються палітри й «світло ⇄ тінь»: чорне = туш, біле = папір */
      var cs = getComputedStyle(document.documentElement), ink = hexc(cs.getPropertyValue('--ink')), pap = hexc(cs.getPropertyValue('--paper')), f = document.querySelector('#ik-theme feColorMatrix');
      if (!ink || !pap || !f) { return; }
      var v = [], c;
      for (c = 0; c < 3; c++) { v.push((pap[c] - ink[c]).toFixed(4), 0, 0, 0, ink[c].toFixed(4)); }
      v.push(0, 0, 0, 1, 0); f.setAttribute('values', v.join(' '));
    }
    theme();
    if (window.MutationObserver) { new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette', 'data-flip', 'class', 'style'] }); }
    var leaveAll = function () { HOT.slice().forEach(function (c) { c._leave(); }); };
    document.addEventListener('pointermove', function (e) {
      if (!HOT.length) { return; }
      HOT.slice().forEach(function (c) { var r = c.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { c._leave(); } });
    }, { passive: true });
    document.addEventListener('mouseleave', leaveAll); window.addEventListener('blur', leaveAll);
    var hd = document.querySelector('header.top');
    if (hd) { document.documentElement.style.setProperty('--hdr', hd.offsetHeight + 'px'); }
    function watch(el) {                                                     /* скелетон, поки грузиться; гарна заглушка й одна повторна спроба, якщо картинка не прийшла */
      var imgs = el.querySelectorAll('img'), a = el.querySelector('img.a'), tries = 0;
      function again() { imgs.forEach(function (im) { var s = (im.getAttribute('src') || '').split('?')[0]; im.setAttribute('src', s + '?r=' + Date.now()); }); }
      function bad() {
        if (tries++ < 1) { setTimeout(again, 1800); return; }
        el.classList.add('err'); el.classList.add('ready');
      }
      imgs.forEach(function (im) {
        im.addEventListener('error', bad);
        im.addEventListener('load', function () { if (im === a) { el.classList.add('ready'); el.classList.remove('err'); } });
      });
      if (a && a.complete && a.naturalWidth > 0) { el.classList.add('ready'); }
      el.addEventListener('click', function () { if (el.classList.contains('err')) { tries = 0; el.classList.remove('err', 'ready'); again(); } });
    }
    for (var w0 = 0; w0 < all.length; w0++) { watch(all[w0]); }
    var ready = 'IntersectionObserver' in window;
    var init = new (ready ? IntersectionObserver : function () { this.observe = function (e) { Card(e); }; })(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { Card(e.target); init.unobserve(e.target); } });
    }, { rootMargin: '400px' });
    var vis = [];
    var seen = ready ? new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var k = vis.indexOf(e.target);
        if (e.isIntersecting && e.intersectionRatio >= 0.5) { if (k < 0) { vis.push(e.target); } } else if (k >= 0) { vis.splice(k, 1); }
      });
    }, { threshold: [0, 0.5] }) : null;
    for (var i = 0; i < all.length; i++) { init.observe(all[i]); if (seen) { seen.observe(all[i]); } }
    if (!RM && seen) {
      var tick = function () {
        var c = vis.filter(function (e) { return e._ambient; });
        if (!document.hidden && c.length) { c[Math.floor(Math.random() * c.length)]._ambient(); }
        setTimeout(tick, 1800 + Math.random() * 3800);
      };
      setTimeout(tick, 2600);
    }

    var hv = document.querySelectorAll('.gcard.promo, .gcta');     /* promo-hover: інверсія кольорів розходиться кругом від курсора */
    hv.forEach(function (h) {
      function mv(e) { var r = h.getBoundingClientRect(); h.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); h.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px'); }
      h.addEventListener('pointerenter', mv); h.addEventListener('pointermove', mv); h.addEventListener('pointerleave', mv);
    });
    var chips = document.querySelectorAll('.gchips a'), bar0 = document.querySelector('.gchips'), secs = [];
    chips.forEach(function (a) { var s = document.querySelector(a.getAttribute('href')); if (s) { secs.push([s, a]); } });
    function offset() { return (hd ? hd.offsetHeight : 52) + (bar0 ? bar0.offsetHeight : 0) + 10; }
    if (secs.length) {
      var cur = null, tick = false;
      var paint = function () {
        tick = false;
        var y = offset() + 4, pick = null, j;
        for (j = 0; j < secs.length; j++) { if (secs[j][0].getBoundingClientRect().top <= y) { pick = secs[j]; } }
        if (pick === cur) { return; }
        cur = pick;
        chips.forEach(function (a) { a.classList.remove('on'); });
        if (pick) {
          pick[1].classList.add('on');
          if (bar0) { bar0.scrollLeft = pick[1].offsetLeft - (bar0.clientWidth - pick[1].offsetWidth) / 2; }
        }
      };
      window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(paint); } }, { passive: true });
      paint();
      chips.forEach(function (a) {
        a.addEventListener('click', function (e) {
          var s = document.querySelector(a.getAttribute('href'));
          if (!s) { return; }
          e.preventDefault();
          window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - offset() + 2, behavior: 'instant' });
          if (history.replaceState) { history.replaceState(null, '', a.getAttribute('href')); }
        });
      });
    }
    var bar = document.querySelector('.gcta');
    if (bar) {
      var closed = false, x = bar.querySelector('.x');
      if (x) { x.addEventListener('click', function () { closed = true; bar.classList.remove('show'); setTimeout(function () { bar.hidden = true; }, 400); }); }
      window.addEventListener('scroll', function () {
        if (closed) { return; }
        if (window.scrollY > 900) { if (bar.hidden) { bar.hidden = false; requestAnimationFrame(function () { bar.classList.add('show'); }); } else { bar.classList.add('show'); } }
        else { bar.classList.remove('show'); }
      }, { passive: true });
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
})();
