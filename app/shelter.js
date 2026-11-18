/* 무더위·한파 쉼터 (담당: 화장실 공공데이터 / 2차 계획 ①)
 * 계절에 맞는 쉼터만 지도에 표시: 여름(5/20~9/30) 무더위쉼터 🏠 · 겨울(11/15~3/15) 한파쉼터 🏠, 그 밖의 기간엔 표시 안 함
 *   - 데이터: data/shelter/heat_<시도>.json, cold_<시도>.json (행정안전부 재난안전데이터 공유플랫폼)
 *     index.json 의 시도별 범위를 보고, 지금 화면에 걸친 시도 파일만 불러옴 (줌 13 이상)
 *   - 쉼터를 누르면 평일 운영시간 · 주말/야간 개방 · 비고를 보여줌
 *   - 홈 화면 시설 칩(🏠 쉼터)으로 켜고 끔 → poi_filter.js 가 'shelter' 층을 보이기/숨기기
 *   - 발표·시연용: 주소 끝에 &season=heat 또는 &season=cold 를 붙이면 계절과 상관없이 그 쉼터를 보여줌
 * index.html 은 init(map) 만 부른다   (이 파일이 없어도 앱은 그대로 동작)
 */
window.ShelterLayer = (() => {
  const BASE = "data/shelter/";
  const MIN_ZOOM = 13;
  const S = { map: null, season: null, index: null, loaded: new Map(), pending: new Set() };
  const INFO = {
    heat: { name: "무더위쉼터", color: "#ff8a3d" },
    cold: { name: "한파쉼터", color: "#5bb8ff" },
  };

  function season(d = new Date()) {
    const q = new URLSearchParams(location.search).get("season");
    if (q === "heat" || q === "cold") return q;
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    if (md >= 520 && md <= 930) return "heat";
    if (md >= 1115 || md <= 315) return "cold";
    return null;
  }

  function icon(map, color) {
    const size = 28, pr = 2, c = document.createElement("canvas");
    c.width = c.height = size * pr;
    const g = c.getContext("2d"); g.scale(pr, pr);
    g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2.5, 0, Math.PI * 2);
    g.fillStyle = "#17191c"; g.fill(); g.lineWidth = 2.5; g.strokeStyle = color; g.stroke();
    g.font = `${Math.round(size * .5)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("🏠", size / 2, size / 2 + 1);
    map.addImage("poi-shelter", g.getImageData(0, 0, c.width, c.height), { pixelRatio: pr });
  }

  function features() {
    const out = [];
    for (const pts of S.loaded.values())
      for (const [n, x, y, h, w, nt, rm] of pts)
        out.push({ type: "Feature", properties: { n, h, w, nt, rm }, geometry: { type: "Point", coordinates: [x, y] } });
    return { type: "FeatureCollection", features: out };
  }

  async function loadVisible() {
    const map = S.map;
    if (!S.index || map.getZoom() < MIN_ZOOM) return;
    const b = map.getBounds();
    const want = Object.entries(S.index).filter(([code, [x0, y0, x1, y1]]) =>
      !(x1 < b.getWest() || x0 > b.getEast() || y1 < b.getSouth() || y0 > b.getNorth())).map(([code]) => code);
    const todo = want.filter((c) => !S.loaded.has(c) && !S.pending.has(c));
    if (!todo.length) return;
    todo.forEach((c) => S.pending.add(c));
    await Promise.all(todo.map(async (c) => {
      try {
        const r = await fetch(`${BASE}${S.season}_${c}.json`);
        if (r.ok) S.loaded.set(c, await r.json());
      } catch (e) { /* 오프라인 등: 다음 이동 때 다시 시도 */ }
      S.pending.delete(c);
    }));
    map.getSource("shelter")?.setData(features());
  }

  function popup(p) {
    const info = INFO[S.season];
    const lines = [];
    lines.push(p.h ? `평일 ${p.h}` : "운영시간 정보 없음 (방문 전 확인)");
    const extra = [];
    if (p.w === "Y") extra.push("주말·휴일 운영"); else if (p.w === "N") extra.push("주말·휴일 쉼");
    if (p.nt === "Y") extra.push("야간 개방"); else if (p.nt === "N") extra.push("야간 닫힘");
    if (extra.length) lines.push(extra.join(" · "));
    if (p.rm) lines.push(`<span style="color:#9aa1a8">${p.rm}</span>`);
    return `🏠 <b style="color:${info.color}">${info.name}</b><br>${p.n}` +
      `<div style="margin-top:6px;font-size:12px;line-height:1.6">${lines.join("<br>")}</div>`;
  }

  async function init(map) {
    S.season = season();
    if (!S.season) return;                        // 쉼터 운영 기간이 아니면 아무것도 안 함
    S.map = map;
    try {
      const r = await fetch(BASE + "index.json");
      if (!r.ok) return;
      S.index = (await r.json())[S.season] || null;
    } catch (e) { return; }
    if (!S.index) return;
    icon(map, INFO[S.season].color);
    map.addSource("shelter", { type: "geojson", data: features() });
    const before = map.getLayer("poi-other") ? "poi-other" : undefined;   // 화장실·편의점 아이콘보다 아래
    const hidden = window.PoiFilter?.hidden?.() || [];
    map.addLayer({ id: "shelter", type: "symbol", source: "shelter", minzoom: MIN_ZOOM,
      layout: { "icon-image": "poi-shelter", "icon-allow-overlap": true, "visibility": hidden.includes("shelter") ? "none" : "visible",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 13, .6, 17, .95] } }, before);
    map.on("click", "shelter", (e) => {
      new maplibregl.Popup({ closeButton: false, offset: 14 }).setLngLat(e.features[0].geometry.coordinates)
        .setHTML(popup(e.features[0].properties)).addTo(map);
    });
    map.on("mouseenter", "shelter", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "shelter", () => { map.getCanvas().style.cursor = ""; });
    map.on("moveend", loadVisible);
    loadVisible();
  }

  return { init, season: () => S.season || season(), name: () => (INFO[season()] || {}).name };
})();
