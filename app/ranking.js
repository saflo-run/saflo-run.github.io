/* 이번 주 러닝 랭킹 (담당: 화장실 공공데이터 / 게이미피케이션 ③)
 * 실제로 달린 기록만 올라감: 러닝이 끝나면(done) 이번 주 누적 거리에 더해 Firebase(Firestore) ranks 에 저장
 *   - 데모 러닝은 제외, 100m 미만 · 50km 초과 · 1km를 2분 30초보다 빨리 달린 기록(차·자전거 의심)도 제외
 *   - 문서: ranks/{주시작일}_{uid} = { week, uid, nick, room, roomLabel, km, runs, ts }  (위치는 저장 안 함)
 *   - 주는 월요일 시작 (예: 2026-11-23 주)
 *   - 화면: 홈 시트의 '🏆 이번 주 랭킹' 줄 → 전국 / 내 지역 순위, 내 순위와 "윗사람까지 N km"
 *   - 닉네임은 커뮤니티와 같은 것(saflo_nick)을 씀. 없으면 랭킹 화면에서 정함
 * 커뮤니티(community.js)와 같은 Firebase 프로젝트·익명 로그인을 씀
 * index.html 은 init(map, state) 만 부른다   (이 파일이 없어도 앱은 그대로 동작)
 */
window.Ranking = (() => {
  const CFG = {
    apiKey: "AIzaSyDAE4_WaVA2pu8RJOimAhQG_3k-rCvfwFo",
    authDomain: "saflo-run.firebaseapp.com",
    projectId: "saflo-run",
    storageBucket: "saflo-run.firebasestorage.app",
    messagingSenderId: "58618935291",
    appId: "1:58618935291:web:1b5b15695dff5e380d3d5e",
  };
  const V = "11.0.2";
  const MIN_M = 100, MAX_M = 50000, MIN_PACE = 150;      // 초/km
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const nick = () => ls.get("saflo_nick");

  let state = null, F = null;
  const S = { uid: null, kind: null, rows: [], tab: "all", open: false, err: null, unsub: null, week: null };
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("runnavi") : null;

  // 이번 주 월요일 날짜 (휴대폰 시간 기준)
  function weekKey(d = new Date()) {
    const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    const p = (n) => String(n).padStart(2, "0");
    return `${m.getFullYear()}-${p(m.getMonth() + 1)}-${p(m.getDate())}`;
  }

  // 올려도 되는 기록인지
  function valid(kind, dist, time) {
    if (kind === "demo") return false;
    if (!(dist >= MIN_M && dist <= MAX_M)) return false;
    if (time > 0 && time / (dist / 1000) < MIN_PACE) return false;
    return true;
  }

  async function loadFirebase() {
    if (window.__safloFake) return window.__safloFake;
    const u = (m) => `https://www.gstatic.com/firebasejs/${V}/firebase-${m}.js`;
    const [app, auth, fs] = await Promise.all([import(u("app")), import(u("auth")), import(u("firestore"))]);
    const a = app.getApps().length ? app.getApp() : app.initializeApp(CFG);    // 커뮤니티가 먼저 켰으면 같은 앱을 씀
    const au = auth.getAuth(a);
    const user = au.currentUser || (await auth.signInAnonymously(au)).user;
    return { uid: user.uid, db: fs.getFirestore(a), ...fs };
  }

  // ---------- 기록 올리기 ----------
  async function addRun(dist, time) {
    const km = Math.round(dist / 10) / 100;
    if (!F) { pendingAdd(km); return; }
    const wk = weekKey(), room = state && state.cur ? state.cur : "";
    const label = room && state.byCode && state.byCode[room] ? state.byCode[room].label : "";
    try {
      await F.setDoc(F.doc(F.db, "ranks", `${wk}_${S.uid}`), {
        week: wk, uid: S.uid, nick: nick() || "러너", room, roomLabel: label,
        km: F.increment(km), runs: F.increment(1), ts: F.serverTimestamp(),
      }, { merge: true });
      toast(`🏆 이번 주 랭킹에 ${km.toFixed(2)}km 추가!`);
    } catch (e) {
      console.error("랭킹 저장 실패", e);
      pendingAdd(km);
      toast("랭킹 저장에 실패했어요. 다음에 다시 올릴게요");
    }
  }
  // 인터넷이 끊겼거나 연결 전이면 모아 두었다가 다음 연결 때 올림
  function pendingAdd(km) {
    const p = JSON.parse(ls.get("saflo_rank_pending") || "[]");
    p.push({ wk: weekKey(), km }); ls.set("saflo_rank_pending", JSON.stringify(p));
  }
  async function flushPending() {
    const p = JSON.parse(ls.get("saflo_rank_pending") || "[]").filter((x) => x.wk === weekKey());
    ls.set("saflo_rank_pending", "[]");
    for (const x of p) await addRun(x.km * 1000, 0);
  }

  if (bc) bc.addEventListener("message", (e) => {
    const m = e.data || {};
    if (m.type === "start" || m.type === "tick") { if (m.kind) S.kind = m.kind; }
    else if (m.type === "done") {
      if (valid(S.kind, m.dist, m.time)) addRun(m.dist, m.time);
      S.kind = null;
    }
  });

  // ---------- 순위 받기 ----------
  function subscribe() {
    const wk = weekKey();
    if (S.unsub && S.week === wk) return;
    S.unsub && S.unsub();
    S.week = wk;
    // 주 하나만 걸러 받고 정렬은 휴대폰에서 (Firestore 색인 설정이 따로 필요 없게)
    S.unsub = F.onSnapshot(F.query(F.collection(F.db, "ranks"), F.where("week", "==", wk)), (snap) => {
      S.rows = snap.docs.map((d) => d.data()).filter((r) => r.km > 0);
      S.err = null; render();
    }, (e) => { console.error(e); S.err = "랭킹을 불러오지 못했어요."; render(); });
  }

  // ---------- 화면 ----------
  function css() {
    const s = document.createElement("style");
    s.textContent = `
    #rkPanel{position:fixed;inset:0;z-index:60;background:var(--bg);display:flex;flex-direction:column;max-width:560px;margin:0 auto}
    #rkPanel[hidden]{display:none}
    .rk-head{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 16px 10px}
    .rk-head h2{flex:1;margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}
    .rk-head small{display:block;font-size:12px;color:var(--ink-2);font-weight:500}
    .rk-x{width:40px;height:40px;border-radius:12px;background:var(--card);font-size:20px}
    .rk-tabs{display:flex;gap:6px;padding:0 16px 10px}
    .rk-tabs button{flex:1;height:38px;border-radius:12px;background:var(--card);color:var(--ink-2);font-weight:700;font-size:14px}
    .rk-tabs button[aria-pressed="true"]{background:var(--lime);color:var(--lime-ink)}
    .rk-me{margin:0 16px 10px;background:var(--card-2);border:1px solid var(--lime);border-radius:16px;padding:12px 14px}
    .rk-me b{font-size:17px}.rk-me small{display:block;margin-top:3px;font-size:13px;color:var(--ink-2)}
    .rk-body{flex:1;overflow-y:auto;padding:0 16px calc(env(safe-area-inset-bottom,0px) + 12px);display:flex;flex-direction:column;gap:6px}
    .rk-row{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:14px;padding:10px 12px}
    .rk-row.mine{outline:2px solid var(--lime);outline-offset:-2px}
    .rk-row .n{width:30px;text-align:center;font-weight:800;font-size:16px;flex:none}
    .rk-row .t{flex:1;min-width:0}.rk-row .t b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rk-row .t small{font-size:12px;color:var(--ink-2)}
    .rk-row .km{font-weight:800;font-size:16px}.rk-row .km em{font-style:normal;font-size:12px;color:var(--ink-2);margin-left:2px}
    .rk-empty{color:var(--ink-2);text-align:center;padding:36px 8px;font-size:14px;line-height:1.6}
    .rk-form{display:grid;gap:8px;background:var(--card);border-radius:14px;padding:12px}
    .rk-form input{height:42px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);padding:0 12px;font-size:16px}
    .rk-form button{height:44px;border-radius:12px;background:var(--lime);color:var(--lime-ink);font-weight:800}
    #rkToast{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translate(-50%,-160%);z-index:71;
      background:var(--card-2);color:var(--ink);border:1px solid var(--lime);border-radius:16px;padding:10px 16px;font-weight:700;font-size:15px;
      box-shadow:0 10px 30px rgba(0,0,0,.45);transition:transform .35s cubic-bezier(.2,.8,.2,1);max-width:calc(100vw - 32px)}
    #rkToast.on{transform:translate(-50%,0)}`;
    document.head.appendChild(s);
  }

  function buildUi() {
    css();
    const row = el("button", "row"); row.id = "rkRow";
    row.innerHTML = `<span class="ic" aria-hidden="true">🏆</span>
      <span class="t"><b>이번 주 랭킹</b><small id="rkRowSub">달린 거리만큼 순위가 올라가요</small></span>
      <span class="go" aria-hidden="true">›</span>`;
    row.onclick = openPanel;
    const anchor = $("cmRow") || $("watchRow") || $("courseRow");
    if (anchor) anchor.after(row); else document.body.appendChild(row);

    const p = el("section"); p.id = "rkPanel"; p.hidden = true; p.setAttribute("aria-label", "이번 주 랭킹");
    p.innerHTML = `
      <div class="rk-head"><h2>이번 주 랭킹<small id="rkWeek"></small></h2><button class="rk-x" id="rkClose" aria-label="닫기">✕</button></div>
      <div class="rk-tabs"><button data-tab="all" aria-pressed="true">전국</button><button data-tab="room" aria-pressed="false" id="rkRoomTab">내 지역</button></div>
      <div class="rk-me" id="rkMe" hidden></div>
      <div class="rk-body" id="rkBody"></div>`;
    document.body.appendChild(p);
    const t = el("div"); t.id = "rkToast"; t.setAttribute("role", "status"); document.body.appendChild(t);
    $("rkClose").onclick = () => { p.hidden = true; S.open = false; };
    p.querySelectorAll(".rk-tabs button").forEach((b) => b.onclick = () => {
      S.tab = b.dataset.tab;
      p.querySelectorAll(".rk-tabs button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      render();
    });
  }

  let toastT = null;
  function toast(text) {
    const t = $("rkToast"); if (!t) return;
    t.textContent = text; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 4200);
  }

  function openPanel() {
    $("rkPanel").hidden = false; S.open = true;
    if (F) subscribe();
    render();
  }

  function ranked() {
    const room = state && state.cur;
    const rows = S.tab === "room" ? S.rows.filter((r) => room && r.room === room) : S.rows;
    return rows.slice().sort((a, b) => b.km - a.km);
  }

  function nickForm(body) {
    const f = el("form", "rk-form");
    f.innerHTML = `<b>닉네임을 정해 주세요</b>
      <div style="font-size:12px;color:var(--ink-2);line-height:1.5">랭킹에는 닉네임·지역·거리만 보이고, 위치는 저장하지 않아요. (커뮤니티와 같은 닉네임)</div>
      <input id="rkNick" maxlength="12" placeholder="예: 새벽러너" autocomplete="off"><button>저장</button>`;
    f.onsubmit = (e) => {
      e.preventDefault();
      const v = $("rkNick").value.trim().slice(0, 12);
      if (!v) return;
      ls.set("saflo_nick", v);
      // 이번 주 기록이 이미 있으면 닉네임도 바꿔 줌
      if (F && S.rows.some((r) => r.uid === S.uid)) F.setDoc(F.doc(F.db, "ranks", `${weekKey()}_${S.uid}`), { nick: v }, { merge: true }).catch(() => {});
      render();
    };
    body.appendChild(f);
  }

  function render() {
    // 홈 줄 요약
    const all = S.rows.slice().sort((a, b) => b.km - a.km);
    const mi = all.findIndex((r) => r.uid === S.uid);
    const sub = $("rkRowSub");
    if (sub) sub.textContent = mi >= 0 ? `전국 ${mi + 1}위 · 이번 주 ${all[mi].km.toFixed(1)}km` : "달린 거리만큼 순위가 올라가요";
    if (!S.open) return;

    const room = state && state.cur, label = room && state.byCode && state.byCode[room] ? state.byCode[room].label : "";
    $("rkWeek").textContent = `${S.week || weekKey()} 주 · 월요일마다 새로 시작`;
    $("rkRoomTab").textContent = label ? `${label}` : "내 지역";
    const body = $("rkBody"); body.innerHTML = "";
    const me = $("rkMe"); me.hidden = true;
    if (S.err) { body.appendChild(el("div", "rk-empty", S.err)); return; }
    if (!nick()) { nickForm(body); return; }
    if (!S.uid) { body.appendChild(el("div", "rk-empty", "연결하는 중…")); return; }
    if (S.tab === "room" && !room) { body.appendChild(el("div", "rk-empty", "지도에서 지역(시군구)을 고르면 그 지역 순위를 볼 수 있어요.")); return; }

    const rows = ranked();
    const i = rows.findIndex((r) => r.uid === S.uid);
    me.hidden = false;
    if (i < 0) me.innerHTML = `<b>아직 이번 주 기록이 없어요</b><small>러닝을 시작해 끝까지 마치면 거리만큼 순위에 올라가요${rows.length ? ` · 지금 ${rows.length}명 참여 중` : ""}</small>`;
    else if (i === 0) me.innerHTML = `<b>🥇 ${rows.length}명 중 1위!</b><small>이번 주 ${rows[0].km.toFixed(1)}km · 2위와 ${rows[1] ? (rows[0].km - rows[1].km).toFixed(1) + "km 차이" : "아직 경쟁자 없음"}</small>`;
    else me.innerHTML = `<b>${rows.length}명 중 ${i + 1}위</b><small>${i}위까지 ${(rows[i - 1].km - rows[i].km + 0.01).toFixed(2)}km 남았어요 · 이번 주 ${rows[i].km.toFixed(1)}km</small>`;

    if (!rows.length) { body.appendChild(el("div", "rk-empty", "이번 주 첫 기록의 주인공이 되어 보세요!")); return; }
    rows.slice(0, 50).forEach((r, k) => {
      const d = el("div", "rk-row" + (r.uid === S.uid ? " mine" : ""));
      const medal = ["🥇", "🥈", "🥉"][k] || String(k + 1);
      d.innerHTML = `<span class="n">${medal}</span><span class="t"><b></b><small></small></span><span class="km">${r.km.toFixed(1)}<em>km</em></span>`;
      d.querySelector(".t b").textContent = r.nick || "러너";
      d.querySelector(".t small").textContent = `${r.roomLabel || ""}${r.runs ? ` · ${r.runs}회` : ""}`;
      body.appendChild(d);
    });
    if (i >= 50) { const d = el("div", "rk-empty", `내 순위: ${i + 1}위`); body.appendChild(d); }
  }

  function init(_map, _state) {
    state = _state;
    buildUi();
    let lastRoom = null;
    setInterval(() => { if (state.cur !== lastRoom) { lastRoom = state.cur; if (S.open) render(); } }, 1000);
    loadFirebase().then(async (f) => {
      F = f; S.uid = f.uid;
      subscribe();
      await flushPending();
    }).catch((e) => { console.error("랭킹 연결 실패", e); S.err = "랭킹 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요."; render(); });
  }

  return { init, weekKey, valid };
})();
