/* Landing animation: a glowing neural network; signals fire out of the B1ble logo and travel along the neurons. */
export function startNeural(canvas, logoEl) {
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, nodes = [], edges = [], adj = [], roots = [], pulses = [], raf = 0, last = 0, spawnT = 0, logo = null;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  function build() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = logoEl.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    logo = { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2, w: r.width * 0.86, h: r.height * 0.5 };
    seed = 7; nodes = [];
    // roots: points on the logo's outline, where the neurons begin
    const R = 9;
    for (let i = 0; i < R; i++) {
      const t = i / (R - 1);
      nodes.push({ x: logo.x - logo.w / 2 + t * logo.w, y: logo.y - logo.h / 2 - 2, root: true });
      nodes.push({ x: logo.x - logo.w / 2 + t * logo.w, y: logo.y + logo.h / 2 + 2, root: true });
    }
    nodes.push({ x: logo.x - logo.w / 2 - 6, y: logo.y, root: true }, { x: logo.x + logo.w / 2 + 6, y: logo.y, root: true });
    roots = nodes.map((_, i) => i);
    // the rest: a jittered grid, denser near the logo, kept clear of the logo itself
    const step = Math.max(46, Math.min(W, H) / 7.5);
    for (let y = -step / 2; y < H + step; y += step * 0.86) for (let x = -step / 2; x < W + step; x += step) {
      const px = x + (rnd() - 0.5) * step * 0.9, py = y + (rnd() - 0.5) * step * 0.9;
      if (Math.abs(px - logo.x) < logo.w / 2 + 14 && Math.abs(py - logo.y) < logo.h / 2 + 18) continue;
      nodes.push({ x: px, y: py, s: 0.6 + rnd() * 1.6 });
    }
    // edges: each node to its 3 nearest neighbours, gently curved
    const key = new Set(); edges = []; adj = nodes.map(() => []);
    nodes.forEach((a, i) => {
      const near = nodes.map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2]).filter(([j]) => j !== i && !(a.root && nodes[j].root)).sort((p, q) => p[1] - q[1]).slice(0, a.root ? 2 : 3);
      near.forEach(([j]) => {
        const k = i < j ? i + ":" + j : j + ":" + i; if (key.has(k)) return; key.add(k);
        const b = nodes[j], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -(b.y - a.y), ny = b.x - a.x, bend = (rnd() - 0.5) * 0.35;
        const e = { a: i, b: j, cx: mx + nx * bend, cy: my + ny * bend, glow: 0 };
        edges.push(e); adj[i].push(edges.length - 1); adj[j].push(edges.length - 1);
      });
    });
    nodes.forEach((n) => { n.d = Math.hypot(n.x - logo.x, (n.y - logo.y) * 1.4); n.flash = 0; });
  }
  const at = (e, from, t) => { const A = nodes[from], B = nodes[from === e.a ? e.b : e.a], u = 1 - t; return [u * u * A.x + 2 * u * t * e.cx + t * t * B.x, u * u * A.y + 2 * u * t * e.cy + t * t * B.y]; };
  function nextEdge(nodeI, prevE) {
    const out = adj[nodeI].filter((ei) => ei !== prevE).filter((ei) => { const e = edges[ei], o = e.a === nodeI ? e.b : e.a; return nodes[o].d > nodes[nodeI].d - 6 && !nodes[o].root; });
    return out.length ? out[Math.floor(Math.random() * out.length)] : -1;
  }
  function spawn() {
    const r = roots[Math.floor(Math.random() * roots.length)], ei = nextEdge(r, -1);
    if (ei >= 0) pulses.push({ e: ei, from: r, t: 0, hops: 4 + Math.floor(Math.random() * 6), v: 0.9 + Math.random() * 0.8 });
  }
  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    // edges
    for (const e of edges) {
      const A = nodes[e.a], B = nodes[e.b];
      const base = 0.13 + 0.12 * Math.max(0, 1 - Math.min(A.d, B.d) / (Math.max(W, H) * 0.7));
      e.glow = Math.max(0, e.glow - dt * 0.55);
      ctx.strokeStyle = `rgba(56,152,255,${base + e.glow * 0.6})`; ctx.lineWidth = 0.8 + e.glow * 1.6;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(e.cx, e.cy, B.x, B.y); ctx.stroke();
    }
    // nodes
    for (const n of nodes) {
      if (n.root) continue;
      n.flash = Math.max(0, n.flash - dt * 1.6);
      const r = n.s * (1.4 + n.flash * 2.2);
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 5);
      g.addColorStop(0, `rgba(190,235,255,${0.55 + n.flash * 0.45})`); g.addColorStop(0.25, `rgba(40,150,255,${0.35 + n.flash * 0.5})`); g.addColorStop(1, "rgba(20,110,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, r * 5, 0, 7); ctx.fill();
    }
    // signals
    ctx.globalCompositeOperation = "lighter";
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i], e = edges[p.e];
      const len = Math.hypot(nodes[e.a].x - nodes[e.b].x, nodes[e.a].y - nodes[e.b].y) || 1;
      p.t += dt * p.v * 140 / len;
      e.glow = Math.min(1, e.glow + dt * 3);
      for (let k = 0; k < 7; k++) { // bright head with a short tail
        const tt = p.t - k * 0.035; if (tt < 0) break;
        const [x, y] = at(e, p.from, Math.min(1, tt)), a = 1 - k / 7;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9 * a + 2);
        g.addColorStop(0, `rgba(235,250,255,${0.95 * a})`); g.addColorStop(0.35, `rgba(80,190,255,${0.6 * a})`); g.addColorStop(1, "rgba(30,120,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9 * a + 2, 0, 7); ctx.fill();
      }
      if (p.t >= 1) {
        const to = e.a === p.from ? e.b : e.a; nodes[to].flash = 1;
        const ne = p.hops > 0 ? nextEdge(to, p.e) : -1;
        if (ne < 0) { pulses.splice(i, 1); continue; }
        if (Math.random() < 0.22 && pulses.length < 40) { const be = nextEdge(to, ne); if (be >= 0) pulses.push({ e: be, from: to, t: 0, hops: p.hops - 2, v: p.v }); }
        p.e = ne; p.from = to; p.t = 0; p.hops--;
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }
  function frame(ts) {
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    spawnT -= dt; if (spawnT <= 0 && pulses.length < 34) { spawn(); spawnT = 0.12 + Math.random() * 0.22; }
    draw(dt); raf = requestAnimationFrame(frame);
  }
  const onResize = () => { build(); if (reduce) draw(0); };
  build();
  if (reduce) draw(0); else { for (let i = 0; i < 6; i++) spawn(); raf = requestAnimationFrame(frame); }
  addEventListener("resize", onResize);
  return () => { cancelAnimationFrame(raf); removeEventListener("resize", onResize); };
}
