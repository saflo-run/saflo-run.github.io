/* 러닝 가이드: 대회 일정 + 전국 추천 코스 (담당: 화장실 공공데이터 / 진짜 러너·여행 러너용)
 *   - 대회 일정: 다가오는 주요 마라톤을 월별로. '확정'(주최 측 발표 날짜)과 '예년 기준'(아직 발표 전, 작년 날짜로 시기만 안내)을 구분
 *     지난 대회는 자동으로 숨김. 접수·날짜는 바뀔 수 있어 각 대회 공식 공지 확인 안내
 *   - 추천 코스: 전국 유명 러닝 코스. 지금 지도 가운데에서 가까운 순으로 보여 주고, 누르면 지도에서 그 출발점으로 이동
 *     (이동하면 그 지역의 화장실·쉼터·밤 안심 정보가 그대로 같이 보임)
 * 데이터는 이 파일 안에 있음 (조사: 2026-11, 출처는 아래 RACES 주석). 고칠 땐 이 파일만 바꾸면 됨
 * index.html 은 init(map, state) 만 부른다   (이 파일이 없어도 앱은 그대로 동작)
 */
window.RunGuide = (() => {
  // ---------- 대회 ----------
  // d: 날짜(확정) 또는 m: 달(예년 기준) · when: 예년 기준일 때 보여 줄 시기 · where · km
  // 2027 확정 날짜: kormarathon.com 2027 일정, runningwikii 2027 일정 / 예년 기준: 2026 개최일 (dategom 2026 월별 정리 등)
  const RACES = [
    { d: "2026-12-13", name: "진주마라톤", where: "경남 진주 · 진주노을공원", km: "풀·하프·10km" },
    { d: "2027-01-01", name: "새해일출런", where: "서울 · 신정교 하부 육상트랙", km: "10km·5km" },
    { d: "2027-01-10", name: "여수해양마라톤", where: "전남 여수", km: "풀·하프·10km·5km" },
    { d: "2027-01-23", name: "북극곰 마라톤", where: "서울 · 신정교 하부", km: "하프·10km·5km" },
    { d: "2027-02-14", name: "해남땅끝 전국마라톤", where: "전남 해남 · 대흥사 쉼터 일원", km: "풀·하프·10km·5km" },
    { d: "2027-02-21", name: "청주 무심천 투데이 마라톤", where: "충북 청주 · 무심천", km: "풀·하프·10km·5km" },
    { d: "2027-02-28", name: "대구마라톤", where: "대구 · 국채보상운동기념공원", km: "풀·10km", big: true },
    { d: "2027-02-28", name: "고구려 마라톤", where: "서울 · 뚝섬한강공원", km: "풀·32km·하프·10km" },
    { d: "2027-02-28", name: "경기수원국제하프마라톤", where: "경기 수원 · 수원종합운동장", km: "하프·10km·5km" },
    { d: "2027-03-14", name: "부산다대포마라톤", where: "부산 · 다대포", km: "하프·10km·5km" },
    { d: "2027-03-21", name: "서울마라톤 (동아마라톤)", where: "서울 · 풀 광화문광장 / 10km 잠실종합운동장", km: "풀·10km", big: true },
    { d: "2027-04-11", name: "인천 K-마라톤", where: "인천 · 아시아드주경기장(예정)", km: "풀·10km·5km" },
    { d: "2027-04-18", name: "오션뷰 기장바다마라톤", where: "부산 · 오시리아 일원", km: "하프·10km·3km" },
    { m: "2027-04", when: "4월 초 (2026년 4/4)", name: "경주벚꽃마라톤", where: "경북 경주 · 보문 일원", km: "하프·10km·5km" },
    { m: "2027-04", when: "4월 중순 (2026년 4/19)", name: "DMZ 평화마라톤", where: "경기 파주 · 임진각 평화누리", km: "하프·10km·5km" },
    { m: "2027-04", when: "4월 말 (2026년 4/26)", name: "서울하프마라톤", where: "서울 · 광화문 → 상암 월드컵공원", km: "하프·10km", big: true },
    { m: "2027-04", when: "4월 말 (2026년 4/26)", name: "제주국제마라톤", where: "제주 · 제주대학교 대운동장", km: "풀·하프·10km" },
    { m: "2027-06", when: "6월 초 (2026년 6/7)", name: "코리아 오픈 마라톤", where: "서울 · 여의도공원", km: "하프·10km·5km" },
    { m: "2027-09", when: "9월 (2026년 9/20)", name: "공주백제마라톤", where: "충남 공주", km: "풀·32km·하프·10km·5km" },
    { d: "2027-10-16", name: "경포마라톤", where: "강원 강릉 · 경포", km: "하프·10km" },
    { m: "2027-10", when: "10월 말 (2026년 10/25)", name: "춘천마라톤", where: "강원 춘천 · 의암호 일원", km: "풀·10km", big: true },
    { m: "2027-11", when: "11월 초 (2026년 11/1)", name: "JTBC 서울마라톤", where: "서울 · 상암 월드컵공원", km: "풀·10km", big: true },
    { m: "2027-11", when: "11월 (2026년 11/22)", name: "김대중마라톤", where: "전남 목포 · 목포종합경기장", km: "풀·하프·10km" },
  ];

  // ---------- 추천 코스 ----------
  // [이름, 도시, 경도, 위도, 한 줄 소개]   좌표는 출발하기 좋은 지점(대략)
  const COURSES = [
    ["반포·잠수교 한강 코스", "서울 서초", 126.9960, 37.5110, "달빛무지개분수 옆 출발, 잠수교 건너 한강 양쪽을 도는 평지 코스"],
    ["여의도 한강공원", "서울 영등포", 126.9330, 37.5284, "여의나루역 바로 앞, 넓고 평평해 기록 연습하기 좋음"],
    ["남산 북측순환로", "서울 중구", 126.9900, 37.5545, "차 없는 숲길, 완만한 오르막으로 언덕 훈련에 인기"],
    ["석촌호수", "서울 송파", 127.1040, 37.5097, "한 바퀴 약 2.5km 호수 루프, 밤에도 밝음"],
    ["올림픽공원", "서울 송파", 127.1214, 37.5206, "넓은 공원 외곽을 크게 도는 코스, 주말 러닝크루 성지"],
    ["서울숲", "서울 성동", 127.0374, 37.5444, "숲길과 중랑천·한강 연결, 짧게도 길게도 가능"],
    ["청계천", "서울 종로", 126.9779, 37.5694, "청계광장에서 물길 따라 동쪽으로, 도심 속 평지"],
    ["일산 호수공원", "경기 고양", 126.7690, 37.6580, "호수 둘레를 도는 평지 루프, 초보에게 추천"],
    ["광교호수공원", "경기 수원", 127.0650, 37.2835, "원천호수·신대호수를 잇는 수변 데크 코스"],
    ["송도 센트럴파크", "인천 연수", 126.6390, 37.3925, "수로 따라 고층 빌딩 사이를 달리는 야경 코스"],
    ["의암호 (공지천)", "강원 춘천", 127.7140, 37.8760, "춘천마라톤 코스 일부, 호수 바람 맞으며 달리는 길"],
    ["경포호", "강원 강릉", 128.8970, 37.7960, "호수 한 바퀴 평지, 바로 옆 경포해변까지 연결"],
    ["세종호수공원", "세종", 127.2730, 36.4980, "호수 둘레 산책로, 정부청사 옥상정원 쪽으로 이어짐"],
    ["갑천 (엑스포다리)", "대전 유성", 127.3880, 36.3720, "엑스포다리 아래 강변을 따라 길게 이어지는 평지"],
    ["전주천 · 한옥마을", "전북 전주", 127.1530, 35.8150, "한옥마을 옆 전주천 산책로, 여행 중 아침 러닝"],
    ["풍암호수공원", "광주 서구", 126.8770, 35.1265, "호수 둘레 루프, 동네 러너들이 많이 찾는 곳"],
    ["수성못", "대구 수성", 128.6170, 35.8280, "한 바퀴 약 2km 호수 루프, 밤 조명이 예쁨"],
    ["보문호", "경북 경주", 129.2860, 35.8460, "호수 둘레 순환길, 봄엔 벚꽃 러닝 명소"],
    ["태화강 국가정원", "울산 중구", 129.2990, 35.5480, "십리대숲 옆 강변 평지, 울산 대표 러닝 코스"],
    ["광안리 해변", "부산 수영", 129.1186, 35.1532, "광안대교 보며 달리는 해변 산책로, 야경 최고"],
    ["해운대 · 동백섬", "부산 해운대", 129.1520, 35.1531, "해변 따라 달리다 동백섬 한 바퀴"],
    ["온천천 시민공원", "부산 동래", 129.0880, 35.2047, "도심을 가로지르는 하천 산책로, 길고 평평함"],
    ["이순신광장 · 해양공원", "전남 여수", 127.7400, 34.7380, "밤바다 보며 달리는 해안 산책로"],
    ["탑동 · 용두암 해안", "제주 제주시", 126.5250, 33.5160, "바다 옆 해안도로, 여행 첫날 가볍게 뛰기 좋음"],
  ];

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  let map = null, state = null, marker = null;
  const S = { tab: "race" };

  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d || 1); };
  const W = ["일", "월", "화", "수", "목", "금", "토"];

  function upcoming(now = today()) {
    return RACES.filter((r) => {
      if (r.d) return parse(r.d) >= now;
      const end = parse(r.m); end.setMonth(end.getMonth() + 1);   // 그 달이 끝나기 전까지 보여 줌
      return end > now;
    }).sort((a, b) => parse(a.d || a.m) - parse(b.d || b.m) || (a.d ? -1 : 1));
  }

  function hav(a, b) {
    const r = (x) => x * Math.PI / 180;
    const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function nearby() {
    const c = map ? map.getCenter() : { lng: 127.0, lat: 37.5 };
    return COURSES.map((x) => ({ x, km: hav([c.lng, c.lat], [x[2], x[3]]) })).sort((a, b) => a.km - b.km);
  }

  function css() {
    const s = document.createElement("style");
    s.textContent = `
    #rgPanel{position:fixed;inset:0;z-index:60;background:var(--bg);display:flex;flex-direction:column;max-width:560px;margin:0 auto}
    #rgPanel[hidden]{display:none}
    .rg-head{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 16px 10px}
    .rg-head h2{flex:1;margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}
    .rg-head small{display:block;font-size:12px;color:var(--ink-2);font-weight:500}
    .rg-x{width:40px;height:40px;border-radius:12px;background:var(--card);font-size:20px}
    .rg-tabs{display:flex;gap:6px;padding:0 16px 10px}
    .rg-tabs button{flex:1;height:38px;border-radius:12px;background:var(--card);color:var(--ink-2);font-weight:700;font-size:14px}
    .rg-tabs button[aria-pressed="true"]{background:var(--lime);color:var(--lime-ink)}
    .rg-body{flex:1;overflow-y:auto;padding:0 16px calc(env(safe-area-inset-bottom,0px) + 16px);display:flex;flex-direction:column;gap:6px}
    .rg-month{margin:10px 2px 2px;font-size:13px;font-weight:800;color:var(--ink-2)}
    .rg-item{display:flex;gap:12px;align-items:center;background:var(--card);border-radius:14px;padding:11px 12px;text-align:left;color:var(--ink);width:100%}
    .rg-item .dt{width:46px;flex:none;text-align:center;line-height:1.15}
    .rg-item .dt b{display:block;font-size:19px}.rg-item .dt small{font-size:11px;color:var(--ink-2)}
    .rg-item .t{flex:1;min-width:0}.rg-item .t b{display:block;font-size:15px}
    .rg-item .t small{display:block;font-size:12px;color:var(--ink-2);margin-top:2px;line-height:1.45}
    .rg-tag{display:inline-block;margin-left:4px;padding:1px 6px;border-radius:6px;font-size:11px;font-weight:700;vertical-align:1px}
    .rg-tag.ok{background:var(--lime);color:var(--lime-ink)}.rg-tag.est{background:var(--card-2);color:var(--ink-2)}
    .rg-item .d{flex:none;font-size:12px;font-weight:800;color:var(--lime)}
    .rg-note{font-size:12px;color:var(--ink-2);line-height:1.5;padding:4px 2px 8px}`;
    document.head.appendChild(s);
  }

  function buildUi() {
    css();
    const row = el("button", "row"); row.id = "rgRow";
    row.innerHTML = `<span class="ic" aria-hidden="true">🏁</span>
      <span class="t"><b>대회 일정 · 전국 추천 코스</b><small id="rgRowSub"></small></span>
      <span class="go" aria-hidden="true">›</span>`;
    row.onclick = open;
    const anchor = $("courseRow") || $("cmRow");
    if (anchor) anchor.after(row); else document.body.appendChild(row);

    const p = el("section"); p.id = "rgPanel"; p.hidden = true; p.setAttribute("aria-label", "대회 일정과 추천 코스");
    p.innerHTML = `
      <div class="rg-head"><h2>러닝 가이드<small>다가오는 대회와 전국 유명 코스</small></h2><button class="rg-x" id="rgClose" aria-label="닫기">✕</button></div>
      <div class="rg-tabs"><button data-tab="race" aria-pressed="true">🏁 대회 일정</button><button data-tab="course" aria-pressed="false">📍 추천 코스</button></div>
      <div class="rg-body" id="rgBody"></div>`;
    document.body.appendChild(p);
    $("rgClose").onclick = () => { p.hidden = true; };
    p.querySelectorAll(".rg-tabs button").forEach((b) => b.onclick = () => {
      S.tab = b.dataset.tab;
      p.querySelectorAll(".rg-tabs button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      render();
    });
    summary();
  }

  function summary() {
    const sub = $("rgRowSub"); if (!sub) return;
    const next = upcoming().find((r) => r.d);
    if (!next) { sub.textContent = "전국 유명 러닝 코스를 모아 봤어요"; return; }
    const dd = Math.round((parse(next.d) - today()) / 86400000);
    sub.textContent = `다음 대회: ${next.name} ${dd === 0 ? "오늘!" : `D-${dd}`}`;
  }

  function open() {
    $("rgPanel").hidden = false;
    render();
  }

  function renderRaces(body) {
    body.appendChild(el("div", "rg-note", "‘확정’은 주최 측이 발표한 날짜, ‘예년 기준’은 아직 발표 전이라 작년 날짜로 시기만 알려 드려요. 접수 일정은 꼭 대회 공식 홈페이지에서 확인하세요."));
    let month = "";
    const now = today();
    for (const r of upcoming(now)) {
      const dt = parse(r.d || r.m);
      const mLabel = `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`;
      if (mLabel !== month) { month = mLabel; body.appendChild(el("div", "rg-month", mLabel)); }
      const it = el("div", "rg-item");
      const dd = r.d ? Math.round((dt - now) / 86400000) : null;
      it.innerHTML = `<span class="dt">${r.d ? `<b>${dt.getDate()}</b><small>${W[dt.getDay()]}요일</small>` : `<b>${dt.getMonth() + 1}월</b><small>예정</small>`}</span>
        <span class="t"><b></b><small></small></span>${dd != null && dd <= 60 ? `<span class="d">D-${dd}</span>` : ""}`;
      it.querySelector(".t b").textContent = (r.big ? "⭐ " : "") + r.name;
      it.querySelector(".t b").insertAdjacentHTML("beforeend", r.d ? `<span class="rg-tag ok">확정</span>` : `<span class="rg-tag est">예년 기준</span>`);
      it.querySelector(".t small").textContent = `${r.where} · ${r.km}${r.when ? ` · ${r.when}` : ""}`;
      body.appendChild(it);
    }
  }

  function renderCourses(body) {
    body.appendChild(el("div", "rg-note", "지금 보고 있는 지도에서 가까운 순이에요. 누르면 그 코스 출발점으로 이동하고, 그 지역의 화장실·쉼터·밤 안심 정보도 같이 볼 수 있어요."));
    for (const { x, km } of nearby()) {
      const [name, city, lng, lat, tip] = x;
      const it = el("button", "rg-item"); it.type = "button";
      it.innerHTML = `<span class="dt"><b style="font-size:17px">📍</b><small>${km < 1 ? "1km 안" : km < 100 ? Math.round(km) + "km" : Math.round(km / 10) * 10 + "km"}</small></span>
        <span class="t"><b></b><small></small></span><span class="go" aria-hidden="true">›</span>`;
      it.querySelector(".t b").textContent = name;
      it.querySelector(".t small").textContent = `${city} · ${tip}`;
      it.onclick = () => go(x);
      body.appendChild(it);
    }
  }

  function go([name, city, lng, lat, tip]) {
    $("rgPanel").hidden = true;
    if (!map) return;
    marker && marker.remove();
    const pop = new maplibregl.Popup({ closeButton: false, offset: 18 }).setHTML(`📍 <b>${name}</b><br><span style="font-size:12px">${city} · ${tip}</span>`);
    marker = new maplibregl.Marker({ color: "#c8f25b" }).setLngLat([lng, lat]).setPopup(pop).addTo(map);
    map.flyTo({ center: [lng, lat], zoom: 15, duration: 1600 });
    map.once("moveend", () => marker && marker.togglePopup());
  }

  function render() {
    const body = $("rgBody"); body.innerHTML = "";
    if (S.tab === "race") renderRaces(body); else renderCourses(body);
  }

  function init(_map, _state) {
    map = _map; state = _state;
    buildUi();
  }

  return { init, upcoming, nearby, RACES, COURSES };
})();
