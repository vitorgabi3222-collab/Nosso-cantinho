/* ==========================================================================
   sea.js  ·  Cena 1: o farol no mar turbulento
   Tudo é desenhado em canvas: céu, nuvens, ondas, rochas, farol e feixe de luz.
   API pública:  Sea.start()  Sea.stop()  Sea.lightUp()
   ========================================================================== */
const Sea = (function () {
  'use strict';

  const cv = document.getElementById('sea');
  const ctx = cv.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1;
  let t = 0, dt = 0, last = 0, raf = 0, running = false;
  let glow = 1, glowTarget = 1;      // intensidade da luz do farol
  let flashA = 0, nextBolt = 5, flicker = 0;   // relâmpagos
  let clouds = [], stars = [], rain = [], spray = [], rockPts = [];
  const L = {};                      // geometria do farol

  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---------- Geometria e objetos (refeitos ao redimensionar) ---------- */
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wide = W > 760;
    L.horizon = H * 0.55;
    L.x = W * (wide ? 0.78 : 0.76);
    L.baseY = H * (wide ? 0.80 : 0.77);
    L.h = Math.min(H * 0.38, wide ? 360 : 250);       // altura da torre
    L.wb = L.h * 0.20;                                  // largura da base
    L.wt = L.h * 0.125;                                 // largura do topo
    L.roomH = L.h * 0.13;                               // altura da sala da lanterna
    L.lanY = L.baseY - L.h - 3 - L.roomH / 2;           // centro da luz

    clouds = Array.from({ length: wide ? 11 : 8 }, () => ({
      x: rand(-0.2, 1.2) * W, y: rand(0.02, 0.36) * H,
      s: W * rand(0.22, 0.42) * (wide ? 1 : 1.35),
      v: rand(5, 14), a: rand(0.6, 0.95),
      blobs: Array.from({ length: 5 }, () => ({ dx: rand(-0.5, 0.5), dy: rand(-0.12, 0.12), r: rand(0.45, 0.8) }))
    }));
    stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * L.horizon * 0.8, r: rand(0.2, 1.3), p: rand(0, 6.28) }));
    rain = Array.from({ length: wide ? 90 : 55 }, () => ({ x: Math.random() * W, y: Math.random() * H, l: rand(10, 24), v: rand(620, 1000) }));

    // Contorno das rochas sob o farol: [deslocamento em larguras de base, altura relativa]
    const x = L.x, y = L.baseY, wb = L.wb;
    rockPts = [
      [-4.6, 'b'], [-4.0, .9], [-3.1, .55], [-2.4, .15], [-1.7, .30], [-1.1, -.15], [-.6, -.30],
      [.7, -.28], [1.2, 0], [1.9, .12], [2.6, .5], [3.2, .62], [4.0, 1.0], [4.7, 'b']
    ].map(([ax, ay]) => [x + ax * wb, ay === 'b' ? H + 10 : y + ay * wb]);
  }

  /* ---------- Céu e nuvens ---------- */
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, L.horizon);
    g.addColorStop(0, '#03050b'); g.addColorStop(.55, '#0a1630'); g.addColorStop(.86, '#2a1228'); g.addColorStop(1, '#4e1b31');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, L.horizon + 2);
    for (const s of stars) {
      ctx.globalAlpha = (.25 + .5 * Math.abs(Math.sin(t * .6 + s.p))) * .7;
      ctx.fillStyle = '#fff4f0'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds() {
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x - c.s > W) c.x = -c.s;
      for (const b of c.blobs) {
        const bx = c.x + b.dx * c.s, by = c.y + b.dy * c.s, r = c.s * b.r * 0.55;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        g.addColorStop(0, `rgba(7,10,20,${c.a})`);
        g.addColorStop(.6, `rgba(14,18,36,${c.a * .55})`);
        g.addColorStop(1, 'rgba(14,18,36,0)');
        ctx.fillStyle = g; ctx.fillRect(bx - r, by - r, r * 2, r * 2);
      }
    }
  }

  /* ---------- Mar: camadas de ondas ---------- */
  function waveY(x, f, base, amp) {
    const k = 0.011 - f * 0.006;
    const s1 = Math.sin(x * k + t * (0.8 + f * 0.9) + f * 5.1);
    const s2 = Math.sin(x * k * 2.3 - t * (1.2 + f) + f * 2.7);
    const s3 = Math.sin(x * k * 0.55 + t * 0.6 + f * 9);
    const crest = Math.pow(Math.max(0, s1), 3);       // cristas pontudas = mar agitado
    return base + amp * (0.55 * s1 + 0.3 * s2 + 0.4 * s3 - 0.75 * crest);
  }

  function drawSea() {
    const n = 9, sc = H / 900, step = 6;
    const cols = Math.ceil((W + 20) / step) + 1;
    const ys = new Float32Array(cols);
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const base = L.horizon + (H - L.horizon) * (0.015 + f * f * 0.86 + f * 0.1);
      const amp = (4 + f * f * 64) * sc;
      for (let j = 0; j < cols; j++) ys[j] = waveY(-10 + j * step, f, base, amp);

      // preenchimento
      ctx.beginPath(); ctx.moveTo(-10, ys[0]);
      for (let j = 1; j < cols; j++) ctx.lineTo(-10 + j * step, ys[j]);
      ctx.lineTo(W + 12, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath();
      const g = ctx.createLinearGradient(0, base - amp, 0, base + amp * 4 + 30);
      g.addColorStop(0, `rgb(${lerp(20, 12, f) | 0},${lerp(48, 26, f) | 0},${lerp(92, 50, f) | 0})`);
      g.addColorStop(1, '#03060d');
      ctx.fillStyle = g; ctx.fill();

      // espuma na crista
      ctx.strokeStyle = `rgba(205,222,255,${.06 + f * .2})`; ctx.lineWidth = 1 + f * 2.2;
      ctx.beginPath(); ctx.moveTo(-10, ys[0]);
      for (let j = 1; j < cols; j++) ctx.lineTo(-10 + j * step, ys[j]);
      ctx.stroke();

      if (f > 0.4) {   // espuma branca nos topos das ondas mais próximas
        ctx.fillStyle = `rgba(235,245,255,${.18 + f * .25})`;
        for (let j = 1; j < cols - 1; j++) {
          if (ys[j] < ys[j - 1] && ys[j] < ys[j + 1] && base - ys[j] > amp * 0.55) {
            ctx.beginPath(); ctx.ellipse(-10 + j * step, ys[j] + 1, 5 + f * 11, 1.2 + f * 2.2, 0, 0, 6.283); ctx.fill();
          }
        }
      }
    }
  }

  /* ---------- Feixe de luz do farol ---------- */
  function cone(angle, len, half, a) {
    const lx = L.x, ly = L.lanY;
    const ex = lx + Math.cos(angle) * len, ey = ly + Math.sin(angle) * len;
    const g = ctx.createLinearGradient(lx, ly, ex, ey);
    g.addColorStop(0, `rgba(255,228,160,${.9 * a})`);
    g.addColorStop(.25, `rgba(255,208,125,${.34 * a})`);
    g.addColorStop(1, 'rgba(255,190,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(lx, ly);
    ctx.lineTo(lx + Math.cos(angle + half) * len, ly + Math.sin(angle + half) * len);
    ctx.lineTo(lx + Math.cos(angle - half) * len, ly + Math.sin(angle - half) * len);
    ctx.closePath(); ctx.fill();
  }

  function drawBeam() {
    const len = Math.max(W, H) * 1.35;
    const sweep = Math.sin(t * 0.28) * 0.78;              // varre lentamente, procurando alguém
    const a = Math.min(1, 0.5 * glow);
    const spread = 0.075 * (1 + 0.35 * Math.min(glow, 3));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    cone(Math.PI + sweep, len, spread, a);                 // feixe principal (para a esquerda)
    cone(Math.PI + sweep, len, spread * 0.38, a * 0.8);    // núcleo mais brilhante
    cone(sweep, len * 0.7, spread, a * 0.4);               // feixe oposto, mais fraco
    const r = L.h * (0.5 + 0.18 * Math.min(glow, 3));      // halo da lanterna
    const g = ctx.createRadialGradient(L.x, L.lanY, 0, L.x, L.lanY, r);
    g.addColorStop(0, `rgba(255,236,180,${Math.min(1, .7 * glow)})`);
    g.addColorStop(.35, `rgba(240,190,100,${.28 * Math.min(glow, 2.5)})`);
    g.addColorStop(1, 'rgba(240,190,100,0)');
    ctx.fillStyle = g; ctx.fillRect(L.x - r, L.lanY - r, r * 2, r * 2);
    ctx.restore();
  }

  /* ---------- Rochas, farol e espuma ---------- */
  function drawRocks() {
    ctx.beginPath(); ctx.moveTo(rockPts[0][0], rockPts[0][1]);
    for (let i = 1; i < rockPts.length; i++) ctx.lineTo(rockPts[i][0], rockPts[i][1]);
    ctx.closePath(); ctx.fillStyle = '#04060b'; ctx.fill();
    ctx.strokeStyle = 'rgba(240,198,117,.14)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(rockPts[1][0], rockPts[1][1]);
    for (let i = 2; i < rockPts.length - 1; i++) ctx.lineTo(rockPts[i][0], rockPts[i][1]);
    ctx.stroke();
  }

  function drawLighthouse() {
    const x = L.x, by = L.baseY, h = L.h, wb = L.wb, wt = L.wt;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x - wb / 2, by); ctx.lineTo(x + wb / 2, by); ctx.lineTo(x + wt / 2, by - h); ctx.lineTo(x - wt / 2, by - h); ctx.closePath();
    ctx.clip();
    const bands = 6;                                       // faixas vinho e creme
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? '#a89a8e' : '#5f1426';
      const y0 = by - h * (i + 1) / bands, y1 = by - h * i / bands;
      ctx.fillRect(x - wb, y0, wb * 2, y1 - y0 + 1);
    }
    const g = ctx.createLinearGradient(x - wb / 2, 0, x + wb / 2, 0);   // sombra lateral
    g.addColorStop(0, 'rgba(2,4,10,.78)'); g.addColorStop(.45, 'rgba(2,4,10,.38)'); g.addColorStop(1, 'rgba(2,4,10,.85)');
    ctx.fillStyle = g; ctx.fillRect(x - wb, by - h, wb * 2, h);
    const lg = ctx.createLinearGradient(0, by - h, 0, by);               // luz quente vinda da lanterna
    lg.addColorStop(0, `rgba(240,198,117,${.35 * Math.min(glow, 2) / 2})`); lg.addColorStop(.5, 'rgba(240,198,117,0)');
    ctx.fillStyle = lg; ctx.fillRect(x - wb, by - h, wb * 2, h);
    ctx.restore();

    ctx.fillStyle = '#07090f'; ctx.fillRect(x - wt * 0.95, by - h - 3, wt * 1.9, 5);       // galeria
    ctx.strokeStyle = 'rgba(7,9,15,.9)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {                                                            // grade
      const gx = x - wt * 0.9 + i * (wt * 1.8 / 8);
      ctx.beginPath(); ctx.moveTo(gx, by - h - 3); ctx.lineTo(gx, by - h - 3 - h * 0.03); ctx.stroke();
    }
    const rw = wt * 0.82, rh = L.roomH, ry = by - h - 3 - rh;                                // sala da lanterna
    const lgrd = ctx.createRadialGradient(x, ry + rh / 2, 0, x, ry + rh / 2, rw);
    lgrd.addColorStop(0, '#fff6d6'); lgrd.addColorStop(.6, '#f6cf7e'); lgrd.addColorStop(1, '#c8913c');
    ctx.globalAlpha = Math.min(1, .72 + .14 * glow); ctx.fillStyle = lgrd; ctx.fillRect(x - rw / 2, ry, rw, rh); ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a0c14';
    ctx.fillRect(x - rw / 2 - 1, ry, 2, rh); ctx.fillRect(x + rw / 2 - 1, ry, 2, rh); ctx.fillRect(x - 1, ry, 2, rh);
    ctx.beginPath(); ctx.moveTo(x - rw / 2 - 3, ry); ctx.quadraticCurveTo(x, ry - h * 0.13, x + rw / 2 + 3, ry); ctx.closePath();   // cúpula
    ctx.fillStyle = '#4a1020'; ctx.fill();
    ctx.fillRect(x - 1, ry - h * 0.13 - h * 0.035, 2, h * 0.035);
  }

  function updateSpray() {
    const rate = reduce ? 0 : 16 * (glow > 1.5 ? 2 : 1);
    if (Math.random() < rate * dt) {
      const side = Math.random() < 0.5 ? -1 : 1;
      spray.push({ x: L.x + side * L.wb * rand(1.5, 2.8), y: L.baseY + L.wb * rand(0.2, 0.7), vx: side * rand(10, 70), vy: rand(-170, -70), life: rand(0.9, 1.6), age: 0, r: rand(1, 2.7) });
    }
    ctx.fillStyle = '#e9f2ff';
    for (let i = spray.length - 1; i >= 0; i--) {
      const p = spray[i]; p.age += dt;
      if (p.age > p.life) { spray.splice(i, 1); continue; }
      p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = (1 - p.age / p.life) * 0.7;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Chuva e relâmpagos ---------- */
  function drawRain() {
    if (reduce) return;
    ctx.strokeStyle = 'rgba(180,200,235,.16)'; ctx.lineWidth = 1; ctx.beginPath();
    for (const r of rain) {
      r.y += r.v * dt; r.x -= r.v * 0.16 * dt;
      if (r.y > H) { r.y = -r.l; r.x = Math.random() * (W + 120); }
      ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.l * 0.16, r.y + r.l);
    }
    ctx.stroke();
  }

  function drawLightning() {
    if (!reduce && t > nextBolt) { flashA = 0.5; flicker = 2; nextBolt = t + rand(6, 12); }
    if (flashA > 0.01) {
      ctx.fillStyle = `rgba(185,205,255,${flashA * 0.34})`; ctx.fillRect(0, 0, W, H);
      flashA *= Math.pow(0.0006, dt);
      if (flashA < 0.12 && flicker > 0) { flashA = 0.38; flicker--; }
    }
  }

  /* ---------- Laço de animação ---------- */
  function draw() {
    glow += (glowTarget - glow) * Math.min(1, dt * 2.2);
    drawSky();
    drawClouds();
    drawSea();
    drawBeam();
    drawRocks();
    drawLighthouse();
    updateSpray();
    drawRain();
    drawLightning();
  }

  function frame(ts) {
    if (!running) return;
    dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    t += dt * (reduce ? 0.3 : 1);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  /* Ao acender: a luz fica muito mais forte e a água se agita ao redor das rochas */
  function lightUp() {
    glowTarget = 3.2;
    flashA = 0.55;
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1;
      spray.push({ x: L.x + side * L.wb * rand(1.4, 3), y: L.baseY + L.wb * rand(0.1, 0.8), vx: side * rand(20, 120), vy: rand(-240, -90), life: rand(1, 1.8), age: 0, r: rand(1, 3) });
    }
  }

  window.addEventListener('resize', layout);
  layout();
  start();

  return { start, stop, lightUp };
})();
