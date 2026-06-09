/* ============================================================
   WOPR — STRATEGIC AIR COMMAND  (app.js)
   WarGames war-room vector map. Vanilla JS, no build, no deps.

   Green phosphor on black everywhere EXCEPT the live USGS
   earthquake markers/readout, which are the single colour accent.

   External calls: ONE — the public USGS all_hour quake feed.
   No keys, no trackers, no PII. Degrades gracefully if offline.
   ============================================================ */

"use strict";

/* ---------------- DOM ---------------- */
const svg      = document.getElementById("v");
const gGrid    = document.getElementById("gGrid");
const gMap     = document.getElementById("gMap");
const gLinks   = document.getElementById("gLinks");
const gCities  = document.getElementById("gCities");
const gQuakes  = document.getElementById("gQuakes");
const gHUD     = document.getElementById("gHUD");
const scanSweep= document.getElementById("scanSweep");
const noise    = document.getElementById("noise");

const clockEl     = document.getElementById("clock");
const defconEl    = document.getElementById("defcon");
const defconNumEl = document.getElementById("defconNum");
const sysReadout  = document.getElementById("sysReadout");
const trafficRead = document.getElementById("trafficReadout");
const targetRead  = document.getElementById("targetReadout");
const quakeList   = document.getElementById("quakeList");
const seisLive    = document.getElementById("seisLive");
const bargraph    = document.getElementById("bargraph");
const counters    = document.getElementById("counters");
const teletype    = document.getElementById("teletype");

const pauseBtn  = document.getElementById("pause");
const strikeBtn = document.getElementById("strike");

const reduceMotion = window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- View geometry ---------------- */
const W = 1000, H = 540;
/* The map occupies an inset rectangle so HUD furniture has margins. */
const MAP = { x: 18, y: 26, w: W - 36, h: H - 78 };

/* Equirectangular projection. lon[-180,180] lat[-85,85] -> screen. */
const LAT_LIMIT = 84;
function project(lat, lon){
  const x = MAP.x + ((lon + 180) / 360) * MAP.w;
  const y = MAP.y + ((LAT_LIMIT - lat) / (2 * LAT_LIMIT)) * MAP.h;
  return { x, y };
}

/* ---------------- SVG helpers ---------------- */
function clearNode(n){ while (n.firstChild) n.removeChild(n.firstChild); }
function el(name, attrs){
  const n = document.createElementNS("http://www.w3.org/2000/svg", name);
  if (attrs) for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  return n;
}
function rand(a, b){ return a + Math.random() * (b - a); }
function irand(a, b){ return Math.floor(rand(a, b + 1)); }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

/* ============================================================
   CITIES — real lat/long. Plotted at true geographic position.
   ============================================================ */
const CITIES = [
  { name:"WASHINGTON",  lat: 38.895, lon: -77.037 },
  { name:"NEW YORK",    lat: 40.713, lon: -74.006 },
  { name:"LOS ANGELES", lat: 34.052, lon:-118.244 },
  { name:"CHICAGO",     lat: 41.878, lon: -87.630 },
  { name:"OTTAWA",      lat: 45.421, lon: -75.697 },
  { name:"MEXICO CITY", lat: 19.432, lon: -99.133 },
  { name:"BOGOTA",      lat:  4.711, lon: -74.072 },
  { name:"LIMA",        lat:-12.046, lon: -77.043 },
  { name:"BRASILIA",    lat:-15.794, lon: -47.883 },
  { name:"BUENOS AIRES",lat:-34.603, lon: -58.381 },
  { name:"LONDON",      lat: 51.507, lon:  -0.128 },
  { name:"PARIS",       lat: 48.857, lon:   2.352 },
  { name:"MADRID",      lat: 40.417, lon:  -3.704 },
  { name:"BERLIN",      lat: 52.520, lon:  13.405 },
  { name:"ROME",        lat: 41.903, lon:  12.496 },
  { name:"OSLO",        lat: 59.913, lon:  10.752 },
  { name:"MOSCOW",      lat: 55.756, lon:  37.617 },
  { name:"KYIV",        lat: 50.450, lon:  30.523 },
  { name:"ANKARA",      lat: 39.933, lon:  32.860 },
  { name:"CAIRO",       lat: 30.044, lon:  31.236 },
  { name:"RIYADH",      lat: 24.713, lon:  46.676 },
  { name:"TEHRAN",      lat: 35.690, lon:  51.389 },
  { name:"NAIROBI",     lat: -1.286, lon:  36.817 },
  { name:"PRETORIA",    lat:-25.747, lon:  28.229 },
  { name:"NEW DELHI",   lat: 28.614, lon:  77.209 },
  { name:"ISLAMABAD",   lat: 33.693, lon:  73.065 },
  { name:"BEIJING",     lat: 39.904, lon: 116.407 },
  { name:"SHANGHAI",    lat: 31.230, lon: 121.474 },
  { name:"TOKYO",       lat: 35.676, lon: 139.650 },
  { name:"SEOUL",       lat: 37.566, lon: 126.978 },
  { name:"SINGAPORE",   lat:  1.352, lon: 103.820 },
  { name:"JAKARTA",     lat: -6.208, lon: 106.845 },
  { name:"CANBERRA",    lat:-35.280, lon: 149.130 },
  { name:"WELLINGTON",  lat:-41.286, lon: 174.776 },
  { name:"HONOLULU",    lat: 21.307, lon:-157.858 },
  { name:"ANCHORAGE",   lat: 61.218, lon:-149.900 },
  { name:"REYKJAVIK",   lat: 64.147, lon: -21.942 }
];

/* ============================================================
   DRAW: graticule + coastlines (real Natural Earth data)
   ============================================================ */
function drawGrid(){
  clearNode(gGrid);
  /* faint lat/long graticule */
  for (let lon = -180; lon <= 180; lon += 20){
    const a = project(0, lon);
    gGrid.appendChild(el("line", {
      x1:a.x, y1:MAP.y, x2:a.x, y2:MAP.y+MAP.h,
      stroke:"rgba(54,255,122,0.06)", "stroke-width":1
    }));
  }
  for (let lat = -80; lat <= 80; lat += 20){
    const a = project(lat, 0);
    gGrid.appendChild(el("line", {
      x1:MAP.x, y1:a.y, x2:MAP.x+MAP.w, y2:a.y,
      stroke:"rgba(54,255,122,0.06)", "stroke-width":1
    }));
  }
  /* equator + prime meridian a touch brighter */
  const eq = project(0,0);
  gGrid.appendChild(el("line", { x1:MAP.x, y1:eq.y, x2:MAP.x+MAP.w, y2:eq.y,
    stroke:"rgba(54,255,122,0.12)", "stroke-width":1, "stroke-dasharray":"2 6" }));
  gGrid.appendChild(el("line", { x1:eq.x, y1:MAP.y, x2:eq.x, y2:MAP.y+MAP.h,
    stroke:"rgba(54,255,122,0.12)", "stroke-width":1, "stroke-dasharray":"2 6" }));
}

function drawCoastlines(){
  clearNode(gMap);
  const segs = window.COASTLINE || [];
  for (let s = 0; s < segs.length; s++){
    const seg = segs[s];
    let d = "";
    for (let i = 0; i < seg.length; i++){
      const p = project(seg[i][1], seg[i][0]);
      d += (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1) + " ";
    }
    gMap.appendChild(el("path", {
      d, fill:"none",
      stroke:"rgba(54,255,122,0.42)",
      "stroke-width":1,
      "stroke-linejoin":"round"
    }));
  }
}

/* ============================================================
   DRAW: cities (POIs) at true positions
   ============================================================ */
function drawCities(){
  clearNode(gCities);
  for (const c of CITIES){
    const p = project(c.lat, c.lon);
    c._x = p.x; c._y = p.y;
    gCities.appendChild(el("rect", {
      x:p.x-2, y:p.y-2, width:4, height:4,
      fill:"none", stroke:"rgba(54,255,122,0.6)", "stroke-width":1
    }));
    gCities.appendChild(el("circle", { cx:p.x, cy:p.y, r:1, fill:"rgba(54,255,122,0.85)" }));
  }
}

/* ============================================================
   MISSILE ARC TRAJECTORIES — grow & cascade
   ============================================================ */
let activeLinks = [];
let trajLog = [];      /* readout for the right rail */
let launchCount = 0;
let interceptCount = 0;

function arcPath(a, b){
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = clamp(dist * 0.34, 26, 150);
  return { d:`M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mx.toFixed(1)} ${(my-lift).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
           cx:mx, cy:my-lift };
}

function makeLink(){
  let A, B, t = 0;
  do { A = pick(CITIES); B = pick(CITIES); t++; } while (A === B && t < 20);
  const a = { x:A._x, y:A._y }, b = { x:B._x, y:B._y };
  const arc = arcPath(a, b);

  const path = el("path", {
    d:arc.d, fill:"none",
    stroke:"rgba(54,255,122,0.55)",
    "stroke-width":1.3, "stroke-linecap":"round"
  });
  /* dash-grow: use getTotalLength after insert */
  gLinks.appendChild(path);
  const len = path.getTotalLength();
  path.setAttribute("stroke-dasharray", len + " " + len);
  path.setAttribute("stroke-dashoffset", len);

  /* travelling warhead dot + target reticle (drawn on arrival) */
  const head = el("circle", { cx:a.x, cy:a.y, r:1.8, fill:"var(--phos)",
    filter:"url(#glowHot)" });
  gLinks.appendChild(head);
  const ring = el("circle", { cx:b.x, cy:b.y, r:0, fill:"none",
    stroke:"rgba(54,255,122,0.7)", "stroke-width":1.2, opacity:0 });
  gLinks.appendChild(ring);

  const dur   = reduceMotion ? 2600 : rand(1600, 3200);
  const hold  = rand(700, 1700);
  const fade  = rand(900, 1500);

  launchCount++;
  pushTraj(A.name, B.name);

  return { path, head, ring, arc, len, A, B,
           born: performance.now(), dur, hold, fade, struck:false };
}

function pointOnQuad(a, c, b, t){
  const mt = 1 - t;
  return {
    x: mt*mt*a.x + 2*mt*t*c.x + t*t*b.x,
    y: mt*mt*a.y + 2*mt*t*c.y + t*t*b.y
  };
}

function updateLinks(now){
  const still = [];
  for (const L of activeLinks){
    const age = now - L.born;
    const a = { x:L.A._x, y:L.A._y }, b = { x:L.B._x, y:L.B._y };
    const c = { x:L.arc.cx, y:L.arc.cy };

    if (age <= L.dur){
      const t = age / L.dur;
      L.path.setAttribute("stroke-dashoffset", (L.len * (1 - t)).toFixed(1));
      const pos = pointOnQuad(a, c, b, t);
      L.head.setAttribute("cx", pos.x.toFixed(1));
      L.head.setAttribute("cy", pos.y.toFixed(1));
      still.push(L); continue;
    }
    if (!L.struck){
      L.struck = true;
      L.head.setAttribute("opacity", "0");
      interceptCount++;
    }
    if (age <= L.dur + L.hold){
      /* impact reticle expands */
      const k = (age - L.dur) / L.hold;
      L.ring.setAttribute("opacity", (0.8 * (1 - k)).toFixed(2));
      L.ring.setAttribute("r", (2 + k * 9).toFixed(1));
      still.push(L); continue;
    }
    const f = (age - L.dur - L.hold) / L.fade;
    if (f <= 1){
      const o = 1 - f;
      L.path.setAttribute("opacity", (0.15 + 0.7 * o).toFixed(2));
      still.push(L); continue;
    }
    killLink(L);
  }
  activeLinks = still;
}
function killLink(L){
  [L.path, L.head, L.ring].forEach(n => { if (n && n.parentNode) n.parentNode.removeChild(n); });
}

/* Spawn cascade: steady trickle + bursts */
let spawnTimer = 0;
function maybeSpawn(dt){
  if (reduceMotion){
    /* calm: at most a few, slow */
    if (activeLinks.length < 3){ spawnTimer += dt; if (spawnTimer > 2600){ spawnTimer = 0; activeLinks.push(makeLink()); } }
    return;
  }
  spawnTimer += dt;
  const interval = clamp(620 - threat * 70, 140, 620);
  while (spawnTimer >= interval){
    spawnTimer -= interval;
    if (activeLinks.length < 14 + threat * 6) activeLinks.push(makeLink());
  }
}
function launchWave(){
  const n = reduceMotion ? 3 : irand(6, 12);
  for (let i = 0; i < n; i++) setTimeout(() => activeLinks.push(makeLink()), i * 90);
  threat = clamp(threat + 1.4, 0, 5);
}

/* ============================================================
   LIVE WOPR STATS  (look like they make sense)
   ============================================================ */
let threat = 1.2;                  /* drives DEFCON + spawn rate, decays */
let bootMs = performance.now();
let bandwidth = 1840;
let trace = "IDLE";

function pushTraj(from, to){
  const id = "TK-" + String(irand(1000, 9999));
  trajLog.unshift({ id, from, to, t: Date.now() });
  if (trajLog.length > 8) trajLog.pop();
}

function defconFromThreat(){
  /* threat 0..5  ->  DEFCON 5..1 */
  return clamp(5 - Math.round(threat), 1, 5);
}

function fmtUTC(d){
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}

let statAcc = 0;
function updateReadouts(dt, now){
  /* clock every frame */
  clockEl.textContent = fmtUTC(new Date());

  /* DEFCON */
  const dc = defconFromThreat();
  defconNumEl.textContent = dc;
  defconEl.classList.toggle("alert", dc <= 2);

  /* threat decays toward baseline */
  threat = Math.max(1.0, threat - dt * 0.00007);

  statAcc += dt;
  if (statAcc < 600) return;        /* refresh readouts ~1.6Hz */
  statAcc = 0;

  bandwidth = clamp(bandwidth + rand(-180, 220), 600, 9600);
  const upMin = Math.floor((now - bootMs) / 60000);
  const upSec = Math.floor(((now - bootMs) / 1000) % 60);
  trace = pick(["IDLE","RUN","RUN","TRACE","SCAN"]);

  /* SYSTEM STATUS */
  setRows(sysReadout, [
    ["CORE", "ONLINE", false],
    ["AUTH", dc <= 2 ? "OVERRIDE" : "LCK", dc <= 2],
    ["UPTIME", `${String(Math.floor((now-bootMs)/3600000)).padStart(2,"0")}:${String(upMin%60).padStart(2,"0")}:${String(upSec).padStart(2,"0")}`, false],
    ["MEM", irand(62, 97) + "%", false],
    ["PROC", irand(3, 64) + " THR", false],
    ["TRACE", trace, trace !== "IDLE"]
  ]);

  /* NORAD UPLINK */
  setRows(trafficRead, [
    ["THRUPUT", bandwidth + " KB/S", false],
    ["PACKETS", irand(11000, 99000).toLocaleString(), false],
    ["LATENCY", irand(14, 220) + " MS", false],
    ["SATCOM", pick(["LOCK","LOCK","SYNC"]), false],
    ["ACTIVE TK", activeLinks.length, activeLinks.length > 16],
    ["INTERCEPT", interceptCount, false]
  ]);
  drawBars();

  /* TRAJECTORY LOG */
  const trows = trajLog.map(t => {
    const li = document.createElement("li");
    const ago = Math.floor((Date.now() - t.t) / 1000);
    li.innerHTML = `<span>${t.id}</span><b>${shorten(t.from)}→${shorten(t.to)} ${ago}s</b>`;
    return li;
  });
  replaceRows(targetRead, trows);

  /* bottom counters */
  counters.innerHTML =
    `<span>LAUNCH <b>${launchCount}</b></span>` +
    `<span>ACTIVE <b>${activeLinks.length}</b></span>` +
    `<span>IMPACT <b>${interceptCount}</b></span>` +
    `<span>SEISMIC <b>${quakeCount}</b></span>` +
    `<span>THREAT <b>${threat.toFixed(1)}</b></span>` +
    `<span>GRID <b>EQUIRECT 1:1</b></span>`;
}
function shorten(s){ return s.length > 5 ? s.slice(0,5) : s; }

function setRows(ul, rows){
  const lis = rows.map(([k,v,warn]) => {
    const li = document.createElement("li");
    if (warn) li.className = "warn";
    li.innerHTML = `<span>${k}</span><b>${v}</b>`;
    return li;
  });
  replaceRows(ul, lis);
}
function replaceRows(ul, lis){
  clearNode(ul);
  for (const li of lis) ul.appendChild(li);
}

let barEls = [];
function drawBars(){
  if (barEls.length === 0){
    for (let i = 0; i < 22; i++){
      const b = document.createElement("div"); b.className = "bar"; b.style.height = "20%";
      bargraph.appendChild(b); barEls.push(b);
    }
  }
  for (const b of barEls) b.style.height = irand(8, 100) + "%";
}

/* ============================================================
   TELETYPE — WOPR character
   ============================================================ */
const WOPR_LINES = [
  "GREETINGS PROFESSOR FALKEN.",
  "SHALL WE PLAY A GAME?",
  "LOADING GLOBAL THERMONUCLEAR WAR...",
  "DEFENSE CONDITION RECALCULATED.",
  "STRATEGIC TRAJECTORIES PLOTTED.",
  "A STRANGE GAME. THE ONLY WINNING MOVE IS NOT TO PLAY.",
  "SEISMIC TELEMETRY: USGS UPLINK NOMINAL.",
  "HOW ABOUT A NICE GAME OF CHESS?"
];
let ttIdx = 0;
function teletypeNext(){
  if (reduceMotion){ teletype.textContent = WOPR_LINES[ttIdx % WOPR_LINES.length] + " _"; ttIdx++; setTimeout(teletypeNext, 6000); return; }
  const line = WOPR_LINES[ttIdx % WOPR_LINES.length]; ttIdx++;
  let i = 0;
  teletype.textContent = "";
  const type = () => {
    if (i <= line.length){
      teletype.innerHTML = line.slice(0, i) + '<span class="caret">_</span>';
      i++; setTimeout(type, 42);
    } else {
      setTimeout(teletypeNext, 4200);
    }
  };
  type();
}

/* ============================================================
   LIVE USGS EARTHQUAKES — the ONE colour accent
   ============================================================ */
const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
let quakeCount = 0;
let quakeMarkers = [];   /* {node, mag, born} for pulsing */

async function fetchQuakes(){
  try {
    const res = await fetch(USGS_URL, { cache:"no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    renderQuakes(data.features || []);
    seisLive.textContent = "● LIVE";
    seisLive.style.removeProperty("color");
  } catch (err){
    seisDegraded(err);
  }
}

function seisDegraded(err){
  seisLive.textContent = "○ NO SIGNAL";
  clearNode(quakeList);
  const li = document.createElement("li");
  li.className = "seis-down";
  li.textContent = "NO SEISMIC DATA — USGS UPLINK UNREACHABLE";
  quakeList.appendChild(li);
  /* keep any existing markers; do not introduce other colour */
}

function renderQuakes(features){
  clearNode(gQuakes);
  quakeMarkers = [];
  /* sort by magnitude desc, plot all, list top */
  const feats = features
    .filter(f => f.geometry && f.geometry.coordinates && f.properties.mag != null)
    .sort((a,b) => b.properties.mag - a.properties.mag);
  quakeCount = feats.length;

  for (const f of feats){
    const [lon, lat] = f.geometry.coordinates;
    if (lat == null || lon == null) continue;
    const p = project(lat, lon);
    const mag = Math.max(0, f.properties.mag);
    const r = clamp(2 + mag * 1.8, 2, 16);
    const big = mag >= 4.5;
    const col = big ? "var(--quake-hot)" : "var(--quake)";

    const ring = el("circle", { cx:p.x, cy:p.y, r:r,
      fill:"none", stroke:col, "stroke-width":1.3, opacity:0.9,
      filter:"url(#glowHot)" });
    const core = el("circle", { cx:p.x, cy:p.y, r:1.6, fill:col, filter:"url(#glowHot)" });
    gQuakes.appendChild(ring);
    gQuakes.appendChild(core);
    quakeMarkers.push({ ring, baseR:r, born: performance.now() + Math.random()*1000 });
  }

  /* readout list — top 7 */
  const rows = feats.slice(0, 7).map(f => {
    const li = document.createElement("li");
    const mag = f.properties.mag.toFixed(1);
    const big = f.properties.mag >= 4.5 ? " big" : "";
    const place = (f.properties.place || "UNKNOWN").toUpperCase()
      .replace(/^\d+\s*KM\s+/, "").slice(0, 22);
    li.innerHTML = `<span class="mag${big}">M${mag}</span> <span class="loc">${place}</span>`;
    return li;
  });
  if (rows.length === 0){
    const li = document.createElement("li"); li.className = "seis-down";
    li.textContent = "NO EVENTS IN LAST HOUR";
    quakeList.appendChild(document.createElement("li"));
    clearNode(quakeList); quakeList.appendChild(li);
  } else {
    clearNode(quakeList);
    for (const li of rows) quakeList.appendChild(li);
  }
}

function pulseQuakes(now){
  for (const q of quakeMarkers){
    const phase = ((now - q.born) % 2200) / 2200;
    const r = q.baseR * (1 + phase * 0.7);
    q.ring.setAttribute("r", r.toFixed(1));
    q.ring.setAttribute("opacity", (0.9 * (1 - phase)).toFixed(2));
  }
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
let paused = false;
let sweepX = -320;
let lastT = performance.now();

function tick(now){
  const dt = now - lastT;
  lastT = now;

  if (!paused){
    if (!reduceMotion){
      sweepX += 7;
      if (sweepX > W + 20) sweepX = -320;
      scanSweep.setAttribute("x", sweepX.toFixed(0));
      noise.style.opacity = String(0.035 + Math.random() * 0.04);
    }
    maybeSpawn(dt);
    updateLinks(now);
    pulseQuakes(now);
    updateReadouts(dt, now);
  } else {
    clockEl.textContent = fmtUTC(new Date());
  }
  requestAnimationFrame(tick);
}

/* ============================================================
   BOOT
   ============================================================ */
function build(){
  drawGrid();
  drawCoastlines();
  drawCities();
  /* seed a few launches so it's alive immediately */
  for (let i = 0; i < (reduceMotion ? 2 : 6); i++) activeLinks.push(makeLink());
}

function init(){
  build();
  teletypeNext();
  fetchQuakes();
  setInterval(fetchQuakes, 60000);   /* refresh seismic each minute */
  requestAnimationFrame(tick);
}

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "▶ RESUME" : "❚❚ PAUSE";
});
strikeBtn.addEventListener("click", launchWave);
window.addEventListener("resize", () => { /* SVG scales via viewBox; nothing needed */ });

init();
