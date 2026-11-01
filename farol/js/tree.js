/* ==========================================================================
   tree.js  ·  Cena 2: a árvore de corações
   - Todas as folhas são corações, em tons de vermelho, vinho e rosa.
   - As folhas balançam com uma brisa; pétalas em forma de coração caem sem parar.
   - A copa nunca esvazia: as pétalas são cópias que se soltam, as folhas ficam no lugar.
   API pública:  Tree.start()  Tree.stop()
   ========================================================================== */
const Tree = (function () {
  'use strict';

  const cv = document.getElementById('tree');
  const ctx = cv.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1, t = 0, last = 0, raf = 0, running = false;
  let leaves = [], petals = [], flies = [], flowers = [], blades = [], stars = [];
  let trunkLayer = null;                     // galhos e tronco, desenhados uma vez
  let ground = 0, canopy = { cx: 0, cy: 0 }; // linha do chão e centro da copa

  const SPRITE_SIZE = 72;                    // tamanho do sprite de coração (px)
  const HEART_W = 46;                        // largura aproximada do coração dentro do sprite
  const COLORS = ['#b3122e', '#8e0f27', '#d42a49', '#e85a78', '#f08aa0', '#6e0d22', '#c21f3f', '#ff9fb3', '#a01530'];
  const DARK = [1, 5, 8];                    // índices dos tons mais escuros (miolo da copa)
  const sprites = [];

  /* Gerador pseudoaleatório com semente: a árvore sai sempre igual */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let r = Math.imul(seed ^ seed >>> 15, 1 | seed);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- Sprites de coração ---------- */
  function heartPath(c, s) {
    c.beginPath();
    c.moveTo(0, s * 0.42);
    c.bezierCurveTo(-s * 0.95, -s * 0.12, -s * 0.5, -s * 0.78, 0, -s * 0.34);
    c.bezierCurveTo(s * 0.5, -s * 0.78, s * 0.95, -s * 0.12, 0, s * 0.42);
    c.closePath();
  }

  function shade(hex, k) {   // k > 0 clareia, k < 0 escurece
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function makeSprites() {
    sprites.length = 0;
    for (const col of COLORS) {
      const c = document.createElement('canvas'); c.width = c.height = SPRITE_SIZE;
      const x = c.getContext('2d');
      x.translate(SPRITE_SIZE / 2, SPRITE_SIZE / 2 + 1);
      heartPath(x, 38);
      const g = x.createRadialGradient(-8, -10, 2, 0, 0, 30);
      g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, -0.35));
      x.fillStyle = g; x.fill();
      x.lineWidth = 1; x.strokeStyle = 'rgba(40,0,10,.35)'; x.stroke();
      sprites.push(c);
    }
  }

  /* ---------- Construção da árvore ---------- */
  function build() {
    const rand = rng(11);
    const small = W < 600;
    const maxDepth = small ? 7 : 8;
    const segs = [], tips = [];

    // 1) galhos em coordenadas de unidade (tronco com comprimento 1, apontando para cima)
    (function grow(x, y, ang, len, w, d) {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      segs.push({ x1: x, y1: y, x2, y2, w, d });
      if (d >= maxDepth) { tips.push({ x: x2, y: y2 }); return; }
      const n = d < 2 ? 2 : (rand() < 0.38 ? 3 : 2);
      for (let i = 0; i < n; i++) {
        const spread = ((i - (n - 1) / 2) * (0.5 + rand() * 0.35) + (rand() - 0.5) * 0.3) * (small ? 0.68 : 1);
        grow(x2, y2, ang + spread, len * (0.74 + rand() * 0.08), w * 0.7, d + 1);
      }
    })(0, 0, -Math.PI / 2, 1, 0.34, 0);

    // 2) enquadra a árvore na tela
    let minX = 1e9, maxX = -1e9, minY = 1e9;
    for (const s of segs) { minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2); minY = Math.min(minY, s.y1, s.y2); }
    const bw = maxX - minX, bh = -minY;
    ground = H * 0.955;
    const targetW = W * (small ? 1.04 : 0.74), targetH = H * (small ? 0.76 : 0.8);
    const k = Math.min(targetW / bw, targetH / bh);
    const ox = W / 2 - ((minX + maxX) / 2) * k, oy = ground;
    const tx = (v) => ox + v * k, ty = (v) => oy + v * k;

    // 3) tronco e galhos em uma camada pronta
    trunkLayer = document.createElement('canvas');
    trunkLayer.width = Math.round(W * dpr); trunkLayer.height = Math.round(H * dpr);
    const tc = trunkLayer.getContext('2d'); tc.setTransform(dpr, 0, 0, dpr, 0, 0); tc.lineCap = 'round';
    for (const s of segs) {
      tc.strokeStyle = '#2a1118'; tc.lineWidth = Math.max(1.2, s.w * k);
      tc.beginPath(); tc.moveTo(tx(s.x1), ty(s.y1)); tc.lineTo(tx(s.x2), ty(s.y2)); tc.stroke();
      if (s.w * k > 4) {   // brilho dourado no contorno dos galhos grossos
        const dx = (s.y2 - s.y1), dy = -(s.x2 - s.x1), nl = Math.hypot(dx, dy) || 1, off = s.w * k * 0.22;
        tc.strokeStyle = 'rgba(240,198,117,.22)'; tc.lineWidth = Math.max(1, s.w * k * 0.16);
        tc.beginPath(); tc.moveTo(tx(s.x1) + dx / nl * off, ty(s.y1) + dy / nl * off); tc.lineTo(tx(s.x2) + dx / nl * off, ty(s.y2) + dy / nl * off); tc.stroke();
      }
    }
    // base do tronco
    tc.fillStyle = '#2a1118';
    tc.beginPath(); tc.ellipse(tx(0), ty(0), 0.4 * k, 0.07 * k, 0, 0, 6.283); tc.fill();

    // 4) folhas: sempre em quantidade suficiente para a copa ficar densa
    const tipPts = tips.map((p) => ({ x: tx(p.x), y: ty(p.y) }));
    const midPts = segs.filter((s) => s.d >= maxDepth - 3).map((s) => ({ x: tx((s.x1 + s.x2) / 2), y: ty((s.y1 + s.y2) / 2) }));
    const area = bw * k * bh * k * 0.5;
    const count = Math.min(small ? 760 : 1250, Math.round(area / (small ? 150 : 135)));
    const leafSz = Math.max(15, Math.min(34, Math.sqrt(area / count) * 1.75));
    const pool = tipPts.concat(midPts);
    let cx = 0, cy = 0;
    for (const p of pool) { cx += p.x; cy += p.y; }
    canopy = { cx: cx / pool.length, cy: cy / pool.length };

    leaves = [];
    for (let i = 0; i < count; i++) {
      const base = pool[(rand() * pool.length) | 0];
      const a = rand() * 6.283, r = Math.pow(rand(), 0.8) * leafSz * 2.4;
      const x = base.x + Math.cos(a) * r, y = base.y + Math.sin(a) * r * 0.85;
      const inner = Math.hypot(x - canopy.cx, (y - canopy.cy) * 1.2) < Math.max(bw * k, 1) * 0.2;   // miolo da copa
      const sprIdx = inner && rand() < 0.5 ? DARK[(rand() * DARK.length) | 0] : (rand() * sprites.length) | 0;
      leaves.push({ x, y, sz: leafSz * (0.72 + rand() * 0.55), rot: (rand() - 0.5) * 1.1, ph: rand() * 6.283, amp: 0.5 + rand() * 0.9, spr: sprites[sprIdx] });
    }
    leaves.sort((a, b) => a.y - b.y);

    // 5) pétalas (corações pequenos que caem)
    const pn = small ? 22 : 34;
    petals = Array.from({ length: pn }, () => newPetal(rand, true));

    // 6) vaga-lumes, estrelas, relva e flores
    flies = Array.from({ length: small ? 18 : 30 }, () => ({ x: Math.random() * W, y: H * (0.25 + Math.random() * 0.7), a: Math.random() * 6.283, v: 6 + Math.random() * 14, ph: Math.random() * 6.283 }));
    stars = Array.from({ length: small ? 70 : 120 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.7, r: Math.random() * 1.2 + 0.2, p: Math.random() * 6.283 }));
    blades = Array.from({ length: small ? 150 : 260 }, () => ({ x: Math.random() * W, h: 6 + Math.random() * 16, ph: Math.random() * 6.283 }));
    const fcols = ['#f6c8d4', '#ffe9ef', '#f08aa0', '#ffd9a0', '#ffffff'];
    flowers = Array.from({ length: small ? 12 : 18 }, () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      return {
        x: W / 2 + side * (W * 0.06 + Math.random() * W * (small ? 0.4 : 0.34)),
        y: ground + 2 + Math.random() * H * 0.025,
        h: H * (0.03 + Math.random() * 0.05), r: (small ? 5 : 6) + Math.random() * 4,
        col: fcols[(Math.random() * fcols.length) | 0], ph: Math.random() * 6.283
      };
    });
  }

  /* Cria uma pétala saindo de uma folha qualquer da copa */
  function newPetal(rand, initial) {
    const src = leaves.length ? leaves[(rand() * leaves.length) | 0] : { x: W / 2, y: H * 0.3 };
    const p = {
      x: src.x, y: initial ? src.y + rand() * (ground - src.y) : src.y,   // no início, espalhadas pela queda
      vy: 22 + rand() * 28, sw: 8 + rand() * 16, ph: rand() * 6.283,
      rot: rand() * 6.283, vr: (rand() - 0.5) * 1.6, sz: 8 + rand() * 7,
      spr: sprites[(rand() * sprites.length) | 0], born: 0
    };
    return p;
  }

  /* ---------- Desenho ---------- */
  function drawBackground() {
    for (const s of stars) {
      ctx.globalAlpha = (.3 + .6 * Math.abs(Math.sin(t * .5 + s.p))) * .75;
      ctx.fillStyle = '#fff4f0'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // iluminação dourada atrás da copa
    const R = Math.max(W, H) * 0.62;
    const g = ctx.createRadialGradient(canopy.cx, canopy.cy, 0, canopy.cx, canopy.cy, R);
    g.addColorStop(0, 'rgba(240,190,100,.26)'); g.addColorStop(.45, 'rgba(150,40,70,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawGround() {
    const g = ctx.createLinearGradient(0, ground - 14, 0, H);
    g.addColorStop(0, 'rgba(14,20,16,.0)'); g.addColorStop(.25, '#0a100d'); g.addColorStop(1, '#04060a');
    ctx.fillStyle = g; ctx.fillRect(0, ground - 14, W, H - ground + 14);
    ctx.strokeStyle = '#16301f'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (const b of blades) {
      const sw = Math.sin(t * 1.3 + b.ph) * 2.5 * wind();
      ctx.moveTo(b.x, ground + 6); ctx.quadraticCurveTo(b.x + sw * 0.4, ground + 6 - b.h * 0.6, b.x + sw, ground + 6 - b.h);
    }
    ctx.stroke();
  }

  function wind() { return reduce ? 0.3 : 0.65 + 0.35 * Math.sin(t * 0.35); }   // rajadas suaves

  function drawFlowers() {
    for (const f of flowers) {
      const sw = Math.sin(t * 1.1 + f.ph) * 3 * wind();
      const hx = f.x + sw, hy = f.y - f.h;
      ctx.strokeStyle = '#1d3b2d'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x + sw * 0.3, f.y - f.h * 0.5, hx, hy); ctx.stroke();
      ctx.fillStyle = f.col;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.2566 + sw * 0.05;
        ctx.beginPath(); ctx.ellipse(hx + Math.cos(a) * f.r * 0.8, hy + Math.sin(a) * f.r * 0.8, f.r * 0.62, f.r * 0.4, a, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = '#f0c675'; ctx.beginPath(); ctx.arc(hx, hy, f.r * 0.32, 0, 6.283); ctx.fill();
    }
  }

  function drawLeaves() {
    const w = wind(), K = 1 / HEART_W;
    for (const l of leaves) {
      const sw = Math.sin(t * 1.1 + l.ph + l.x * 0.006) * l.amp * w;
      const a = l.rot + sw * 0.07, s = l.sz * K * dpr;
      const c = Math.cos(a) * s, n = Math.sin(a) * s;
      ctx.setTransform(c, n, -n, c, (l.x + sw * 2.4) * dpr, (l.y + Math.cos(t * 0.9 + l.ph) * 1.3 * w) * dpr);
      ctx.drawImage(l.spr, -SPRITE_SIZE / 2, -SPRITE_SIZE / 2);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawPetals(dt) {
    const w = wind(), K = 1 / HEART_W;
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.born += dt;
      p.y += p.vy * dt * (0.8 + 0.4 * w);
      p.x += (Math.sin(t * 0.9 + p.ph) * p.sw + 10 * w) * dt;
      p.rot += p.vr * dt;
      if (p.y > ground - 4) { petals[i] = newPetal(Math.random, false); petals[i].y = Math.min(petals[i].y, ground * 0.9); continue; }
      const fadeIn = Math.min(1, p.born / 0.8), fadeOut = Math.min(1, (ground - p.y) / 70);
      ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut)) * 0.95;
      const s = p.sz * K * dpr, c = Math.cos(p.rot) * s, n = Math.sin(p.rot) * s;
      ctx.setTransform(c, n, -n, c, p.x * dpr, p.y * dpr);
      ctx.drawImage(p.spr, -SPRITE_SIZE / 2, -SPRITE_SIZE / 2);
    }
    ctx.globalAlpha = 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawFlies(dt) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of flies) {
      f.a += (Math.random() - 0.5) * 0.25; f.x += Math.cos(f.a) * f.v * dt; f.y += Math.sin(f.a) * f.v * dt;
      if (f.x < -10) f.x = W + 10; if (f.x > W + 10) f.x = -10; if (f.y < H * 0.15) f.y = H * 0.15; if (f.y > ground) f.y = ground;
      const al = 0.25 + 0.75 * Math.pow(Math.sin(t * 1.3 + f.ph), 2);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 8);
      g.addColorStop(0, `rgba(255,226,150,${al})`); g.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - 8, f.y - 8, 16, 16);
    }
    ctx.restore();
  }

  /* ---------- Laço de animação ---------- */
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    t += dt * (reduce ? 0.3 : 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawGround();
    ctx.drawImage(trunkLayer, 0, 0, W, H);
    drawLeaves();
    drawFlowers();
    if (!reduce) drawPetals(dt);
    drawFlies(dt);
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    build();
  }

  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  makeSprites();
  resize();

  return { start, stop };
})();
