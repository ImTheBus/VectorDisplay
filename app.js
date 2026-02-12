// Procedural Wargames-ish SVG screen, refocused to "Cold War strategic map" vibe.
// No dependencies.

const svg = document.getElementById("v");
const gGrid  = document.getElementById("gGrid");
const gMap   = document.getElementById("gMap");
const gLinks = document.getElementById("gLinks");
const gHUD   = document.getElementById("gHUD");

const regenBtn   = document.getElementById("regen");
const pauseBtn   = document.getElementById("pause");
const densityEl  = document.getElementById("density");
const flickerEl  = document.getElementById("flicker");
const linksEl    = document.getElementById("links");
const seedEl     = document.getElementById("seed");
const seedLabel  = document.getElementById("seedLabel");
const clockEl    = document.getElementById("clock");
const scanSweep  = document.getElementById("scanSweep");
const noise      = document.getElementById("noise");

let paused = false;
let sweepX = -300;

let rng = null;
let activeLinks = [];
let spawnTimer = 0;
let lastT = performance.now();

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

function pick(r, arr){ return arr[Math.floor(r() * arr.length)]; }
function rrange(r, a, b){ return a + (b - a) * r(); }
function irange(r, a, b){ return Math.floor(rrange(r, a, b + 1)); }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// ---------- SVG helpers ----------
function clearNode(node){
  while (node.firstChild) node.removeChild(node.firstChild);
}
function el(name, attrs = {}){
  const n = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

// ---------- Map projection ----------
const W = 1000;
const H = 700;

function project(lat, lon){
  // Equirectangular projection
  const x = ((lon + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return { x, y };
}

// ---------- "Capital" set (approx lat/lon) ----------
const CITIES = [
  { name:"London",       lat: 51.507, lon:  -0.128 },
  { name:"Paris",        lat: 48.857, lon:   2.352 },
  { name:"Berlin",       lat: 52.520, lon:  13.405 },
  { name:"Rome",         lat: 41.903, lon:  12.496 },
  { name:"Madrid",       lat: 40.417, lon:  -3.704 },
  { name:"Oslo",         lat: 59.913, lon:  10.752 },
  { name:"Stockholm",    lat: 59.330, lon:  18.069 },
  { name:"Helsinki",     lat: 60.170, lon:  24.938 },
  { name:"Warsaw",       lat: 52.230, lon:  21.012 },
  { name:"Prague",       lat: 50.075, lon:  14.438 },
  { name:"Vienna",       lat: 48.208, lon:  16.373 },
  { name:"Athens",       lat: 37.984, lon:  23.728 },
  { name:"Ankara",       lat: 39.933, lon:  32.860 },
  { name:"Cairo",        lat: 30.044, lon:  31.236 },
  { name:"Riyadh",       lat: 24.713, lon:  46.676 },
  { name:"Tehran",       lat: 35.690, lon:  51.389 },
  { name:"New Delhi",    lat: 28.614, lon:  77.209 },
  { name:"Islamabad",    lat: 33.693, lon:  73.065 },
  { name:"Beijing",      lat: 39.904, lon: 116.407 },
  { name:"Tokyo",        lat: 35.676, lon: 139.650 },
  { name:"Seoul",        lat: 37.566, lon: 126.978 },
  { name:"Bangkok",      lat: 13.756, lon: 100.502 },
  { name:"Jakarta",      lat:  -6.208, lon: 106.845 },
  { name:"Canberra",     lat: -35.280, lon: 149.130 },
  { name:"Wellington",   lat: -41.286, lon: 174.776 },
  { name:"Ottawa",       lat: 45.421, lon: -75.697 },
  { name:"Mexico City",  lat: 19.432, lon: -99.133 },
  { name:"Brasilia",     lat: -15.794, lon: -47.883 },
  { name:"Buenos Aires", lat: -34.603, lon: -58.381 },
  { name:"Santiago",     lat: -33.449, lon: -70.669 },
  { name:"Lima",         lat: -12.046, lon: -77.043 },
  { name:"Bogota",       lat:  4.711, lon: -74.072 },
  { name:"Pretoria",     lat: -25.747, lon:  28.229 },
  { name:"Nairobi",      lat:  -1.286, lon:  36.817 }
];

// ---------- Drawing: Grid & Graticule ----------
function drawGrid(r, density){
  clearNode(gGrid);

  const major = 100;
  const minor = 20;

  // Minor grid
  for (let x = 0; x <= W; x += minor){
    gGrid.appendChild(el("line", {
      x1:x, y1:0, x2:x, y2:H,
      stroke:"rgba(0,255,120,0.07)",
      "stroke-width":1
    }));
  }
  for (let y = 0; y <= H; y += minor){
    gGrid.appendChild(el("line", {
      x1:0, y1:y, x2:W, y2:y,
      stroke:"rgba(0,255,120,0.07)",
      "stroke-width":1
    }));
  }

  // Major grid
  for (let x = 0; x <= W; x += major){
    gGrid.appendChild(el("line", {
      x1:x, y1:0, x2:x, y2:H,
      stroke:"rgba(0,255,120,0.14)",
      "stroke-width":1.2
    }));
  }
  for (let y = 0; y <= H; y += major){
    gGrid.appendChild(el("line", {
      x1:0, y1:y, x2:W, y2:y,
      stroke:"rgba(0,255,120,0.14)",
      "stroke-width":1.2
    }));
  }

  // Random crosshair markers
  const n = Math.floor(8 * density);
  for (let i = 0; i < n; i++){
    const cx = irange(r, 80, 920);
    const cy = irange(r, 80, 620);
    const s = rrange(r, 10, 26);

    gGrid.appendChild(el("line", { x1:cx - s, y1:cy, x2:cx + s, y2:cy, stroke:"rgba(0,255,120,0.18)", "stroke-width":1 }));
    gGrid.appendChild(el("line", { x1:cx, y1:cy - s, x2:cx, y2:cy + s, stroke:"rgba(0,255,120,0.18)", "stroke-width":1 }));
    gGrid.appendChild(el("circle", { cx, cy, r: rrange(r, 14, 28), fill:"none", stroke:"rgba(0,255,120,0.10)", "stroke-width":1 }));
  }
}

function drawGraticule(){
  // Latitude/longitude lines (world map feel)
  const latStep = 15;
  const lonStep = 20;

  for (let lat = -75; lat <= 75; lat += latStep){
    const y = project(lat, 0).y;
    gMap.appendChild(el("line", {
      x1:0, y1:y, x2:W, y2:y,
      stroke:"rgba(0,255,120,0.08)",
      "stroke-width":1,
      "stroke-dasharray":"3 5"
    }));
  }

  for (let lon = -180; lon <= 180; lon += lonStep){
    const x = project(0, lon).x;
    gMap.appendChild(el("line", {
      x1:x, y1:0, x2:x, y2:H,
      stroke:"rgba(0,255,120,0.08)",
      "stroke-width":1,
      "stroke-dasharray":"3 5"
    }));
  }

  // A few labels (non-country, just coordinates)
  const labels = [
    { lat: 60, lon: -120 }, { lat: 30, lon: 0 }, { lat: 0, lon: 80 }, { lat: -30, lon: -40 }
  ];
  for (const p of labels){
    const pt = project(p.lat, p.lon);
    const t = el("text", {
      x: pt.x + 6,
      y: pt.y - 6,
      fill: "rgba(0,255,120,0.35)",
      "font-size": "11"
    });
    const ns = p.lat >= 0 ? "N" : "S";
    const ew = p.lon >= 0 ? "E" : "W";
    t.textContent = `${Math.abs(p.lat)}${ns} ${Math.abs(p.lon)}${ew}`;
    gMap.appendChild(t);
  }
}

// ---------- Drawing: Stylised world "coasts" (non-political, continent-ish blobs) ----------
function blobPath(r, cx, cy, rx, ry, points, jag){
  const pts = [];
  for (let i = 0; i < points; i++){
    const a = (i / points) * Math.PI * 2;
    const n = 1 + rrange(r, -jag, jag);
    const x = cx + Math.cos(a) * rx * n;
    const y = cy + Math.sin(a) * ry * n;
    pts.push([x,y]);
  }
  pts.push(pts[0]);

  let d = "";
  for (let i = 0; i < pts.length; i++){
    const p = pts[i];
    d += (i === 0 ? "M " : "L ") + `${p[0].toFixed(1)} ${p[1].toFixed(1)} `;
  }
  d += "Z";
  return d;
}

function drawWorldCoasts(r){
  clearNode(gMap);

  drawGraticule();

  // A few big “landmasses” placed roughly where continents sit.
  // They are deliberately stylised and not country-accurate.
  const masses = [
    { cx: 260, cy: 260, rx: 210, ry: 130, pts: 18, jag: 0.22 }, // N. America-ish
    { cx: 330, cy: 420, rx: 120, ry: 170, pts: 16, jag: 0.25 }, // S. America-ish
    { cx: 560, cy: 260, rx: 260, ry: 140, pts: 22, jag: 0.20 }, // Eurasia-ish
    { cx: 585, cy: 425, rx: 170, ry: 170, pts: 18, jag: 0.22 }, // Africa-ish
    { cx: 815, cy: 520, rx: 170, ry: 90,  pts: 16, jag: 0.18 }, // Australia-ish
    { cx: 740, cy: 330, rx: 110, ry: 70,  pts: 14, jag: 0.20 }, // SE Asia-ish
    { cx: 930, cy: 250, rx: 80,  ry: 60,  pts: 12, jag: 0.18 }, // Japan-ish
    { cx: 520, cy: 575, rx: 420, ry: 60,  pts: 20, jag: 0.10 }  // Antarctica-ish band
  ];

  for (const m of masses){
    const d = blobPath(r, m.cx, m.cy, m.rx, m.ry, m.pts, m.jag);

    // Coast stroke
    gMap.appendChild(el("path", {
      d,
      fill: "rgba(0,255,120,0.02)",
      stroke: "rgba(0,255,120,0.20)",
      "stroke-width": 1.2
    }));

    // Inner contour lines for “topo map” feel
    const rings = 2;
    for (let i = 1; i <= rings; i++){
      const k = 1 - i * 0.18;
      const dd = blobPath(r, m.cx, m.cy, m.rx * k, m.ry * k, m.pts, m.jag * 0.65);
      gMap.appendChild(el("path", {
        d: dd,
        fill: "none",
        stroke: "rgba(0,255,120,0.10)",
        "stroke-width": 1
      }));
    }
  }

  // A few “exclusion zones” circles to add strategic-map flavour
  for (let i = 0; i < 6; i++){
    const cx = rrange(r, 140, 860);
    const cy = rrange(r, 120, 580);
    const rr = rrange(r, 26, 60);
    gMap.appendChild(el("circle", {
      cx, cy, r: rr,
      fill: "none",
      stroke: "rgba(0,255,120,0.10)",
      "stroke-width": 1,
      "stroke-dasharray": "4 6"
    }));
  }
}

// ---------- Links: animated arcs between capitals ----------
function arcPath(a, b){
  // Quadratic curve with a control point lifted "north" for arc feel.
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);

  // Lift proportional to distance; bias upward a bit for drama.
  const lift = clamp(dist * 0.22, 30, 160);
  const cx = mx;
  const cy = my - lift;

  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function pathLengthApprox(a, b){
  // Simple proxy (used for dash animation), good enough visually.
  return Math.hypot(b.x - a.x, b.y - a.y) * 1.2;
}

function makeLink(r){
  // pick two distinct cities that aren't too close
  let A, B, tries = 0;
  do {
    A = pick(r, CITIES);
    B = pick(r, CITIES);
    tries++;
    if (tries > 30) break;
  } while (A === B);

  const a = project(A.lat, A.lon);
  const b = project(B.lat, B.lon);

  const d = arcPath(a, b);
  const len = pathLengthApprox(a, b);

  const baseOpacity = rrange(r, 0.22, 0.55);
  const strokeW = rrange(r, 1.0, 1.8);

  const p = el("path", {
    d,
    fill: "none",
    stroke: "rgba(0,255,120,0.30)",
    "stroke-width": strokeW,
    "stroke-linecap": "round",
    "stroke-dasharray": `${len.toFixed(1)} ${len.toFixed(1)}`,
    "stroke-dashoffset": `${len.toFixed(1)}`,
    opacity: baseOpacity
  });

  // endpoints
  const endA = el("circle", { cx: a.x, cy: a.y, r: 2.5, fill: "rgba(0,255,120,0.65)", opacity: 0.7 });
  const endB = el("circle", { cx: b.x, cy: b.y, r: 2.5, fill: "rgba(0,255,120,0.65)", opacity: 0.7 });

  // occasional label
  let label = null;
  if (r() < 0.35){
    label = el("text", {
      x: b.x + 8,
      y: b.y - 8,
      fill: "rgba(0,255,120,0.40)",
      "font-size": "11"
    });
    label.textContent = `${B.name.toUpperCase()}`;
  }

  // lifetime and timing (staggered, mixed durations)
  const duration = rrange(r, 1400, 3200);   // ms to draw
  const hold     = rrange(r, 600, 1600);    // ms visible after draw
  const fade     = rrange(r, 700, 1400);    // ms fade out
  const born = performance.now();

  gLinks.appendChild(p);
  gLinks.appendChild(endA);
  gLinks.appendChild(endB);
  if (label) gLinks.appendChild(label);

  return {
    p, endA, endB, label,
    len,
    born,
    duration,
    hold,
    fade
  };
}

function updateLinks(now){
  const target = Number(linksEl.value);

  // spawn timer controls staggering; higher target -> shorter interval
  const spawnInterval = target <= 0 ? 999999 : clamp(2200 / target, 90, 600);

  spawnTimer += (now - lastT);
  while (spawnTimer >= spawnInterval){
    spawnTimer -= spawnInterval;

    if (target > 0 && activeLinks.length < target){
      activeLinks.push(makeLink(rng));
    } else if (target > 0 && activeLinks.length >= target){
      // replace an old link occasionally to keep movement
      if (rng() < 0.25 && activeLinks.length > 0){
        const idx = irange(rng, 0, activeLinks.length - 1);
        killLink(activeLinks[idx]);
        activeLinks.splice(idx, 1);
        activeLinks.push(makeLink(rng));
      }
    }
  }

  // animate existing links
  const still = [];
  for (const L of activeLinks){
    const age = now - L.born;

    if (age <= L.duration){
      // drawing phase
      const t = age / L.duration;
      const dash = L.len * (1 - t);
      L.p.setAttribute("stroke-dashoffset", dash.toFixed(1));

      const pulse = 0.55 + 0.45 * Math.sin((age / 220) + (L.len / 90));
      L.endB.setAttribute("opacity", (0.45 + 0.35 * pulse).toFixed(2));
      still.push(L);
      continue;
    }

    if (age <= L.duration + L.hold){
      // hold phase
      L.p.setAttribute("stroke-dashoffset", "0");
      still.push(L);
      continue;
    }

    const fadeAge = age - (L.duration + L.hold);
    if (fadeAge <= L.fade){
      // fade out
      const t = 1 - (fadeAge / L.fade);
      const o = clamp(t, 0, 1);
      L.p.setAttribute("opacity", (0.12 + 0.55 * o).toFixed(2));
      L.endA.setAttribute("opacity", (0.10 + 0.60 * o).toFixed(2));
      L.endB.setAttribute("opacity", (0.10 + 0.60 * o).toFixed(2));
      if (L.label) L.label.setAttribute("opacity", (0.10 + 0.45 * o).toFixed(2));
      still.push(L);
      continue;
    }

    // done
    killLink(L);
  }

  activeLinks = still;

  // if target reduced, cull extras quickly
  while (activeLinks.length > target){
    const L = activeLinks.shift();
    killLink(L);
  }
}

function killLink(L){
  if (L.p?.parentNode) L.p.parentNode.removeChild(L.p);
  if (L.endA?.parentNode) L.endA.parentNode.removeChild(L.endA);
  if (L.endB?.parentNode) L.endB.parentNode.removeChild(L.endB);
  if (L.label?.parentNode) L.label.parentNode.removeChild(L.label);
}

// ---------- HUD ----------
function drawHUD(r){
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
    { x: 650, y: 560, w: 310, h: 110, title: "ACTIVE LINKS" }
  ];

  const statusLines = [
    () => `CORE: ${pick(r, ["ONLINE", "ONLINE", "DEGRADED"])}`,
    () => `MEM: ${irange(r, 62, 98)}%`,
    () => `IO: ${irange(r, 120, 980)} OPS`,
    () => `LINK: ${pick(r, ["STABLE", "STABLE", "NOISY"])}`,
    () => `AUTH: ${pick(r, ["OK", "OK", "REVIEW"])}`,
    () => `TRACE: ${pick(r, ["IDLE", "RUN", "RUN"])}`,
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
      line.textContent = statusLines[irange(r, 0, statusLines.length - 1)]();
      gHUD.appendChild(line);
    }
  }

  const footer = el("text", { x: 40, y: 530, fill:"rgba(0,255,120,0.35)", "font-size":"12" });
  footer.textContent = `SIMULATION MODE: GLOBAL   PROTOCOL: ${pick(r, ["ALPHA", "BRAVO", "DELTA", "SIGMA"])}   CHANNEL: ${irange(r, 1, 9)}`;
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

  rng = makeRng(s);

  drawGrid(rng, density);
  drawWorldCoasts(rng);
  drawHUD(rng);

  // reset sweep and links
  sweepX = -300;
  scanSweep.setAttribute("x", String(sweepX));

  clearNode(gLinks);
  activeLinks = [];
  spawnTimer = 0;
}

function tick(now){
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

    // links
    updateLinks(now);
  }

  lastT = now;
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

linksEl.addEventListener("input", () => {
  // immediate trim if decreased
  const target = Number(linksEl.value);
  while (activeLinks.length > target){
    const L = activeLinks.shift();
    killLink(L);
  }
});

regenerate();
requestAnimationFrame(tick);
