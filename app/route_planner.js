/* 출발지 → 목적지 길 찾기 (현재 위치 없이도 미리 길 알아보기)
 * index.html: <script src="route_planner.js"></script> + 지도 load 끝에
 *   RoutePlanner.init(map, state, { openCourse, decode, show, loadRegion, setCurrent })   (없어도 앱 동작)
 *
 * 1) 장소 찾기: 이름 검색(Photon · OpenStreetMap 기반, 키 없음) / 지도에서 찍기 / 지도 가운데
 * 2) 길 찾기: 팀 러닝 길(전용로 A·가능 길 B + 경사)을 연결망으로 만들어 브라우저에서 계산
 *      추천 = 전용로·평지 위주 / 가장 짧게 / 평지 우선
 *    러닝 길이 이어지지 않으면 일반 보행 길찾기(OSRM 도보, routing.openstreetmap.de)로 대신
 * 3) 찾은 길을 그 지역의 '지금 코스'로 → 기존 코스 화면·START(미리 달리기)·워치·화장실 간격이 그대로 이 길을 씀
 * ※ 검색어와 고른 지점 좌표는 위 외부 서비스(해외 서버)로 보내짐. 상용화 때는 자체 서버로 바꾸기
 */
window.RoutePlanner = (() => {
  const PHOTON = "https://photon.komoot.io/api/";
  const PHOTON_REV = "https://photon.komoot.io/reverse";
  const OSRM = "https://routing.openstreetmap.de/routed-foot/route/v1/driving/";
  const KOREA = [124.5, 33.0, 131.0, 38.7];
  const MAX_KM = 25, MAX_REGIONS = 10, SNAP_M = 400, LINK_M = 20;
  const PACE = 360;                                    // 6'00"/km (앱 기본값과 같음)
  const LIME = "#c8f25b";
  const MODES = { balanced: "추천 (전용로·평지)", short: "가장 짧게", flat: "평지 우선" };
  // 길 종류·경사에 따른 비용 배수 (작을수록 좋은 길)
  const W = {
    balanced: { A: 1.0, B: 1.2, s: { 0: 1, 1: 1.05, 2: 1.25, 3: 1.6, 8: 1, 9: 1.1 } },
    short:    { A: 1.0, B: 1.0, s: { 0: 1, 1: 1, 2: 1, 3: 1, 8: 1, 9: 1 } },
    flat:     { A: 1.0, B: 1.1, s: { 0: 1, 1: 1.2, 2: 1.8, 3: 3, 8: 1, 9: 1.2 } },
  };
  const S = { map: null, app: null, api: null, el: null, pts: { from: null, to: null }, pick: null, mode: "balanced",
              res: null, busy: false, mk: {}, sugT: null, sugFor: null };

  // ---------- 계산 도우미 ----------
  const rad = (d) => d * Math.PI / 180;
  const hav = (a, b) => {
    const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
  };
  const fmt = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m / 10) * 10}m`;
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function inRing(pt, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function regionAt(pt) {
    for (const f of S.app.regions.features) {
      const b = f.properties.bbox;
      if (pt[0] < b[0] || pt[0] > b[2] || pt[1] < b[1] || pt[1] > b[3]) continue;
      const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      if (polys.some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)))) return f.properties.code;
    }
    return null;
  }
  // 출발~도착 사이에 걸친 시군구 (직선 주변, 가까운 순)
  function regionsBetween(a, b) {
    const pad = .015, x0 = Math.min(a[0], b[0]) - pad, x1 = Math.max(a[0], b[0]) + pad, y0 = Math.min(a[1], b[1]) - pad, y1 = Math.max(a[1], b[1]) + pad;
    const segD = (p) => {                              // 시군구 중심에서 출발-도착 직선까지 거리(대략)
      const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-12;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
      return hav(p, [a[0] + t * dx, a[1] + t * dy]);
    };
    const must = [regionAt(a), regionAt(b)].filter(Boolean);
    const cand = S.app.regions.features.map((f) => f.properties)
      .filter((p) => !(p.bbox[2] < x0 || p.bbox[0] > x1 || p.bbox[3] < y0 || p.bbox[1] > y1))
      .sort((p, q) => segD(p.center) - segD(q.center)).map((p) => p.code);
    return [...new Set([...must, ...cand])].slice(0, MAX_REGIONS);
  }

  // ---------- 러닝 길 연결망 ----------
  function buildGraph(regs, mode) {
    const w = W[mode], id = new Map(), xy = [], adj = [];
    const node = (c) => {
      const k = `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
      let i = id.get(k);
      if (i === undefined) { i = xy.length; id.set(k, i); xy.push(c); adj.push([]); }
      return i;
    };
    const meta = [];                                   // 간선별 [길이, 전용로?, 평지?]
    for (const reg of regs) for (const f of reg.lines) {
      const cs = f.geometry.coordinates, p = f.properties;
      const fac = (p.r === "A" ? w.A : w.B) * (w.s[p.s] ?? 1);
      for (let i = 1; i < cs.length; i++) {
        const u = node(cs[i - 1]), v = node(cs[i]); if (u === v) continue;
        const d = hav(cs[i - 1], cs[i]), e = meta.length;
        meta.push([d, p.r === "A", p.s === 0]);
        adj[u].push(v, d * fac, e); adj[v].push(u, d * fac, e);
      }
    }
    // 격자 색인 (약 50m 칸)
    const C = 0.0005, grid = new Map(), cell = (c) => `${Math.floor(c[0] / C)},${Math.floor(c[1] / C)}`;
    xy.forEach((c, i) => { const k = cell(c); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
    const near = (c, maxM, skip) => {
      let best = -1, bd = maxM;
      const r = Math.ceil(maxM / 45), cx = Math.floor(c[0] / C), cy = Math.floor(c[1] / C);
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        for (const i of grid.get(`${cx + dx},${cy + dy}`) || []) {
          if (skip && skip(i)) continue;
          const d = hav(c, xy[i]); if (d < bd) { bd = d; best = i; }
        }
      }
      return [best, bd];
    };
    // 끊긴 끝점(막다른 점)은 20m 안 다른 길과 이어 줌 (같은 횡단보도·길 건너편 연결)
    for (let i = 0; i < xy.length; i++) {
      if (adj[i].length !== 3) continue;
      const nb = adj[i][0];
      const [j, d] = near(xy[i], LINK_M, (k) => k === i || k === nb);
      if (j >= 0) { const e = meta.length; meta.push([d, false, true]); adj[i].push(j, d * 1.3, e); adj[j].push(i, d * 1.3, e); }
    }
    return { xy, adj, meta, near };
  }
  // 다익스트라 (이진 힙)
  function shortest(g, s, t) {
    const n = g.xy.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), pe = new Int32Array(n).fill(-1);
    const heap = [[0, s]]; dist[s] = 0;
    const push = (x) => { heap.push(x); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, u] = pop();
      if (u === t) break;
      if (d > dist[u]) continue;
      const a = g.adj[u];
      for (let k = 0; k < a.length; k += 3) {
        const v = a[k], nd = d + a[k + 1];
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; pe[v] = a[k + 2]; push([nd, v]); }
      }
    }
    if (!isFinite(dist[t])) return null;
    const path = [], edges = [];
    for (let v = t; v !== -1; v = prev[v]) { path.push(v); if (pe[v] >= 0) edges.push(pe[v]); }
    return { path: path.reverse(), edges };
  }

  async function routeRun(a, b, mode) {
    const codes = regionsBetween(a, b);
    const regs = (await Promise.all(codes.map((c) => S.api.loadRegion(c).catch(() => null)))).filter(Boolean);
    if (!regs.length) return null;
    const g = buildGraph(regs, mode);
    const [s, ds] = g.near(a, SNAP_M), [t, dt] = g.near(b, SNAP_M);
    if (s < 0 || t < 0) return { fail: s < 0 ? "출발지 400m 안에 러닝 길이 없어요" : "도착지 400m 안에 러닝 길이 없어요" };
    const r = shortest(g, s, t);
    if (!r) return { fail: "러닝 길이 이어지지 않아요" };
    let m = ds + dt, mA = 0, mF = 0, mE = 0;
    for (const e of r.edges) { const [d, isA, isF] = g.meta[e]; m += d; mE += d; if (isA) mA += d; if (isF) mF += d; }
    const coords = [a, ...r.path.map((i) => g.xy[i]), b];
    return { kind: "run", coords, m, a: Math.round(mA / Math.max(mE, 1) * 100), f: Math.round(mF / Math.max(mE, 1) * 100), start: codes[0] };
  }
  async function routeWalk(a, b) {
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(`${OSRM}${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`, { signal: ctrl.signal });
    const j = await r.json();
    const rt = j.routes && j.routes[0];
    if (!rt) return null;
    return { kind: "walk", coords: rt.geometry.coordinates, m: rt.distance, a: null, f: null };
  }

  // ---------- 장소 검색 ----------
  async function search(q) {
    const c = S.map.getCenter();
    const u = `${PHOTON}?q=${encodeURIComponent(q)}&limit=7&lat=${c.lat}&lon=${c.lng}&bbox=${KOREA.join(",")}`;
    const j = await (await fetch(u)).json();
    return (j.features || []).map((f) => {
      const p = f.properties;
      const sub = [p.city || p.county, p.district, p.street].filter(Boolean).join(" ");
      return { name: p.name || p.street || "이름 없는 곳", sub, ll: f.geometry.coordinates };
    });
  }
  async function reverseName(ll) {
    try {
      const j = await (await fetch(`${PHOTON_REV}?lon=${ll[0]}&lat=${ll[1]}&limit=1`)).json();
      const p = j.features && j.features[0] && j.features[0].properties;
      if (p) return p.name || [p.district, p.street].filter(Boolean).join(" ") || null;
    } catch (e) {}
    return null;
  }

  // ---------- 화면 ----------
  function css() {
    const st = document.createElement("style");
    st.textContent = `
      .rp { position: fixed; inset: 0; z-index: 7; pointer-events: none; }
      .rp > * { pointer-events: auto; }
      .rp-top { position: absolute; left: 0; right: 0; top: 0; display: flex; gap: 10px; align-items: center;
        padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 0; }
      .rp-head { flex: 1; min-width: 0; height: 44px; border-radius: 14px; display: flex; flex-direction: column; justify-content: center; padding: 0 14px; }
      .rp-head b { font-size: 15px; } .rp-head small { font-size: 11px; color: var(--ink-2); }
      .rp-sheet { position: absolute; left: 0; right: 0; bottom: 0; max-width: 560px; margin: 0 auto; max-height: 60vh; overflow-y: auto;
        background: var(--bg); border-radius: 28px 28px 0 0; padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 12px); box-shadow: 0 -10px 40px rgba(0,0,0,.5); }
      .rp-sheet.min { max-height: 96px; overflow: hidden; }
      .rp-f { position: relative; display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
      .rp-f .dot { width: 12px; height: 12px; flex: none; border-radius: 50%; border: 3px solid #111; }
      .rp-f input { flex: 1; min-width: 0; height: 42px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); color: var(--ink);
        font: inherit; font-size: 15px; padding: 0 12px; }
      .rp-f input:focus { outline: 2px solid var(--lime); outline-offset: 0; }
      .rp-f .mini { height: 42px; padding: 0 10px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); font-size: 12px; font-weight: 700; color: var(--ink-2); white-space: nowrap; }
      .rp-f .mini[aria-pressed="true"] { background: var(--lime); color: var(--lime-ink); border-color: var(--lime); }
      .rp-sug { position: absolute; left: 18px; right: 0; top: 46px; z-index: 2; background: var(--card); border: 1px solid var(--line); border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,.45); max-height: 240px; overflow-y: auto; }
      .rp-sug button { display: block; width: 100%; text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); }
      .rp-sug button:last-child { border-bottom: 0; }
      .rp-sug b { display: block; font-size: 14px; } .rp-sug small { font-size: 11px; color: var(--ink-2); }
      .rp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }
      .rp-chip { height: 32px; padding: 0 11px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); font-size: 13px; font-weight: 600; color: var(--ink-2); }
      .rp-chip[aria-pressed="true"] { background: var(--lime); border-color: var(--lime); color: var(--lime-ink); }
      .rp-res { background: var(--card); border-radius: 16px; padding: 12px 14px; margin-bottom: 8px; font-size: 13px; color: var(--ink-2); line-height: 1.6; }
      .rp-res b.big { display: block; font-size: 20px; color: var(--ink); font-variant-numeric: tabular-nums; }
      .rp-res .warn { color: #ffa94d; }
      .rp-go { width: 100%; height: 50px; border-radius: 16px; background: var(--lime); color: var(--lime-ink); font-weight: 800; font-size: 15px; }
      .rp-go:disabled { opacity: .4; }
      .rp-hint { position: absolute; left: 50%; transform: translateX(-50%); top: calc(env(safe-area-inset-top, 0px) + 68px); background: #fff; color: #111;
        padding: 8px 12px; border-radius: 12px; font-size: 13px; font-weight: 700; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
      .rp-pin { width: 26px; height: 26px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid #111; display: grid; place-items: center;
        box-shadow: 0 3px 10px rgba(0,0,0,.5); }
      .rp-pin span { transform: rotate(45deg); font-size: 12px; font-weight: 900; color: #111; }`;
    document.head.appendChild(st);
  }
  const COLOR = { from: LIME, to: "#ff6b6b" };
  function build() {
    const el = document.createElement("div");
    el.className = "rp"; el.hidden = true;
    el.innerHTML = `
      <header class="rp-top"><button class="iconbtn glass" data-a="back" aria-label="뒤로">‹</button>
        <div class="rp-head glass"><b>출발지 → 목적지 길 찾기</b><small>지금 위치가 아니어도 미리 길을 볼 수 있어요</small></div></header>
      <div class="rp-hint" data-r="hint" hidden></div>
      <div class="rp-sheet" data-r="sheet">
        ${["from", "to"].map((k) => `
        <div class="rp-f" data-f="${k}">
          <span class="dot" style="background:${COLOR[k]}"></span>
          <input type="search" data-in="${k}" placeholder="${k === "from" ? "출발지 (예: 노량진역)" : "목적지 (예: 여의도한강공원)"}" autocomplete="off" enterkeyhint="search">
          <button class="mini" data-pick="${k}" aria-pressed="false">지도에서</button>
          <button class="mini" data-center="${k}">가운데</button>
          <div class="rp-sug" data-sug="${k}" hidden></div>
        </div>`).join("")}
        <div class="rp-chips">${Object.entries(MODES).map(([k, t]) => `<button class="rp-chip" data-m="${k}" aria-pressed="${k === S.mode}">${t}</button>`).join("")}</div>
        <div class="rp-res" data-r="res">출발지와 목적지를 검색하거나 지도에서 골라 주세요.</div>
        <button class="rp-go" data-a="go" disabled>이 길로 코스 보기 · 미리 달리기</button>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", onClick);
    el.addEventListener("input", (e) => { const k = e.target.dataset.in; if (k) onType(k, e.target.value); });
    el.addEventListener("keydown", (e) => {
      const k = e.target.dataset.in;
      if (k && e.key === "Enter") { e.preventDefault(); onType(k, e.target.value, true); }
    });
    S.el = el;
  }
  const q = (sel) => S.el.querySelector(sel);

  function onClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.a === "back") return close();
    if (b.dataset.a === "go") return useAsCourse();
    if (b.dataset.m) { S.mode = b.dataset.m; S.el.querySelectorAll("[data-m]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.m === S.mode))); return run(); }
    if (b.dataset.pick) return startPick(S.pick === b.dataset.pick ? null : b.dataset.pick);
    if (b.dataset.center) { const c = S.map.getCenter().toArray(); return setPoint(b.dataset.center, c, null); }
    if (b.dataset.sugi != null) {
      const k = b.closest("[data-sug]").dataset.sug, it = S.sug[k][+b.dataset.sugi];
      hideSug(k); setPoint(k, it.ll, it.name);
      S.map.easeTo({ center: it.ll, zoom: Math.max(S.map.getZoom(), 14), duration: 600 });
    }
  }
  S.sug = { from: [], to: [] };
  function hideSug(k) { q(`[data-sug="${k}"]`).hidden = true; }
  function onType(k, v, now) {
    clearTimeout(S.sugT);
    if (S.pts[k] && v !== S.pts[k].name) { S.pts[k] = null; marker(k); clearRoute(); }
    if (v.trim().length < 2) return hideSug(k);
    S.sugT = setTimeout(async () => {
      let list = [];
      try { list = await search(v.trim()); } catch (e) { list = []; }
      S.sug[k] = list;
      const box = q(`[data-sug="${k}"]`);
      box.innerHTML = list.length ? list.map((it, i) => `<button data-sugi="${i}"><b>${esc(it.name)}</b><small>${esc(it.sub)}</small></button>`).join("")
                                  : `<button disabled><small>검색 결과가 없어요. '지도에서'로 직접 골라 보세요.</small></button>`;
      box.hidden = false;
    }, now ? 0 : 350);
  }
  function startPick(k) {
    S.pick = k;
    S.el.querySelectorAll("[data-pick]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.pick === k)));
    q('[data-r="hint"]').hidden = !k;
    q('[data-r="hint"]').textContent = k === "from" ? "지도에서 출발지를 눌러 주세요" : "지도에서 목적지를 눌러 주세요";
    q('[data-r="sheet"]').classList.toggle("min", !!k);
    S.map.getCanvas().style.cursor = k ? "crosshair" : "";
    pad();
  }
  function onMapClick(e) {
    if (S.el.hidden || !S.pick) return;
    const k = S.pick, ll = [e.lngLat.lng, e.lngLat.lat];
    startPick(null);
    setPoint(k, ll, null);
  }
  async function setPoint(k, ll, name) {
    S.pts[k] = { ll, name: name || "지도에서 고른 곳" };
    q(`[data-in="${k}"]`).value = S.pts[k].name;
    marker(k);
    if (!name) reverseName(ll).then((n) => { if (n && S.pts[k] && S.pts[k].ll === ll) { S.pts[k].name = n; q(`[data-in="${k}"]`).value = n; } });
    run();
  }
  function marker(k) {
    if (S.mk[k]) { S.mk[k].remove(); S.mk[k] = null; }
    if (!S.pts[k]) return;
    const d = document.createElement("div");
    d.className = "rp-pin"; d.style.background = COLOR[k]; d.innerHTML = `<span>${k === "from" ? "출" : "도"}</span>`;
    S.mk[k] = new maplibregl.Marker({ element: d, anchor: "bottom", opacityWhenCovered: "1" }).setLngLat(S.pts[k].ll).addTo(S.map);
  }
  function clearRoute() {
    S.res = null;
    S.map.getSource("rp-route")?.setData({ type: "FeatureCollection", features: [] });
    q('[data-a="go"]').disabled = true;
  }

  // ---------- 길 찾기 실행 ----------
  async function run() {
    const A = S.pts.from, B = S.pts.to, box = q('[data-r="res"]');
    clearRoute();
    if (!A || !B) { box.textContent = A || B ? (A ? "목적지를 골라 주세요." : "출발지를 골라 주세요.") : "출발지와 목적지를 검색하거나 지도에서 골라 주세요."; return; }
    const straight = hav(A.ll, B.ll);
    if (straight > MAX_KM * 1000) { box.innerHTML = `<span class="warn">두 곳이 ${fmt(straight)} 떨어져 있어요. ${MAX_KM}km 안에서 골라 주세요.</span>`; return; }
    if (straight < 50) { box.innerHTML = `<span class="warn">출발지와 목적지가 너무 가까워요.</span>`; return; }
    const token = (S.busy = Symbol());
    box.textContent = "러닝 길에서 경로를 찾는 중…";
    let r = null, note = "";
    try { r = await routeRun(A.ll, B.ll, S.mode); } catch (e) { console.error("러닝 길 경로", e); }
    if (S.busy !== token) return;
    if (!r || r.fail) {
      note = r && r.fail ? r.fail : "러닝 길 정보를 불러오지 못했어요";
      box.textContent = `${note} → 일반 보행 길로 찾는 중…`;
      try { r = await routeWalk(A.ll, B.ll); } catch (e) { r = null; }
      if (S.busy !== token) return;
      if (!r) { box.innerHTML = `<span class="warn">${esc(note)}. 일반 보행 길도 찾지 못했어요.</span>`; return; }
    }
    S.res = r;
    S.map.getSource("rp-route").setData({ type: "Feature", properties: { kind: r.kind }, geometry: { type: "LineString", coordinates: r.coords } });
    const toilets = (S.app.toilets || []).filter((t) => r.coords.some((c, i) => i % 3 === 0 && hav(c, t.ll) <= 150)).length;
    const min = Math.max(1, Math.round(r.m / 1000 * PACE / 60));
    box.innerHTML = `<b class="big">${fmt(r.m)} · 약 ${min}분</b>` +
      (r.kind === "run" ? `러닝 길 경로 · 전용로 ${r.a}% · 평지 ${r.f}% · 길 근처 화장실 ${toilets}곳`
                        : `<span class="warn">일반 보행 경로</span> (${esc(note)}) · 길 근처 화장실 ${toilets}곳`) +
      `<br><small>6'00" 페이스 기준 · ${esc(MODES[S.mode])}</small>`;
    q('[data-a="go"]').disabled = false;
    const bb = r.coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(r.coords[0], r.coords[0]));
    pad();
    S.map.fitBounds(bb, { padding: 40, pitch: 0, bearing: 0, duration: 800, maxZoom: 16 });
  }

  // 찾은 길을 출발 지역의 '지금 코스'로 → 기존 코스 화면(START·워치·화장실 간격)이 이 길을 씀
  async function useAsCourse() {
    const r = S.res; if (!r) return;
    const code = regionAt(S.pts.from.ll) || regionAt(r.coords[0]) || S.app.cur;
    if (!code) return;
    S.api.setCurrent?.(code, true);
    const reg = await S.api.loadRegion(code).catch(() => null);
    if (!reg) return;
    await window.CoursePicker?.prepare(reg);                  // 원래 추천 코스를 먼저 보관 (코스 비교표에서 되돌릴 수 있게)
    if (!reg.route0) { reg.route0 = reg.route; reg.demo_m0 = reg.demo_m; }
    reg.route = r.coords; reg.demo_m = r.m; reg.variant = "route";
    reg.courseName = `${S.pts.from.name} → ${S.pts.to.name}`;
    reg.course = r.kind === "run" ? { f: r.f, a: r.a, night: null } : null;
    close(true);
    S.api.openCourse();
  }

  function pad() {
    if (S.el.hidden) return;
    S.map.setPadding({ top: 70, bottom: q('[data-r="sheet"]').offsetHeight + 10, left: 0, right: 0 });
  }
  function open() {
    document.getElementById("home").hidden = true;
    S.app.screen = "plan";                             // 지도 누르기가 지역 선택으로 넘어가지 않게
    S.el.hidden = false; S.app.planning = true; S.app.picking = true;   // picking: 지도 움직여도 지역이 바뀌지 않게
    S.map.setLayoutProperty("rp-line", "visibility", "visible");
    S.map.setLayoutProperty("rp-glow", "visibility", "visible");
    for (const k of ["from", "to"]) marker(k);
    pad();
    if (!S.pts.from) setTimeout(() => q('[data-in="from"]').focus(), 50);
  }
  function close(keepHome) {
    startPick(null);
    S.el.hidden = true; S.app.planning = false; S.app.picking = false;
    S.map.setLayoutProperty("rp-line", "visibility", "none");
    S.map.setLayoutProperty("rp-glow", "visibility", "none");
    for (const k of ["from", "to"]) if (S.mk[k]) { S.mk[k].remove(); S.mk[k] = null; }
    if (!keepHome) { S.api.show("home"); S.map.easeTo({ pitch: 45, duration: 600 }); }
  }

  function addHomeRow() {
    const anchor = document.getElementById("courseRow");
    if (!anchor) return;
    const b = document.createElement("button");
    b.className = "row"; b.type = "button"; b.id = "routeRow";
    b.innerHTML = `<span class="ic" aria-hidden="true">🧭</span>
      <span class="t"><b>출발지 → 목적지 길 찾기</b><small>장소를 검색하거나 지도에서 골라 러닝 길로 미리 보기</small></span>
      <span class="go" aria-hidden="true">›</span>`;
    b.onclick = open;
    anchor.after(b);
  }

  function init(map, app, api) {
    S.map = map; S.app = app; S.api = api || {};
    css(); build(); addHomeRow();
    map.addSource("rp-route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "rp-glow", type: "line", source: "rp-route", layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
      paint: { "line-color": LIME, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 8, 16, 18], "line-blur": 6, "line-opacity": .35 } });
    map.addLayer({ id: "rp-line", type: "line", source: "rp-route", layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
      paint: { "line-color": ["match", ["get", "kind"], "walk", "#ffffff", LIME], "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 7],
               "line-dasharray": ["match", ["get", "kind"], "walk", ["literal", [1.5, 1]], ["literal", [1, 0]]] } });
    map.on("click", onMapClick);
    window.addEventListener("resize", pad);
  }
  return { init, open, close };
})();
