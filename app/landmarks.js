/* 랜드마크 라벨 (위치 파악용) — 3D 건물 사이에서도 지금 어디쯤인지 알 수 있게
 * index.html: <script src="landmarks.js"></script> + 지도 load 끝에 LandmarkLayer.init(map)  (없어도 앱 동작)
 *
 * 10종류: 필수 6 (역 · 강/하천 · 다리 · 공원 · 큰 병원 · 대학교/시청·구청) + 선택 4 (경기장 · 명소/박물관 · 산 · 백화점/쇼핑몰)
 * 데이터: 배경지도와 같은 OpenFreeMap(OpenStreetMap) 타일 + 다리 위치 파일(../safety/bridges.geojson, OSM)
 * 모양: 흰 글씨 + 검은 테두리 + 종류별 아이콘. 낮/밤 테마가 바뀌어도 그대로 (소스 이름을 sf- 로 시작해 테마 변경에서 제외됨)
 */
window.LandmarkLayer = (() => {
  const TILES = "https://tiles.openfreemap.org/planet";
  const BRIDGES = "../safety/bridges.geojson";
  const FONT = ["Noto Sans Bold"];
  const NAME = ["coalesce", ["get", "name:ko"], ["get", "name"]];
  const has = (word) => ["in", word, ["coalesce", ["get", "name"], ""]];
  const any = (...words) => ["any", ...words.map(has)];

  // 아이콘: [이모지, 테두리 색]
  const ICONS = {
    station: ["🚇", "#4dabf7"], river: ["🌊", "#74c0fc"], bridge: ["🌉", "#ced4da"], park: ["🌳", "#51cf66"],
    hospital: ["🏥", "#ff6b6b"], college: ["🎓", "#cc5de8"], townhall: ["🏛", "#ffd43b"], stadium: ["🏟", "#ff922b"],
    sight: ["📍", "#f783ac"], peak: ["⛰", "#a9e34b"], mall: ["🛍", "#fab005"],
  };

  // 겹칠 때 아래쪽(먼저 넣는 것)일수록 덜 중요 → 중요도가 낮은 것부터 넣음
  const LAYERS = [
    { id: "mall", min: 15, src: "omt", sl: "poi",
      filter: ["all", ["has", "name"], ["any", ["==", ["get", "subclass"], "department_store"],
                      ["all", ["==", ["get", "subclass"], "mall"], any("백화점", "아울렛", "쇼핑", "몰")]]] },
    { id: "peak", min: 12, src: "omt", sl: "mountain_peak", filter: ["has", "name"] },
    // 명소: 궁·성(castle)은 중간 줌부터, 박물관·기념물 등은 많이 확대했을 때만 (도심에서 너무 빽빽해지지 않게)
    { id: "sight", min: 14, src: "omt", sl: "poi",
      filter: ["all", ["has", "name"], ["any", ["==", ["get", "class"], "castle"],
                      ["all", [">=", ["zoom"], 16], ["in", ["get", "class"], ["literal", ["attraction", "museum", "monument"]]]]]] },
    { id: "stadium", min: 14, src: "omt", sl: "poi",
      filter: ["all", ["has", "name"], ["any", ["==", ["get", "class"], "stadium"],
                                             ["in", ["get", "subclass"], ["literal", ["stadium", "sports_centre"]]]],
                      any("경기장", "운동장", "체육관", "체육센터", "스타디움", "야구장", "축구장", "돔", "체육공원")] },
    { id: "townhall", min: 13, src: "omt", sl: "poi",
      filter: ["all", ["in", ["get", "class"], ["literal", ["town_hall", "office"]]],
                      any("시청", "구청", "군청", "도청"), ["!", any("주민센터", "민원", "별관", "보건", "청사")]] },
    { id: "college", min: 14, src: "omt", sl: "poi",
      // 대학 본체만: '○○대학교'·'○○대학교 ○○캠퍼스'. 건물(○○관)·조형물·동아리·부속학교는 제외
      filter: ["all", ["==", ["get", "class"], "college"], ["==", ["get", "subclass"], "university"], any("대학교", "캠퍼스"),
                      ["!", any("부속", "조형물", "OB", "동아리", "학회", "기숙사", "주차장")],
                      ["!=", ["slice", ["get", "name"], ["-", ["length", ["get", "name"]], 1]], "관"]] },
    { id: "hospital", min: 14, src: "omt", sl: "poi",
      filter: ["all", ["==", ["get", "class"], "hospital"], any("병원", "의료원"),
                      ["!", any("성형", "한방", "한의", "요양", "치과", "동물", "피부", "의원")]] },
    { id: "park", min: 14, src: "omt", sl: "poi",
      filter: ["all", ["==", ["get", "class"], "park"], ["has", "name"], ["!", any("어린이공원", "소공원", "쌈지", "놀이터")]] },
    { id: "river", min: 11, src: "omt", sl: "waterway", line: true,
      filter: ["all", ["has", "name"], ["any", ["in", ["get", "class"], ["literal", ["river", "canal"]]],
                                             ["all", [">=", ["zoom"], 14], ["==", ["get", "class"], "stream"]]]] },
    { id: "bridge", min: 12, src: "bridges",
      filter: ["any", ["==", ["get", "major"], true], [">=", ["zoom"], 15]] },
    { id: "station", min: 13, src: "omt", sl: "poi",
      filter: ["all", ["has", "name"], ["in", ["get", "class"], ["literal", ["railway", "rail"]]],
                      ["in", ["get", "subclass"], ["literal", ["subway", "station", "halt", "train_station"]]]],
      // '노량진' → '노량진역' (이름에 '역'이 없으면 붙임)
      text: ["case", ["in", "역", NAME], NAME, ["concat", NAME, "역"]] },
  ];

  function addIcons(map) {
    for (const [k, [emoji, color]] of Object.entries(ICONS)) {
      const size = 26, pr = 2, c = document.createElement("canvas");
      c.width = c.height = size * pr;
      const g = c.getContext("2d"); g.scale(pr, pr);
      g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      g.fillStyle = "#111315"; g.fill(); g.lineWidth = 2; g.strokeStyle = color; g.stroke();
      g.font = `${Math.round(size * .52)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(emoji, size / 2, size / 2 + 1);
      if (!map.hasImage(`lm-${k}`)) map.addImage(`lm-${k}`, g.getImageData(0, 0, c.width, c.height), { pixelRatio: pr });
    }
  }

  let MAP = null;
  function init(map) {
    if (!map || map.getSource("sf-lm-omt")) return;
    MAP = map;
    addIcons(map);
    map.addSource("sf-lm-omt", { type: "vector", url: TILES });                 // 배경지도와 같은 타일 (브라우저 캐시 공유)
    map.addSource("sf-lm-bridges", { type: "geojson", data: BRIDGES });
    for (const L of LAYERS) {
      const layer = {
        id: `lm-${L.id}`, type: "symbol", minzoom: L.min,
        source: L.src === "bridges" ? "sf-lm-bridges" : "sf-lm-omt",
        filter: L.filter,
        layout: {
          "icon-image": `lm-${L.id}`,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 12, .6, 17, .85],
          "text-field": L.text || NAME,
          "text-font": FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 16, 13, 18, 15],
          "text-anchor": "left", "text-offset": [1.1, 0], "text-max-width": 9,
          "text-padding": 4, "icon-padding": 2,
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "#000000", "text-halo-width": 1.6, "text-halo-blur": .2 },
      };
      if (L.sl) layer["source-layer"] = L.sl;
      if (L.line) {                                    // 강·하천: 물길을 따라 이름, 아이콘은 똑바로
        Object.assign(layer.layout, { "symbol-placement": "line", "symbol-spacing": 450, "text-anchor": "center",
          "text-offset": [0, 0], "icon-rotation-alignment": "viewport", "text-rotation-alignment": "map", "icon-offset": [-22, 0] });
        delete layer.layout["text-max-width"];
      }
      try { map.addLayer(layer); } catch (e) { console.warn("랜드마크 층", L.id, e); }
    }
  }

  function setVisible(on) {                         // 다른 파일(예: 시설 켜고 끄기)에서 쓸 수 있게
    const map = MAP;
    if (!map) return;
    for (const L of LAYERS) map.getLayer(`lm-${L.id}`) && map.setLayoutProperty(`lm-${L.id}`, "visibility", on ? "visible" : "none");
  }
  return { init, setVisible, types: LAYERS.map((l) => l.id) };
})();
