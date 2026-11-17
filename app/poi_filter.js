/* 시설 켜고 끄기 (담당: 화장실 공공데이터 / 보고서 '문제점 ① 지도 정보 과밀' 해결)
 * 홈 화면 지역 선택 아래에 칩을 두고, 눌러서 화장실·음수대·편의점·경찰·신호를 지도에서 켜고 끔 (설정 기억)
 *   - 화장실·음수대·편의점·경찰(OSM): 같은 poi 층 안의 종류라 '필터'로 숨김
 *     다른 기능(밤 안심모드, 안전시설 레이어)이 정한 필터는 그대로 두고, 그 위에 '숨긴 종류 빼기'만 덧붙임
 *   - 신호: 안전시설 레이어의 신호 층(sf-signal)을 통째로 보이기/숨기기
 *   - 숨긴 시설은 지도에서만 빠짐. 달리는 중 '다음 화장실' 안내, 워치 알림, 음성 안내는 그대로 동작
 * index.html 은 init(map) 만 부른다   (이 파일이 없어도 앱은 그대로 동작)
 */
window.PoiFilter = (() => {
  const KINDS = [
    { k: "toilet", ic: "🚻", name: "화장실" },
    { k: "water", ic: "💧", name: "음수대" },
    { k: "store", ic: "🏪", name: "편의점" },
    { k: "police", ic: "👮", name: "경찰" },
    { k: "signal", ic: "🚦", name: "신호" },
  ];
  const POI_LAYERS = ["poi-toilet", "poi-other"];
  const S = { map: null, hidden: new Set(), base: {}, chips: new Map() };

  try { (JSON.parse(localStorage.getItem("runnavi-hide") || "[]")).forEach((k) => S.hidden.add(k)); } catch (e) {}

  // 다른 기능이 정한 필터(base) + 숨긴 종류 빼기
  function combined(id) {
    const hide = [...S.hidden].filter((k) => k !== "signal");
    const base = S.base[id];
    if (!hide.length) return base;
    const notHidden = ["!", ["in", ["get", "t"], ["literal", hide]]];
    return base ? ["all", base, notHidden] : notHidden;
  }

  function apply() {
    const map = S.map;
    for (const id of POI_LAYERS) if (map.getLayer(id)) S.origSetFilter(id, combined(id));
    if (map.getLayer("sf-signal")) map.setLayoutProperty("sf-signal", "visibility", S.hidden.has("signal") ? "none" : "visible");
    for (const [k, el] of S.chips) el.setAttribute("aria-pressed", S.hidden.has(k) ? "false" : "true");
    try { localStorage.setItem("runnavi-hide", JSON.stringify([...S.hidden])); } catch (e) {}
  }

  function addUi() {
    const head = document.querySelector(".home-top");
    if (!head) return;
    const st = document.createElement("style");
    st.textContent = `.pf-row { display: flex; gap: 6px; margin-top: 10px; overflow-x: auto; scrollbar-width: none; }
      .pf-row::-webkit-scrollbar { display: none; }
      .pf-chip { flex: none; height: 32px; padding: 0 11px; border-radius: 16px; font-size: 13px; font-weight: 600;
        background: var(--card); border: 1px solid var(--line); color: var(--ink-3, #7d848c); display: flex; align-items: center; gap: 4px; }
      .pf-chip[aria-pressed="true"] { color: var(--ink, #f1f3f5); border-color: var(--lime, #c8f25b); background: var(--card-2); }
      .pf-chip[aria-pressed="false"] span { filter: grayscale(1); opacity: .55; }`;
    document.head.appendChild(st);
    const row = document.createElement("div");
    row.className = "pf-row"; row.setAttribute("role", "group"); row.setAttribute("aria-label", "지도에 보일 시설");
    for (const { k, ic, name } of KINDS) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "pf-chip";
      b.innerHTML = `<span aria-hidden="true">${ic}</span>${name}`;
      b.onclick = () => { S.hidden.has(k) ? S.hidden.delete(k) : S.hidden.add(k); apply(); };
      S.chips.set(k, b); row.appendChild(b);
    }
    head.appendChild(row);
  }

  function init(map) {
    S.map = map;
    for (const id of POI_LAYERS) S.base[id] = map.getFilter(id);
    // 밤 안심모드·안전시설 레이어가 필터를 바꿀 때도 숨긴 종류가 계속 빠지도록, 그 값을 base 로 받아 다시 합침
    S.origSetFilter = map.setFilter.bind(map);
    map.setFilter = (id, filter, opts) => {
      if (POI_LAYERS.includes(id)) { S.base[id] = filter; return S.origSetFilter(id, combined(id), opts); }
      return S.origSetFilter(id, filter, opts);
    };
    map.getFilter = ((orig) => (id) => POI_LAYERS.includes(id) ? S.base[id] : orig(id))(map.getFilter.bind(map));
    addUi();
    apply();
    // 신호 층은 안전시설 레이어가 조금 늦게 만들 수 있어서 잠깐 뒤 한 번 더 맞춤
    setTimeout(apply, 1500);
  }

  return { init, hidden: () => [...S.hidden] };
})();
