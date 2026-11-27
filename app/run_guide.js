/* 러닝 가이드: 대회 일정 + 전국 추천 코스 (담당: 화장실 공공데이터 / 진짜 러너·여행 러너용)
 *   - 대회 일정: 다가오는 주요 마라톤을 월별로. '확정'(주최 측 발표 날짜)과 '예년 기준'(아직 발표 전, 작년 날짜로 시기만 안내)을 구분
 *     지난 대회는 자동으로 숨김. 접수·날짜는 바뀔 수 있어 각 대회 공식 공지 확인 안내
 *   - 추천 코스: 전국 유명 러닝 코스 + 러너들이 직접 추가한 코스. 지금 지도 가운데에서 가까운 순
 *     코스를 누르면 상세: 👍좋아요/👎별로예요 + 한 줄 후기, '지도에서 보기'로 출발점 이동
 *     (이동하면 그 지역의 화장실·쉼터·밤 안심 정보가 그대로 같이 보임)
 *   - 러너 참여는 커뮤니티와 같은 Firebase(익명 로그인 + 닉네임 saflo_nick)
 *       guide_courses/{자동id} = { name, city, tip, lng, lat, uid, nick, ts }
 *       guide_comments/{자동id} = { cid(코스 id: 기본 코스는 b0~, 러너 코스는 문서 id), uid, nick, good(true/false), text, ts }
 *     내 코스·내 후기는 지울 수 있음. 서버에 연결 못 하면 기본 코스만 보임
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
  // ⚠ 후기가 순서 번호(b0, b1…)로 연결돼 있으니 순서를 바꾸거나 중간에 지우지 말고, 새 코스는 맨 끝에 추가
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
  let map = null, state = null, marker = null, F = null;
  const S = { tab: "race", view: "list", detail: null, pick: null, userCourses: [], comments: [], uid: null, err: null };
  const CFG = {
    apiKey: "AIzaSyDAE4_WaVA2pu8RJOimAhQG_3k-rCvfwFo", authDomain: "saflo-run.firebaseapp.com", projectId: "saflo-run",
    storageBucket: "saflo-run.firebasestorage.app", messagingSenderId: "58618935291", appId: "1:58618935291:web:1b5b15695dff5e380d3d5e",
  };
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const nick = () => ls.get("saflo_nick");

  async function loadFirebase() {
    if (window.__safloFake) return window.__safloFake;
    const u = (m) => `https://www.gstatic.com/firebasejs/11.0.2/firebase-${m}.js`;
    const [app, auth, fs] = await Promise.all([import(u("app")), import(u("auth")), import(u("firestore"))]);
    const a = app.getApps().length ? app.getApp() : app.initializeApp(CFG);
    const au = auth.getAuth(a);
    const user = au.currentUser || (await auth.signInAnonymously(au)).user;
    return { uid: user.uid, db: fs.getFirestore(a), ...fs };
  }
  function subscribe() {
    F.onSnapshot(F.query(F.collection(F.db, "guide_courses"), F.limit(500)), (snap) => {
      S.userCourses = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => typeof c.lng === "number" && typeof c.lat === "number");
      refresh();
    }, (e) => { console.error("러너 코스", e); S.err = "러너 코스를 불러오지 못했어요."; refresh(); });
    F.onSnapshot(F.query(F.collection(F.db, "guide_comments"), F.limit(2000)), (snap) => {
      S.comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      refresh();
    }, (e) => console.error("코스 후기", e));
  }
  function refresh() { if (!$("rgPanel").hidden && S.tab === "course") render(); }
  const tsMs = (d) => (d.ts && d.ts.toMillis ? d.ts.toMillis() : Date.now());
  const ago = (ms) => { const s = Math.max(0, (Date.now() - ms) / 1000); return s < 3600 ? `${Math.max(1, Math.floor(s / 60))}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`; };
  function allCourses() {
    const base = COURSES.map(([name, city, lng, lat, tip], i) => ({ id: "b" + i, name, city, lng, lat, tip, builtin: true }));
    return base.concat(S.userCourses);
  }
  function votes(id) {
    const cs = S.comments.filter((c) => c.cid === id);
    return { good: cs.filter((c) => c.good === true).length, bad: cs.filter((c) => c.good === false).length, n: cs.length, list: cs.sort((a, b) => tsMs(b) - tsMs(a)) };
  }

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
    return allCourses().map((x) => ({ x, km: hav([c.lng, c.lat], [x.lng, x.lat]) })).sort((a, b) => a.km - b.km);
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
    .rg-note{font-size:12px;color:var(--ink-2);line-height:1.5;padding:4px 2px 8px}
    .rg-btn{height:44px;border-radius:12px;background:var(--lime);color:var(--lime-ink);font-weight:800;font-size:15px;padding:0 14px}
    .rg-btn.ghost{background:var(--card);color:var(--ink)}
    .rg-card{background:var(--card);border-radius:14px;padding:12px;display:grid;gap:8px}
    .rg-card h3{margin:0;font-size:18px}.rg-card p{margin:0;font-size:14px;line-height:1.5;color:var(--ink-2)}
    .rg-card input,.rg-card textarea{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);padding:10px 12px;font-size:16px;font-family:inherit}
    .rg-vote{display:flex;gap:6px}.rg-vote button{flex:1;height:40px;border-radius:12px;background:var(--bg);color:var(--ink);font-weight:700;border:1px solid var(--line)}
    .rg-vote button[aria-pressed="true"]{background:var(--lime);color:var(--lime-ink);border-color:var(--lime)}
    .rg-cm{background:var(--card);border-radius:12px;padding:9px 12px;font-size:14px;line-height:1.45;word-break:break-word}
    .rg-cm .meta{font-size:12px;color:var(--ink-2);margin-bottom:2px;display:flex;gap:6px}.rg-cm .meta b{color:var(--ink)}
    .rg-cm .del{margin-left:auto;background:none;color:var(--ink-2);font-size:12px}
    .rg-mine{font-size:11px;padding:1px 6px;border-radius:6px;background:var(--card-2);color:var(--ink-2);margin-left:4px;vertical-align:1px}
    #rgPick{position:fixed;inset:0;z-index:58;pointer-events:none}
    #rgPick[hidden]{display:none}
    #rgPick .cross{position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);font-size:34px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
    #rgPick .bar{pointer-events:auto;position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);max-width:536px;margin:0 auto;
      background:var(--card-2);border:1px solid var(--lime);border-radius:16px;padding:12px;display:grid;gap:8px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
    #rgPick .bar b{font-size:15px}#rgPick .bar .r{display:flex;gap:8px}#rgPick .bar .r button{flex:1}`;
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
    const pick = el("div"); pick.id = "rgPick"; pick.hidden = true;
    pick.innerHTML = `<span class="cross" aria-hidden="true">📍</span>
      <div class="bar"><b>지도를 움직여 핀을 코스 출발점에 맞춰 주세요</b>
      <div class="r"><button class="rg-btn ghost" id="rgPickNo">취소</button><button class="rg-btn" id="rgPickOk">여기로 정하기</button></div></div>`;
    document.body.appendChild(pick);
    $("rgPickNo").onclick = () => { pick.hidden = true; S.tab = "course"; S.view = "list"; open(); };
    $("rgPickOk").onclick = () => { const c = map.getCenter(); S.pick = [c.lng, c.lat]; pick.hidden = true; S.tab = "course"; S.view = "add"; open(); };
    $("rgClose").onclick = () => { p.hidden = true; };
    p.querySelectorAll(".rg-tabs button").forEach((b) => b.onclick = () => {
      S.tab = b.dataset.tab; S.view = "list";
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
    $("rgPanel").querySelectorAll(".rg-tabs button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.tab === S.tab));
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
    if (S.view === "detail" && S.detail) return renderDetail(body);
    if (S.view === "add") return renderAdd(body);
    const add = el("button", "rg-btn ghost", "➕ 내가 아는 코스 추가하기"); add.type = "button";
    add.onclick = startAdd;
    body.appendChild(add);
    body.appendChild(el("div", "rg-note", "지금 보고 있는 지도에서 가까운 순이에요. 눌러서 후기를 보거나 남기고, 지도에서 출발점으로 이동할 수 있어요."));
    if (S.err) body.appendChild(el("div", "rg-note", S.err));
    for (const { x, km } of nearby().slice(0, 60)) {
      const v = votes(x.id);
      const it = el("button", "rg-item"); it.type = "button";
      it.innerHTML = `<span class="dt"><b style="font-size:17px">${x.builtin ? "📍" : "🏃"}</b><small>${km < 1 ? "1km 안" : km < 100 ? Math.round(km) + "km" : Math.round(km / 10) * 10 + "km"}</small></span>
        <span class="t"><b></b><small></small></span><span class="d">${v.n ? `👍${v.good}${v.bad ? ` 👎${v.bad}` : ""}` : ""}</span>`;
      it.querySelector(".t b").textContent = x.name;
      if (!x.builtin) it.querySelector(".t b").insertAdjacentHTML("beforeend", `<span class="rg-mine">러너 추천</span>`);
      it.querySelector(".t small").textContent = `${x.city || ""} · ${x.tip || ""}`;
      it.onclick = () => { S.detail = x; S.view = "detail"; render(); };
      body.appendChild(it);
    }
  }

  function needNick(body) {
    if (nick()) return false;
    const f = el("form", "rg-card");
    f.innerHTML = `<b>닉네임을 정해 주세요</b><p>회원가입 없이 닉네임으로만 참여해요. (커뮤니티·랭킹과 같은 닉네임)</p>
      <input id="rgNick" maxlength="12" placeholder="예: 새벽러너" autocomplete="off"><button class="rg-btn">저장</button>`;
    f.onsubmit = (e) => { e.preventDefault(); const v = $("rgNick").value.trim().slice(0, 12); if (v) { ls.set("saflo_nick", v); render(); } };
    body.appendChild(f);
    return true;
  }

  function renderDetail(body) {
    const x = S.detail, v = votes(x.id);
    const back = el("button", "rg-btn ghost", "‹ 목록으로"); back.type = "button"; back.onclick = () => { S.view = "list"; render(); };
    body.appendChild(back);
    const card = el("div", "rg-card");
    card.innerHTML = `<h3></h3><p class="c"></p><p class="w"></p>
      <div style="font-size:14px;font-weight:700">👍 좋아요 ${v.good} · 👎 별로예요 ${v.bad}</div>`;
    card.querySelector("h3").textContent = x.name;
    card.querySelector(".c").textContent = x.tip || "";
    card.querySelector(".w").textContent = `${x.city || ""}${x.builtin ? " · SAFLO 추천" : ` · ${x.nick || "러너"}님이 추가`}`;
    const go_ = el("button", "rg-btn", "🗺️ 지도에서 보기"); go_.type = "button"; go_.onclick = () => go(x);
    card.appendChild(go_);
    if (!x.builtin && x.uid === S.uid) {
      const del = el("button", "rg-btn ghost", "내가 추가한 코스 지우기"); del.type = "button";
      del.onclick = async () => { try { await F.deleteDoc(F.doc(F.db, "guide_courses", x.id)); S.view = "list"; render(); } catch (e) { alert("지우지 못했어요"); } };
      card.appendChild(del);
    }
    body.appendChild(card);

    body.appendChild(el("div", "rg-month", `러너 후기 ${v.n}개`));
    if (!F) body.appendChild(el("div", "rg-note", S.err || "서버에 연결하는 중이에요…"));
    else if (!needNick(body)) {
      const f = el("form", "rg-card");
      f.innerHTML = `<div class="rg-vote"><button type="button" data-g="1" aria-pressed="true">👍 좋아요</button><button type="button" data-g="0" aria-pressed="false">👎 별로예요</button></div>
        <input id="rgCm" maxlength="100" placeholder="예: 바닥이 평평하고 화장실 가까워요" autocomplete="off" enterkeyhint="send"><button class="rg-btn">후기 남기기</button>`;
      let good = true;
      f.querySelectorAll(".rg-vote button").forEach((b) => b.onclick = () => {
        good = b.dataset.g === "1";
        f.querySelectorAll(".rg-vote button").forEach((y) => y.setAttribute("aria-pressed", y === b));
      });
      f.onsubmit = async (e) => {
        e.preventDefault();
        const text = $("rgCm").value.trim().slice(0, 100);
        try {
          await F.addDoc(F.collection(F.db, "guide_comments"), { cid: x.id, uid: S.uid, nick: nick(), good, text, ts: F.serverTimestamp() });
          $("rgCm").value = "";
        } catch (err) { console.error(err); alert("후기를 올리지 못했어요. 잠시 뒤 다시 해 주세요"); }
      };
      body.appendChild(f);
    }
    if (!v.n) body.appendChild(el("div", "rg-note", "아직 후기가 없어요. 달려 봤다면 첫 후기를 남겨 주세요!"));
    for (const c of v.list) {
      const d = el("div", "rg-cm");
      d.innerHTML = `<div class="meta"><span>${c.good ? "👍" : "👎"}</span><b></b><span>${ago(tsMs(c))}</span></div><div class="x"></div>`;
      d.querySelector(".meta b").textContent = c.nick || "러너";
      d.querySelector(".x").textContent = c.text || (c.good ? "좋아요" : "별로예요");
      if (c.uid === S.uid) {
        const del = el("button", "del", "지우기"); del.type = "button";
        del.onclick = () => F.deleteDoc(F.doc(F.db, "guide_comments", c.id)).catch(() => alert("지우지 못했어요"));
        d.querySelector(".meta").appendChild(del);
      }
      body.appendChild(d);
    }
  }

  function startAdd() {
    if (!F) { alert(S.err || "서버에 연결하는 중이에요. 잠시 뒤 다시 해 주세요"); return; }
    $("rgPanel").hidden = true;
    $("rgPick").hidden = false;
    if (map.getZoom() < 14) map.easeTo({ zoom: 15, duration: 600 });
  }

  function renderAdd(body) {
    const back = el("button", "rg-btn ghost", "‹ 취소"); back.type = "button"; back.onclick = () => { S.view = "list"; render(); };
    body.appendChild(back);
    if (needNick(body)) return;
    const reg = state && state.cur && state.byCode && state.byCode[state.cur];
    const f = el("form", "rg-card");
    f.innerHTML = `<b>새 코스 추가</b><p>출발점은 방금 지도에서 정한 곳이에요. 다른 러너들에게 그대로 보여요.</p>
      <input id="rgName" maxlength="30" placeholder="코스 이름 (예: 무거천 벚꽃길)" required autocomplete="off">
      <input id="rgCity" maxlength="20" placeholder="지역 (예: 울산 남구)" autocomplete="off">
      <textarea id="rgTip" maxlength="80" rows="2" placeholder="한 줄 소개 (예: 강 따라 평지 5km, 밤에도 밝아요)"></textarea>
      <button class="rg-btn">코스 올리기</button>`;
    body.appendChild(f);
    if (reg) $("rgCity").value = reg.label;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const name = $("rgName").value.trim().slice(0, 30);
      if (!name || !S.pick) return;
      try {
        const ref = await F.addDoc(F.collection(F.db, "guide_courses"), {
          name, city: $("rgCity").value.trim().slice(0, 20), tip: $("rgTip").value.trim().slice(0, 80),
          lng: Math.round(S.pick[0] * 1e5) / 1e5, lat: Math.round(S.pick[1] * 1e5) / 1e5, uid: S.uid, nick: nick(), ts: F.serverTimestamp() });
        S.detail = { id: ref.id, name, city: $("rgCity").value.trim(), tip: $("rgTip").value.trim(), lng: S.pick[0], lat: S.pick[1], uid: S.uid, nick: nick() };
        S.view = "detail"; S.pick = null; render();
      } catch (err) { console.error(err); alert("코스를 올리지 못했어요. 잠시 뒤 다시 해 주세요"); }
    };
  }

  function go(x) {
    const { name, city, lng, lat, tip } = x;
    $("rgPanel").hidden = true;
    if (!map) return;
    marker && marker.remove();
    const pop = new maplibregl.Popup({ closeButton: false, offset: 18 });
    const box = document.createElement("div");
    box.innerHTML = `📍 <b></b><br><span style="font-size:12px"></span>`;
    box.querySelector("b").textContent = name; box.querySelector("span").textContent = `${city || ""} · ${tip || ""}`;
    pop.setDOMContent(box);
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
    loadFirebase().then((f) => { F = f; S.uid = f.uid; subscribe(); refresh(); })
      .catch((e) => { console.error("러닝 가이드 연결 실패", e); S.err = "서버에 연결하지 못해 기본 추천 코스만 보여요."; refresh(); });
  }

  return { init, upcoming, nearby, RACES, COURSES };
})();
