// Procedural Wargames-ish SVG screen.
// No dependencies.

const svg = document.getElementById("v");
const gGrid = document.getElementById("gGrid");
const gWorld = document.getElementById("gWorld");
const gNet = document.getElementById("gNet");
const gHUD = document.getElementById("gHUD");

const regenBtn = document.getElementById("regen");
const pauseBtn = document.getElementById("pause");
const densityEl = document.getElementById("density");
const flickerEl = document.getElementById("flicker");
const seedEl = document.getElementById("seed");
const seedLabel = document.getElementById("seedLabel");
const clockEl = document.getElementById("clock");
const scanSweep = document.getElementById("scanSweep");
const noise = document.getElementById("noise");

let paused = false;
let sweepX = -300;

// ---------- RNG (seeded) ----------
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= (h >>> 16);
    return h >>> 0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makeRng(seedStr){
  const seedFn = xmur3(seedStr);
  return sfc32(seedFn(), seedFn(), seedFn(), seedFn());
}

function pick(rng, arr){ return arr[Math.floor(rng() * arr.length)]; }
function rrange(rng, a, b){ return a + (b - a) * rng(); }
function irange(rng, a, b){ return Math.floor(rrange(rng, a, b + 1)); }

// ---------- SVG helpers ----------
function clearNode(node){
  while (node.firstChild) node.removeChild(node.firstChild);
}
function el(name, attrs = {}){
  const n = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

// ---------- Procedural layers ----------
function drawGrid(rng, density){
  clearNode(gGrid);

  const major = 100;
  const minor = 20;

  // Minor grid
  for (let x = 0; x <= 1000; x += minor){
    gGrid.appendChild(el("line", {
      x1:x, y1:0, x2:x, y2:700,
      stroke:"rgba(0,255,120,0.08)",
      "stroke-width":1
    }));
  }
  for (let y = 0; y <= 700; y += minor){
    gGrid.appendChild(el("line", {
      x1:0, y1:y, x2:1000, y2:y,
      stroke:"rgba(0,255,120,0.08)",
      "stroke-width":1
    }));
  }

  // Major grid
  for (let x = 0; x <= 1000; x += major){
    gGrid.appendChild(el("line", {
      x1:x, y1:0, x2:x, y2:700,
      stroke:"rgba(0,255,120,0.16)",
      "stroke-width":1.2
    }));
  }
  for (let y = 0; y <= 700; y += major){
    gGrid.appendChild(el("line", {
      x1:0, y1:y, x2:1000, y2:y,
      stroke:"rgba(0,255,120,0.16)",
      "stroke-width":1.2
    }));
  }

  // Random crosshair markers
  const n = Math.floor(10 * density);
  for (let i = 0; i < n; i++){
    const cx = irange(rng, 80, 920);
    const cy = irange(rng, 80, 620);
    const s = rrange(rng, 10, 28);

    gGrid.appendChild(el("line", { x1:cx - s, y1:cy, x2:cx + s, y2:cy, stroke:"rgba(0,255,120,0.22)", "stroke-width":1 }));
    gGrid.appendChild(el("line", { x1:cx, y1:cy - s, x2:cx, y2:cy + s, stroke:"rgba(0,255,120,0.22)", "stroke-width":1 }));
    gGrid.appendChild(el("circle", { cx, cy, r: rrange(rng, 12, 24), fill:"none", stroke:"rgba(0,255,120,0.14)", "stroke-width":1 }));
  }
}

function drawWorld(rng, density){
  clearNode(gWorld);

  // Faux "map": arcs + coast-like polyline blobs
  const blobs = Math.floor(3 * density);
  for (let b = 0; b < blobs; b++){
    const pts = [];
    const cx = rrange(rng, 260, 740);
    const cy = rrange(rng, 200, 500);
    const rad = rrange(rng, 90, 180);
    const k = irange(rng, 10, 18);

    for (let i = 0; i < k; i++){
      const a = (i / k) * Math.PI * 2;
      const jitter = rrange(rng, -0.25, 0.25);
      const rr = rad * (0.75 + 0.35 * rng());
      const x = cx + Math.cos(a + jitter) * rr;
      const y = cy + Math.sin(a - jitter) * rr * 0.72;
      pts.push([x,y]);
    }
    pts.push(pts[0]);

    const d = pts.map((p,i) => `${i===0 ? "M":"L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + " Z";
    gWorld.appendChild(el("path", {
      d,
      fill:"none",
      stroke:"rgba(0,255,120,0.26)",
      "stroke-width":1.2
    }));
  }

  // Radar rings
  const ringCount = Math.floor(3 + 2 * density);
  for (let i = 0; i < ringCount; i++){
    const cx = rrange(rng, 280, 720);
    const cy = rrange(rng, 180, 520);
    const r = rrange(rng, 70, 260);
    gWorld.appendChild(el("ellipse", {
      cx, cy,
      rx:r, ry:r * 0.62,
      fill:"none",
      stroke:"rgba(0,255,120,0.12)",
      "stroke-width":1
    }));
  }

  // Sweep wedges
  const sweeps = Math.floor(2 * density);
  for (let i = 0; i < sweeps; i++){
    const cx = rrange(rng, 260, 740);
    const cy = rrange(rng, 170, 530);
    const r = rrange(rng, 140, 280);
    const a0 = rrange(rng, 0, Math.PI * 2);
    const a1 = a0 + rrange(rng, 0.35, 0.9);

    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r * 0.62;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r * 0.62;

    const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r*0.62} 0 0 1 ${x1} ${y1} Z`;
    gWorld.appendChild(el("path", {
      d,
      fill:"rgba(0,255,120,0.04)",
      stroke:"rgba(0,255,120,0.10)",
      "stroke-width":1
    }));
  }
}

function drawNetwork(rng, density){
  clearNode(gNet);

  const nodeCount = Math.floor(18 * density);
  const nodes = [];
  for (let i = 0; i < nodeCount; i++){
    nodes.push({
      x: rrange(rng, 80, 920),
      y: rrange(rng, 90, 610),
      w: rrange(rng, 0.8, 1.6)
    });
  }

  // Edges
  const edgeCount = Math.floor(28 * density);
  for (let i = 0; i < edgeCount; i++){
    const a = nodes[irange(rng, 0, nodes.length - 1)];
    const b = nodes[irange(rng, 0, nodes.length - 1)];
    if (a === b) continue;

    gNet.appendChild(el("line", {
      x1:a.x, y1:a.y, x2:b.x, y2:b.y,
      stroke:"rgba(0,255,120,0.14)",
      "stroke-width": rrange(rng, 0.8, 1.2)
    }));
  }

  // Nodes + labels
  const labelPool = ["DEFCON", "LINK", "NODE", "RELAY", "UPLINK", "SYNC", "TRACE", "PING", "ROUTE", "SATCOM", "ARRAY"];
  for (let i = 0; i < nodes.length; i++){
    const n = nodes[i];
    gNet.appendChild(el("circle", {
      cx:n.x, cy:n.y,
      r: 3.2 * n.w,
      fill:"rgba(0,255,120,0.7)"
    }));
    gNet.appendChild(el("circle", {
      cx:n.x, cy:n.y,
      r: 10 * n.w,
      fill:"none",
      stroke:"rgba(0,255,120,0.14)",
      "stroke-width":1
    }));

    if (rng() < 0.45){
      const t = el("text", {
        x: n.x + 12,
        y: n.y - 10,
        fill: "rgba(0,255,120,0.55)",
        "font-size":"12"
      });
      t.textContent = `${pick(rng, labelPool)}-${irange(rng, 10, 99)}`;
      gNet.appendChild(t);
    }
  }
}

function drawHUD(rng){
  clearNode(gHUD);

  // Corner brackets
  const corners = [
    [20,20, 120,20, 20,120],
    [980,20, 880,20, 980,120],
    [20,680, 120,680, 20,580],
    [980,680, 880,680, 980,580]
  ];
  for (const c of corners){
    gHUD.appendChild(el("polyline", {
      points:`${c[0]},${c[1]} ${c[2]},${c[3]} ${c[0]},${c[1]} ${c[4]},${c[5]}`,
      fill:"none",
      stroke:"rgba(0,255,120,0.22)",
      "stroke-width":2
    }));
  }

  // Status blocks
  const blocks = [
    { x: 40, y: 560, w: 310, h: 110, title: "SYSTEM STATUS" },
    { x: 650, y: 560, w: 310, h: 110, title: "ACTIVE TRACKS" }
  ];

  const statusLines = [
    () => `CORE: ${pick(rng, ["ONLINE", "ONLINE", "ONLINE", "DEGRADED"])}`,
    () => `MEM: ${irange(rng, 62, 98)}%`,
    () => `IO: ${irange(rng, 120, 980)} OPS`,
    () => `LINK: ${pick(rng, ["STABLE", "STABLE", "NOISY"])}`,
    () => `AUTH: ${pick(rng, ["OK", "OK", "REVIEW"])}`,
    () => `TRACE: ${pick(rng, ["IDLE", "RUN", "RUN"])}`,
  ];

  for (const b of blocks){
    gHUD.appendChild(el("rect", {
      x:b.x, y:b.y, width:b.w, height:b.h,
      fill:"rgba(0,255,120,0.02)",
      stroke:"rgba(0,255,120,0.22)",
      "stroke-width":1.2
    }));

    const title = el("text", { x:b.x + 10, y:b.y + 20, fill:"rgba(0,255,120,0.75)", "font-size":"13" });
    title.textContent = b.title;
    gHUD.appendChild(title);

    for (let i = 0; i < 5; i++){
      const line = el("text", {
        x: b.x + 10,
        y: b.y + 42 + i * 16,
        fill: "rgba(0,255,120,0.55)",
        "font-size":"12"
      });
      line.textContent = statusLines[irange(rng, 0, statusLines.length - 1)]();
      gHUD.appendChild(line);
    }
  }

  // Footer text line
  const footer = el("text", { x: 40, y: 530, fill:"rgba(0,255,120,0.35)", "font-size":"12" });
  footer.textContent = `SIMULATION MODE: ${pick(rng, ["STRATEGIC", "THEATER", "GLOBAL"]) }   PROTOCOL: ${pick(rng, ["ALPHA", "BRAVO", "DELTA", "SIGMA"])}   CHANNEL: ${irange(rng, 1, 9)}`;
  gHUD.appendChild(footer);
}

// ---------- Orchestration ----------
function regenerate(){
  const density = Number(densityEl.value);

  let s = seedEl.value.trim();
  if (!s){
    s = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  }
  seedLabel.textContent = `SEED: ${s}`;

  const rng = makeRng(s);

  drawGrid(rng, density);
  drawWorld(rng, density);
  drawNetwork(rng, density);
  drawHUD(rng);

  // reset sweep position
  sweepX = -300;
  scanSweep.setAttribute("x", String(sweepX));
}

function tick(){
  // clock
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}:${ss}`;

  if (!paused){
    // sweep
    sweepX += 18;
    if (sweepX > 1300) sweepX = -300;
    scanSweep.setAttribute("x", String(sweepX));

    // flicker and jitter
    const f = Number(flickerEl.value);
    const flick = 1 - (Math.random() * f * 0.18);
    svg.style.opacity = String(flick);

    const j = (Math.random() < f * 0.25) ? (Math.random() * 2 - 1) : 0;
    svg.style.transform = `translate(${j}px, ${-j}px)`;

    // noise shimmer
    noise.style.opacity = String(0.04 + Math.random() * 0.06);
  }

  requestAnimationFrame(tick);
}

// events
regenBtn.addEventListener("click", regenerate);
pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
});

seedEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") regenerate();
});

regenerate();
requestAnimationFrame(tick);
