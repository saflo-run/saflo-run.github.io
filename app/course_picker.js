/* 맞춤형 코스 추천 (담당: 코스 추천)
 * 데이터: data/courses/<시군구코드>.json  ← running_map/08_courses.py 가 만듦
 *   courses[]: id, name, tag, p(성향), km(목표), m(실제 길이), a(전용로%), f(평지%), st(경사·급경사%), climb(오르막 m),
 *              t150(코스 150m 안 화장실), gap(화장실 최대 공백 m), night(밤 안전 길 %), start[경도,위도], poly(압축 좌표)
 * 시설 접근 코스(팀 분석): data/course_compare/<시군구코드>.json  { original:{meters,flat,slopeCoverage,lit}, alternative:{…, route:[[경도,위도]…]} }
 * index.html 은 아래만 부른다 (이 파일이 없어도 앱 동작: 예전처럼 추천 코스 1개)
 *   init(map, state, api) · home(reg) · has(code) · open() · prepare(reg) · compare(reg)
 */
window.CoursePicker = (() => {
  const BASE = "data/courses/", CMP = "data/course_compare/";
  const LIME = "#c8f25b";
  const S = { map: null, app: null, api: null, files: new Map(), data: {}, cmpFiles: new Map(), cmp: {}, dist: 0, cond: new Set(), list: [], hi: null, panel: null };
  const COND = [
    ["flat", "평지 위주"], ["dedicated", "전용로 위주"], ["toilet", "화장실 1km 이내"], ["night", "밤 안심"], ["near", "지도 가운데에서 출발"],
  ];
  const fmt = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m / 10) * 10}m`;
  const hav = (a, b) => {
    const r = (d) => d * Math.PI / 180, h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
  };

  function css() {
    const st = document.createElement("style");
    st.textContent = `
      .cp { position: fixed; inset: 0; z-index: 6; pointer-events: none; }
      .cp > * { pointer-events: auto; }
      .cp-top { position: absolute; left: 0; right: 0; top: 0; display: flex; gap: 10px; align-items: center;
        padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 0; }
      .cp-head { flex: 1; min-width: 0; height: 44px; border-radius: 14px; display: flex; flex-direction: column; justify-content: center; padding: 0 14px; }
      .cp-head b { font-size: 15px; } .cp-head small { font-size: 11px; color: var(--ink-2); }
      .cp-sheet { position: absolute; left: 0; right: 0; bottom: 0; max-width: 560px; margin: 0 auto; max-height: 52vh; display: flex; flex-direction: column;
        background: var(--bg); border-radius: 28px 28px 0 0; padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 12px); box-shadow: 0 -10px 40px rgba(0,0,0,.5); }
      .cp-lab { font-size: 12px; color: var(--ink-2); margin: 0 2px 6px; }
      .cp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      .cp-chip { height: 32px; padding: 0 11px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); font-size: 13px; font-weight: 600; color: var(--ink-2); }
      .cp-chip[aria-pressed="true"] { background: var(--lime); border-color: var(--lime); color: var(--lime-ink); }
      .cp-list { overflow-y: auto; overscroll-behavior: contain; min-height: 0; margin: 0 -2px; padding: 0 2px; }
      .cp-card { display: block; width: 100%; text-align: left; background: var(--card); border-radius: 18px; padding: 12px 14px; margin-bottom: 8px; border: 2px solid transparent; }
      .cp-card[aria-current="true"] { border-color: var(--lime); }
      .cp-card .t { display: flex; align-items: center; gap: 8px; }
      .cp-card .rk { width: 22px; height: 22px; flex: none; border-radius: 50%; background: var(--card-2); font-size: 12px; font-weight: 800; display: grid; place-items: center; }
      .cp-card[aria-current="true"] .rk { background: var(--lime); color: var(--lime-ink); }
      .cp-card b { font-size: 15px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cp-card .km { font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
      .cp-badges { display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 8px; }
      .cp-badges span { font-size: 11px; padding: 3px 8px; border-radius: 999px; background: var(--card-2); color: var(--ink-2); }
      .cp-badges span.ok { color: var(--lime); }
      .cp-badges span.warn { color: #ffa94d; }
      .cp-empty { text-align: center; color: var(--ink-2); font-size: 13px; padding: 18px 0; }
      .cp-note { font-size: 11px; color: var(--ink-3); margin: 2px 2px 8px; }
      .cp-go { width: 100%; height: 50px; border-radius: 16px; background: var(--lime); color: var(--lime-ink); font-weight: 800; font-size: 15px; margin-top: 4px; flex: none; }
      .cp-go:disabled { opacity: .4; }
      .cp-alt { border: 2px solid #3ddc97; }
      .cp-alt .rk { background: #3ddc97 !important; color: #0b1a12 !important; }
      .cc-compare { grid-column: 1 / -1; padding: 10px 12px; }
      .cc-compare h3 { margin: 0 0 6px; font-size: 13px; }
      .cc-compare table { width: 100%; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
      .cc-compare th, .cc-compare td { padding: 4px 2px; text-align: center; color: var(--ink-2); }
      .cc-compare th:first-child { text-align: left; font-weight: 600; }
      .cc-compare thead button { width: 100%; padding: 6px 2px; border-radius: 8px; background: var(--card-2); color: var(--ink); font-size: 11px; font-weight: 700; }
      .cc-compare thead button[aria-pressed="true"] { background: var(--lime); color: var(--lime-ink); }
      .cc-compare td.on { color: var(--ink); font-weight: 700; }
      .cc-compare small { display: block; margin-top: 6px; font-size: 10px; color: var(--ink-3); line-height: 1.4; }`;
    document.head.appendChild(st);
  }

  // ---------- 데이터 ----------
  function load(code) {
    if (!S.files.has(code)) S.files.set(code, fetch(`${BASE}${code}.json`).then((r) => r.ok ? r.json() : null)
      .then((d) => { S.data[code] = d && d.courses && d.courses.length ? d.courses : null; return S.data[code]; })
      .catch(() => (S.data[code] = null)));
    return S.files.get(code);
  }
  const has = (code) => !!(S.data[code] && S.data[code].length);

  // 팀 분석 '시설 접근 코스' (원래 추천 코스와 비교용)
  function loadCmp(code) {
    if (!S.cmpFiles.has(code)) S.cmpFiles.set(code, fetch(`${CMP}${code}.json`).then((r) => r.ok ? r.json() : null).then((d) => {
      const a = d && d.alternative;
      const ok = d && d.original && a && a.meters > 0 && Array.isArray(a.route) && a.route.length > 1
        && a.route.every((q) => Array.isArray(q) && q.length === 2 && Math.abs(q[0]) <= 180 && Math.abs(q[1]) <= 90);
      return (S.cmp[code] = ok ? d : null);
    }).catch(() => (S.cmp[code] = null)));
    return S.cmpFiles.get(code);
  }

  // ---------- 코스 바꾸기: 기존 추천 / 시설 접근 / 고른 코스 ----------
  // 지역 데이터(reg)의 route·demo_m 을 바꾸면 코스 화면·START·워치·화장실 간격이 모두 그 코스를 씀
  function variants(reg) {
    const cmp = S.cmp[reg.code], v = [];
    v.push({ key: "base", label: "기존 추천", name: cmp ? "기존 추천 코스" : null, route: reg.route0, m: reg.demo_m0,
             flat: cmp ? cmp.original.flat : null, cov: cmp ? cmp.original.slopeCoverage : null, lit: cmp ? cmp.original.lit : null });
    if (cmp) v.push({ key: "alt", label: "시설 접근", name: "시설 접근 코스", route: cmp.alternative.route, m: cmp.alternative.meters,
                      flat: cmp.alternative.flat, cov: cmp.alternative.slopeCoverage, lit: cmp.alternative.lit });
    if (reg.pick) v.push({ key: "pick", label: "고른 코스", name: reg.pick.name, route: reg.pickRoute, m: reg.pick.m,
                           flat: reg.pick.f, cov: null, lit: null, course: reg.pick });
    return v;
  }
  function apply(reg, v) {
    reg.route = v.route; reg.demo_m = v.m; reg.variant = v.key;
    reg.courseName = v.name; reg.course = v.course || null; reg.courseId = v.key === "pick" ? reg.pick.id : v.key;
  }
  // 코스 화면을 열기 전에: 원래 코스를 보관하고 시설 접근 코스를 불러옴
  async function prepare(reg) {
    if (!reg) return;
    if (!reg.route0) { reg.route0 = reg.route; reg.demo_m0 = reg.demo_m; reg.variant = "base"; }
    await loadCmp(reg.code);
  }
  // 코스 화면 카드 위에 비교표
  function compare(reg) {
    document.querySelector(".cc-compare")?.remove();
    const vs = variants(reg);
    if (vs.length < 2) return;
    const cards = document.querySelector("#course .cards"); if (!cards) return;
    const gaps = vs.map((v) => window.CourseGap?.compute({ ...reg, route: v.route }) || null);
    const pct = (n) => n == null ? "–" : `${n}%`;
    const rows = [
      ["거리", (v) => `${(v.m / 1000).toFixed(1)}km`],
      ["평지 비율", (v) => pct(v.flat)],
      ["화장실 최대 간격 · 낮", (v, i) => gaps[i] ? fmt(gaps[i].day.max) : "–"],
      ["화장실 최대 간격 · 밤", (v, i) => gaps[i] ? fmt(gaps[i].night.max) : "–"],
      ["보안등·CCTV 인접", (v) => pct(v.lit)],
    ];
    if (vs.some((v) => v.cov != null)) rows.splice(2, 0, ["경사 확인 비율", (v) => pct(v.cov)]);
    const el = document.createElement("div");
    el.className = "cc cc-compare";
    el.innerHTML = `<h3>코스 비교 · 눌러서 바꾸기</h3><table>
      <thead><tr><th></th>${vs.map((v) => `<th><button data-v="${v.key}" aria-pressed="${reg.variant === v.key}">${v.label}</button></th>`).join("")}</tr></thead>
      <tbody>${rows.map(([lab, f]) => `<tr><th scope="row">${lab}</th>${vs.map((v, i) => `<td class="${reg.variant === v.key ? "on" : ""}">${f(v, i)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <small>출발점·길이가 다른 코스예요. 화장실은 코스 150m 안, 보안등·CCTV는 50m 기준이에요. 시설 접근 코스는 팀 분석 결과예요.</small>`;
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      const v = vs.find((x) => x.key === b.dataset.v);
      if (v && v.key !== reg.variant) { apply(reg, v); S.api.openCourse(); }
    });
    cards.prepend(el);
    const cur = vs.find((v) => v.key === reg.variant);
    if (cur && cur.key === "alt" && cur.flat != null) document.getElementById("cFlat").textContent = `평지 ${cur.flat}% · 시설 접근`;
  }

  // ---------- 점수 ----------
  // 고른 조건마다 0~1 점수를 더함. '화장실 1km 이내'·'밤 안심'은 맞는 코스가 있으면 그것만 남김
  function rank(courses) {
    const c = S.cond, center = S.map.getCenter().toArray();
    let list = courses.filter((x) => !S.dist || x.km === S.dist);
    const note = [];
    if (c.has("toilet")) {
      const f = list.filter((x) => x.gap != null && x.gap <= 1000);
      if (f.length) list = f; else note.push("화장실 1km 이내 코스가 없어 가까운 순으로 보여줘요");
    }
    if (c.has("night")) {
      const f = list.filter((x) => x.night != null && x.night >= 50);
      if (f.length) list = f; else note.push("밤 안전 50% 넘는 코스가 없어 높은 순으로 보여줘요");
    }
    const score = (x) => {
      let s = 0;
      if (c.has("flat")) s += x.f / 100 * 1.5;
      if (c.has("dedicated")) s += x.a / 100 * 1.5;
      if (c.has("toilet")) s += x.gap == null ? 0 : Math.max(0, 1 - x.gap / 2000) + Math.min(x.t150, 20) / 40;
      if (c.has("night")) s += (x.night || 0) / 100 * 1.5;
      if (c.has("near")) s += Math.max(0, 1 - hav(center, x.start) / 3000) * 2;
      if (!c.size) s += (x.f + x.a) / 200 + (x.gap == null ? 0 : Math.max(0, 1 - x.gap / 2000)) * .5 - x.st / 200;
      return s;
    };
    list = list.map((x) => ({ x, s: score(x) })).sort((p, q) => q.s - p.s).map((o) => o.x).slice(0, 5);
    return { list, note };
  }

  // ---------- 화면 ----------
  function build() {
    const el = document.createElement("div");
    el.className = "cp"; el.hidden = true;
    el.innerHTML = `
      <header class="cp-top"><button class="iconbtn glass" data-a="back" aria-label="뒤로">‹</button>
        <div class="cp-head glass"><b>코스 찾기</b><small data-r="region"></small></div></header>
      <div class="cp-sheet">
        <div class="cp-lab">거리</div>
        <div class="cp-chips" data-r="dist">${[[0, "전체"], [3, "3km"], [5, "5km"], [10, "10km"]].map(([v, t]) =>
          `<button class="cp-chip" data-d="${v}" aria-pressed="${v === 0}">${t}</button>`).join("")}</div>
        <div class="cp-lab">원하는 조건 (여러 개 골라도 돼요)</div>
        <div class="cp-chips" data-r="cond">${COND.map(([k, t]) => `<button class="cp-chip" data-c="${k}" aria-pressed="false">${t}</button>`).join("")}</div>
        <div class="cp-note" data-r="note" hidden></div>
        <div class="cp-list" data-r="list"></div>
        <button class="cp-go" data-a="go" disabled>이 코스로 보기</button>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.a === "back") return close();
      if (b.dataset.a === "go") return choose(S.list.find((x) => x.id === S.hi));
      if (b.dataset.d != null) { S.dist = +b.dataset.d; refresh(); return; }
      if (b.dataset.c) { S.cond.has(b.dataset.c) ? S.cond.delete(b.dataset.c) : S.cond.add(b.dataset.c); refresh(); return; }
      if (b.dataset.alt) return chooseAlt();
      if (b.dataset.id) { highlight(+b.dataset.id, true); }
    });
    S.panel = el;
  }
  const q = (k) => S.panel.querySelector(`[data-r="${k}"]`);

  function badges(x) {
    const b = [`평지 ${x.f}%`, `전용로 ${x.a}%`];
    // gap = 코스 위 어디에 있든 가장 가까운 화장실까지 직선거리의 최댓값
    if (x.gap != null) b.push(`<span class="${x.gap <= 700 ? "ok" : x.gap > 1500 ? "warn" : ""}">어디서든 화장실 ${fmt(x.gap)} 안</span>`);
    b.push(`화장실 ${x.t150}곳`);
    if (x.night != null) b.push(`<span class="${x.night >= 60 ? "ok" : ""}">밤 안전 ${x.night}%</span>`);
    if (x.climb) b.push(`오르막 약 ${x.climb}m`);
    return b.map((s) => s.startsWith("<span") ? s : `<span>${s}</span>`).join("");
  }
  function refresh() {
    S.panel.querySelectorAll("[data-d]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.d === S.dist)));
    S.panel.querySelectorAll("[data-c]").forEach((b) => b.setAttribute("aria-pressed", String(S.cond.has(b.dataset.c))));
    const all = S.data[S.app.cur] || [];
    const nightBtn = S.panel.querySelector('[data-c="night"]');
    nightBtn.hidden = !all.some((x) => x.night != null);
    const { list, note } = rank(all);
    S.list = list;
    q("note").hidden = !note.length; q("note").textContent = note.join(" · ");
    const cmp = S.cmp[S.app.cur], alt = cmp && cmp.alternative;
    const altCard = alt ? `
      <button class="cp-card cp-alt" data-alt="1" aria-current="false">
        <div class="t"><span class="rk">★</span><b>시설 접근 코스 · 팀 분석</b><span class="km">${(alt.meters / 1000).toFixed(1)}km</span></div>
        <div class="cp-badges"><span class="ok">평지 ${alt.flat}%</span><span>보안등·CCTV ${alt.lit}%</span><span>화장실·밝은 길 우선</span></div></button>` : "";
    q("list").innerHTML = altCard + (list.length ? list.map((x, i) => `
      <button class="cp-card" data-id="${x.id}" aria-current="false">
        <div class="t"><span class="rk">${i + 1}</span><b>${x.name}</b><span class="km">약 ${Math.round(x.m / 1000 * 6)}분</span></div>
        <div class="cp-badges">${badges(x)}</div></button>`).join("")
      : `<div class="cp-empty">이 거리에는 코스가 없어요. 다른 거리를 골라 보세요.</div>`);
    highlight(list[0] ? list[0].id : null, false);
    pad();                                                   // 정보창 높이만큼 지도 여백을 먼저 잡고
    drawLines();                                             // 그 안에 코스가 다 보이게 맞춤
  }
  function drawLines() {
    const fs = S.list.map((x, i) => ({ type: "Feature", properties: { id: x.id, rank: i },
      geometry: { type: "LineString", coordinates: S.api.decode(x.poly) } }));
    S.map.getSource("cp-courses").setData({ type: "FeatureCollection", features: fs });
    if (fs.length) {
      const b = new maplibregl.LngLatBounds(fs[0].geometry.coordinates[0], fs[0].geometry.coordinates[0]);
      fs.forEach((f) => f.geometry.coordinates.forEach((c) => b.extend(c)));
      S.map.fitBounds(b, { padding: 30, pitch: 0, bearing: 0, duration: 800, maxZoom: 15.5 });
    }
  }
  function highlight(id, scroll) {
    S.hi = id;
    S.map.setFilter("cp-hi", ["==", ["get", "id"], id == null ? -1 : id]);
    S.panel.querySelectorAll(".cp-card").forEach((c) => c.setAttribute("aria-current", String(+c.dataset.id === id)));
    const go = S.panel.querySelector('[data-a="go"]');
    go.disabled = id == null;
    if (scroll) S.panel.querySelector(`.cp-card[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function pad() {
    if (!S.panel || S.panel.hidden) return;
    S.map.setPadding({ top: 70, bottom: S.panel.querySelector(".cp-sheet").offsetHeight + 10, left: 0, right: 0 });
  }

  async function open() {
    const code = S.app.cur; if (!code) return;
    await Promise.all([load(code), loadCmp(code)]);
    if (!has(code) && !S.cmp[code]) return S.api.openCourse();   // 코스 파일이 없으면 예전처럼 기본 코스
    q("region").textContent = `${S.app.byCode[code].label} · 코스 ${(S.data[code] || []).length}개 중에서`;
    document.getElementById("home").hidden = true;
    S.panel.hidden = false; S.app.picking = true;
    S.map.setLayoutProperty("cp-line", "visibility", "visible");
    S.map.setLayoutProperty("cp-hi", "visibility", "visible");
    S.map.setPaintProperty("run-inner", "line-opacity", .3);
    refresh();
  }
  function close(keepHome) {
    S.panel.hidden = true; S.app.picking = false;
    S.map.setLayoutProperty("cp-line", "visibility", "none");
    S.map.setLayoutProperty("cp-hi", "visibility", "none");
    if (!keepHome) { S.api.show("home"); S.map.easeTo({ pitch: 45, duration: 600 }); }
  }
  // 고른 코스를 이 지역의 '지금 코스'로 → 코스 화면·START·워치·화장실 간격이 모두 이 코스를 씀
  async function choose(x) {
    if (!x) return;
    const reg = await S.api.loadRegion(S.app.cur).catch(() => null);
    if (!reg) return;
    await prepare(reg);
    reg.pick = x; reg.pickRoute = S.api.decode(x.poly);
    apply(reg, variants(reg).find((v) => v.key === "pick"));
    close(true);
    S.api.openCourse();
  }
  async function chooseAlt() {
    const reg = await S.api.loadRegion(S.app.cur).catch(() => null);
    if (!reg) return;
    await prepare(reg);
    const v = variants(reg).find((x) => x.key === "alt");
    if (!v) return;
    apply(reg, v);
    close(true);
    S.api.openCourse();
  }
  function home(reg) {
    if (!reg) return;
    load(reg.code).then(() => {
      if (S.app.cur !== reg.code || !has(reg.code) || S.app.screen !== "home") return;
      const n = S.data[reg.code].length;
      document.getElementById("courseRow").disabled = false;
      document.getElementById("courseName").textContent = reg.courseName ? `선택한 코스: ${reg.courseName}` : `코스 ${n}개 중에서 골라 달리기`;
      document.getElementById("courseInfo").textContent = "거리·평지·전용로·화장실·밤 안전 조건으로 추천해요";
    });
  }

  function init(map, app, api) {
    S.map = map; S.app = app; S.api = api;
    css(); build();
    map.addSource("cp-courses", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const top = (map.getStyle().layers.find((l) => /^poi-/.test(l.id)) || {}).id;      // 시설 아이콘 아래, 다른 길 위
    map.addLayer({ id: "cp-line", type: "line", source: "cp-courses", layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
      paint: { "line-color": "#ffffff", "line-opacity": .55, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 16, 5] } }, top);
    map.addLayer({ id: "cp-hi", type: "line", source: "cp-courses", filter: ["==", ["get", "id"], -1], layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
      paint: { "line-color": LIME, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 9] } }, top);
    map.on("click", "cp-line", (e) => { if (!S.panel.hidden && e.features[0]) highlight(e.features[0].properties.id, true); });
    map.on("mouseenter", "cp-line", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "cp-line", () => { map.getCanvas().style.cursor = ""; });
    window.addEventListener("resize", pad);
  }
  return { init, home, has, open, load, prepare, compare };
})();
