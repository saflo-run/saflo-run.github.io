// SAFLO 러너 커뮤니티 (Firebase Firestore + 익명 로그인)
// - 지역(시군구)별 이야기방: 글 / 길·시설 알림
// - 지금 달리는 중: 러닝을 시작하면 "이 지역 N명 달리는 중" (정확한 위치는 공유하지 않음)
// - 응원: 달리는 사람에게 👏 → 받는 사람 이어폰으로 읽어주고 워치에 표시, 워치에서 버튼으로 답장
// - 함께 뛰기: 모집 글 + 참여
// 없어도 앱은 그대로 동작해요. 휴대폰 앱과는 BroadcastChannel("runnavi")로만 연결돼요.
window.Community = (() => {
  const CFG = {
    apiKey: "AIzaSyDAE4_WaVA2pu8RJOimAhQG_3k-rCvfwFo",
    authDomain: "saflo-run.firebaseapp.com",
    projectId: "saflo-run",
    storageBucket: "saflo-run.firebasestorage.app",
    messagingSenderId: "58618935291",
    appId: "1:58618935291:web:1b5b15695dff5e380d3d5e",
  };
  const V = "11.0.2";
  const LIVE_MS = 3 * 60 * 1000;            // 3분 안에 신호가 있으면 "달리는 중"
  const QUICK = [
    ["alert", "🚧 화장실 공사 중이에요"], ["alert", "🔒 화장실이 잠겨 있어요"], ["alert", "⛔ 길이 막혀 있어요"],
    ["alert", "💡 가로등이 꺼져 있어요"], ["msg", "👍 이 코스 좋아요"], ["msg", "🌊 강바람 시원해요"],
  ];
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  let state = null, F = null;               // F: Firestore 함수 묶음
  const S = { uid: null, room: null, subs: [], msgs: [], runners: [], meets: [], tab: "talk", open: false,
              running: false, runDist: 0, beat: null, lastPost: 0, since: Date.now(), heard: new Set(), err: null };
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("runnavi") : null;
  const post = (m) => { try { bc && bc.postMessage(m); } catch (e) {} };

  const nick = () => ls.get("saflo_nick");
  const roomLabel = () => (S.room && state.byCode && state.byCode[S.room] ? state.byCode[S.room].label : "");
  const courseName = () => { const r = state.cur && state.loaded && state.loaded.get(state.cur); return r && r.courseName ? String(r.courseName).slice(0, 40) : ""; };
  const tsMs = (d) => (d.ts && d.ts.toMillis ? d.ts.toMillis() : typeof d.ts === "number" ? d.ts : Date.now());
  const ago = (ms) => { const s = Math.max(0, (Date.now() - ms) / 1000); return s < 60 ? "방금" : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`; };

  // ---------- Firebase 불러오기 (설치 없이 인터넷에서) ----------
  async function loadFirebase() {
    if (window.__safloFake) return window.__safloFake;       // 테스트용 가짜 저장소
    const u = (m) => `https://www.gstatic.com/firebasejs/${V}/firebase-${m}.js`;
    const [app, auth, fs] = await Promise.all([import(u("app")), import(u("auth")), import(u("firestore"))]);
    const a = app.initializeApp(CFG);
    const au = auth.getAuth(a);
    const cred = await auth.signInAnonymously(au);
    return { uid: cred.user.uid, db: fs.getFirestore(a), ...fs };
  }

  // ---------- 화면 ----------
  function css() {
    const s = document.createElement("style");
    s.textContent = `
    #cmRow .cm-live{display:inline-flex;align-items:center;gap:5px;color:var(--lime)}
    #cmRow .cm-live i{width:7px;height:7px;border-radius:50%;background:var(--lime);animation:cmPulse 1.6s infinite}
    @keyframes cmPulse{50%{opacity:.25}}
    #cmPanel{position:fixed;inset:0;z-index:60;background:var(--bg);display:flex;flex-direction:column;max-width:560px;margin:0 auto}
    #cmPanel[hidden]{display:none}
    .cm-head{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 16px 10px}
    .cm-head h2{flex:1;margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}
    .cm-head small{display:block;font-size:12px;color:var(--ink-2);font-weight:500}
    .cm-x{width:40px;height:40px;border-radius:12px;background:var(--card);font-size:20px}
    .cm-tabs{display:flex;gap:6px;padding:0 16px 10px}
    .cm-tabs button{flex:1;height:38px;border-radius:12px;background:var(--card);color:var(--ink-2);font-weight:700;font-size:14px}
    .cm-tabs button[aria-pressed="true"]{background:var(--lime);color:var(--lime-ink)}
    .cm-body{flex:1;overflow-y:auto;padding:4px 16px 12px;display:flex;flex-direction:column;gap:8px}
    .cm-empty{color:var(--ink-2);text-align:center;padding:36px 8px;font-size:14px;line-height:1.6}
    .cm-msg{background:var(--card);border-radius:14px;padding:10px 12px;font-size:15px;line-height:1.45;word-break:break-word}
    .cm-msg.mine{background:var(--card-2)}
    .cm-msg.alert{border-left:3px solid #ffb547}
    .cm-msg.cheer{border-left:3px solid var(--lime)}
    .cm-msg .meta{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--ink-2);margin-bottom:3px}
    .cm-msg .meta b{color:var(--ink);font-weight:700}
    .cm-msg .meta .tag{padding:1px 6px;border-radius:6px;background:var(--bg);font-size:11px}
    .cm-msg .del{margin-left:auto;color:var(--ink-2);font-size:12px;background:none}
    .cm-quick{display:flex;gap:6px;overflow-x:auto;padding:0 16px 8px;scrollbar-width:none}
    .cm-quick button{flex:none;height:34px;padding:0 12px;border-radius:17px;background:var(--card);border:1px solid var(--line);font-size:13px;color:var(--ink)}
    .cm-input{display:flex;gap:8px;padding:0 16px calc(env(safe-area-inset-bottom,0px) + 12px)}
    .cm-input input{flex:1;box-sizing:border-box;min-width:0;height:46px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:0 14px;font-size:16px}
    .cm-input button,.cm-btn{height:46px;padding:0 16px;border-radius:14px;background:var(--lime);color:var(--lime-ink);font-weight:800;font-size:15px}
    .cm-btn.ghost{background:var(--card);color:var(--ink)}
    .cm-btn:disabled{opacity:.45}
    .cm-runner,.cm-meet{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:14px;padding:12px}
    .cm-runner .av{width:38px;height:38px;border-radius:50%;background:var(--card-2);display:grid;place-items:center;font-size:18px;flex:none}
    .cm-runner .t,.cm-meet .t{flex:1;min-width:0}
    .cm-runner .t b,.cm-meet .t b{display:block;font-size:15px}
    .cm-runner .t small,.cm-meet .t small{display:block;font-size:12px;color:var(--ink-2);margin-top:2px}
    .cm-runner .cm-btn,.cm-meet .cm-btn{height:38px;padding:0 12px;font-size:14px}
    .cm-form{display:grid;gap:8px;min-width:0;background:var(--card);border-radius:14px;padding:12px}
    .cm-form input,.cm-form select{width:100%;box-sizing:border-box;height:42px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);padding:0 12px;font-size:16px;min-width:0}
    .cm-form .r{display:flex;gap:8px;min-width:0}.cm-form .r>*{flex:1;min-width:0}
    .cm-note{font-size:12px;color:var(--ink-2);line-height:1.5}
    #cmToast{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translate(-50%,-140%);z-index:70;
      background:var(--card-2);color:var(--ink);border:1px solid var(--lime);border-radius:16px;padding:10px 16px;font-weight:700;font-size:15px;
      box-shadow:0 10px 30px rgba(0,0,0,.45);transition:transform .35s cubic-bezier(.2,.8,.2,1);max-width:calc(100vw - 32px)}
    #cmToast.on{transform:translate(-50%,0)}`;
    document.head.appendChild(s);
  }

  function buildUi() {
    css();
    // 홈 아래 시트에 줄 하나
    const row = el("button", "row"); row.id = "cmRow";
    row.innerHTML = `<span class="ic" aria-hidden="true">💬</span>
      <span class="t"><b>러너 커뮤니티</b><small id="cmRowSub">지역을 고르면 이 지역 러너들과 이야기할 수 있어요</small></span>
      <span class="go" aria-hidden="true">›</span>`;
    row.onclick = () => openPanel();
    const anchor = $("watchRow") || $("courseRow");
    if (anchor) anchor.after(row); else document.body.appendChild(row);

    const p = el("section"); p.id = "cmPanel"; p.hidden = true; p.setAttribute("aria-label", "러너 커뮤니티");
    p.innerHTML = `
      <div class="cm-head"><h2>러너 커뮤니티<small id="cmRoom"></small></h2><button class="cm-x" id="cmClose" aria-label="닫기">✕</button></div>
      <div class="cm-tabs" role="tablist">
        <button data-tab="talk" aria-pressed="true">이야기</button>
        <button data-tab="live" aria-pressed="false">달리는 중 <span id="cmLiveN"></span></button>
        <button data-tab="meet" aria-pressed="false">함께 뛰기</button>
      </div>
      <div class="cm-body" id="cmBody"></div>
      <div id="cmTalkBar">
        <div class="cm-quick" id="cmQuick"></div>
        <form class="cm-input" id="cmForm"><input id="cmText" maxlength="140" placeholder="이 지역 러너들에게 한마디" autocomplete="off" enterkeyhint="send"><button>보내기</button></form>
      </div>`;
    document.body.appendChild(p);
    const toast = el("div"); toast.id = "cmToast"; toast.setAttribute("role", "status"); document.body.appendChild(toast);

    $("cmClose").onclick = () => { p.hidden = true; S.open = false; };
    p.querySelectorAll(".cm-tabs button").forEach((b) => b.onclick = () => setTab(b.dataset.tab));
    for (const [kind, text] of QUICK) { const b = el("button", null, text); b.type = "button"; b.onclick = () => send(text, kind); $("cmQuick").appendChild(b); }
    $("cmForm").onsubmit = (e) => { e.preventDefault(); const t = $("cmText").value.trim(); if (t) send(t, "msg").then((ok) => ok && ($("cmText").value = "")); };
  }

  let toastT = null;
  function toast(text) {
    const t = $("cmToast"); if (!t) return;
    t.textContent = text; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 4200);
  }

  function setTab(tab) {
    S.tab = tab;
    document.querySelectorAll("#cmPanel .cm-tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === tab));
    $("cmTalkBar").hidden = tab !== "talk";
    render();
  }

  function openPanel() {
    syncRoom();
    $("cmPanel").hidden = false; S.open = true;
    render();
  }

  // ---------- 닉네임 ----------
  function nickForm(body) {
    const f = el("form", "cm-form");
    f.innerHTML = `<b>닉네임을 정해 주세요</b>
      <div class="cm-note">회원가입 없이 닉네임으로만 참여해요. 다른 러너에게는 닉네임과 지역·코스 이름만 보이고, 내 위치는 보이지 않아요.</div>
      <div class="r"><input id="cmNick" maxlength="12" placeholder="예: 태화강러너" required><button class="cm-btn">시작</button></div>`;
    f.onsubmit = (e) => {
      e.preventDefault();
      const v = $("cmNick").value.trim().slice(0, 12);
      if (!v) return;
      ls.set("saflo_nick", v); render();
    };
    body.appendChild(f);
  }

  // ---------- 그리기 ----------
  function render() {
    const live = liveRunners();
    $("cmLiveN") && ($("cmLiveN").textContent = live.length ? live.length : "");
    const sub = $("cmRowSub");
    if (sub) sub.innerHTML = "";
    if (sub) {
      if (!S.room) sub.textContent = "지역을 고르면 이 지역 러너들과 이야기할 수 있어요";
      else if (live.length) { const s = el("span", "cm-live"); s.append(el("i"), `지금 ${live.length}명 달리는 중`); sub.append(s, ` · ${roomLabel()} 이야기방`); }
      else sub.textContent = `${roomLabel()} 러너 이야기방 · 새 글 ${S.msgs.filter((m) => Date.now() - tsMs(m) < 86400000).length}개`;
    }
    if (!S.open) return;
    $("cmRoom").textContent = S.room ? `${roomLabel()} · 지역 이야기방` : "";
    const body = $("cmBody"); body.innerHTML = "";
    if (S.err) { body.appendChild(el("div", "cm-empty", S.err)); return; }
    if (!S.room) { body.appendChild(el("div", "cm-empty", "먼저 지도에서 달릴 지역(시군구)을 골라 주세요.")); $("cmTalkBar").hidden = true; return; }
    if (!nick()) { nickForm(body); $("cmTalkBar").hidden = true; return; }
    $("cmTalkBar").hidden = S.tab !== "talk";
    if (!S.uid) { body.appendChild(el("div", "cm-empty", "연결하는 중…")); return; }
    if (S.tab === "talk") renderTalk(body);
    else if (S.tab === "live") renderLive(body, live);
    else renderMeet(body);
  }

  function renderTalk(body) {
    if (!S.msgs.length) { body.appendChild(el("div", "cm-empty", "아직 글이 없어요.\n화장실이 잠겼거나 길이 막혔으면 아래 버튼으로 바로 알려 주세요.")); return; }
    for (const m of S.msgs) {
      const d = el("div", `cm-msg ${m.kind || "msg"}${m.uid === S.uid ? " mine" : ""}`);
      const meta = el("div", "meta");
      meta.append(el("b", null, m.nick || "러너"));
      if (m.kind === "alert") meta.append(el("span", "tag", "길·시설 알림"));
      if (m.kind === "cheer") meta.append(el("span", "tag", `👏 ${m.toNick || "러너"}님에게`));
      if (m.course) meta.append(el("span", null, m.course));
      meta.append(el("span", null, ago(tsMs(m))));
      if (m.uid === S.uid) { const x = el("button", "del", "삭제"); x.onclick = () => del(m); meta.append(x); }
      d.append(meta, el("div", null, m.text));
      body.appendChild(d);
    }
  }

  function renderLive(body, live) {
    const note = el("div", "cm-note", "러닝을 시작하면 이 목록에 내 닉네임과 코스 이름이 보여요. 정확한 위치는 공유하지 않아요. 👏를 누르면 그 러너의 이어폰과 워치로 응원이 가요.");
    if (!live.length) { body.append(el("div", "cm-empty", `지금 ${roomLabel()}에서 달리는 러너가 없어요.`), note); return; }
    for (const r of live) {
      const d = el("div", "cm-runner");
      const t = el("div", "t");
      t.append(el("b", null, r.id === S.uid ? `${r.nick} (나)` : r.nick),
               el("small", null, `${r.course || "자유 코스"}${r.km ? ` · ${Number(r.km).toFixed(1)}km 째` : ""} · ${ago(tsMs(r))} 신호`));
      d.append(el("div", "av", "🏃"), t);
      if (r.id !== S.uid) {
        const b = el("button", "cm-btn", "👏 응원");
        b.onclick = () => { b.disabled = true; cheer(r).finally(() => setTimeout(() => (b.disabled = false), 5000)); };
        d.append(b);
      }
      body.appendChild(d);
    }
    body.appendChild(note);
  }

  let meetForm = null;                       // 다시 그려도 입력 중인 내용이 지워지지 않게 한 번만 만듦
  function renderMeet(body) {
    if (!meetForm) {
      const f = meetForm = el("form", "cm-form");
      f.innerHTML = `<b>같이 뛸 사람 모집하기</b>
        <input id="cmMTitle" maxlength="60" placeholder="예: 태화강 국가정원 한 바퀴, 초보 환영" required>
        <div class="r"><input id="cmMWhen" type="datetime-local" required aria-label="날짜와 시간">
          <select id="cmMKm" aria-label="거리"><option value="3">3km</option><option value="5" selected>5km</option><option value="10">10km</option></select></div>
        <button class="cm-btn">모집 글 올리기</button>`;
      f.onsubmit = (e) => { e.preventDefault(); addMeet(f.querySelector("#cmMTitle").value.trim(), f.querySelector("#cmMWhen").value, +f.querySelector("#cmMKm").value).then((ok) => ok && f.reset()); };
    }
    const f = meetForm;
    body.appendChild(f);
    const now = Date.now();
    const list = S.meets.filter((m) => !m.at || m.at > now - 3 * 3600e3).sort((a, b) => (a.at || 0) - (b.at || 0));
    if (!list.length) { body.appendChild(el("div", "cm-empty", "아직 모집 글이 없어요.")); return; }
    for (const m of list) {
      const joins = Array.isArray(m.joins) ? m.joins : [], mine = joins.includes(S.uid);
      const d = el("div", "cm-meet"), t = el("div", "t");
      t.append(el("b", null, m.title), el("small", null, `${m.when || ""} · ${m.km}km · ${m.nick} · ${joins.length}명 참여`));
      const b = el("button", `cm-btn${mine ? " ghost" : ""}`, m.uid === S.uid ? "삭제" : mine ? "참여 취소" : "참여");
      b.onclick = () => (m.uid === S.uid ? delMeet(m) : join(m, !mine));
      d.append(t, b); body.appendChild(d);
    }
  }

  // ---------- 지역(방) 바꾸기 ----------
  function syncRoom() {
    const code = state && state.cur || null;
    if (code === S.room) return;
    S.subs.forEach((u) => { try { u(); } catch (e) {} }); S.subs = [];
    S.room = code; S.msgs = []; S.runners = []; S.meets = [];
    if (S.running) beat();                                 // 달리는 중에 지역이 바뀌면 그 지역으로 옮김
    if (code && F) subscribe(code);
    render();
  }

  function subscribe(code) {
    const { db, collection, query, orderBy, limit, where, onSnapshot } = F;
    const fail = (e) => { console.error("커뮤니티", e); S.err = "커뮤니티 서버에 연결하지 못했어요. 잠시 후 다시 열어 주세요."; render(); };
    S.subs.push(onSnapshot(query(collection(db, "rooms", code, "msgs"), orderBy("ts", "desc"), limit(60)), (snap) => {
      S.err = null;
      S.msgs = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
      for (const ch of snap.docChanges()) if (ch.type === "added") incoming({ id: ch.doc.id, ...ch.doc.data({ serverTimestamps: "estimate" }) });
      render();
    }, fail));
    S.subs.push(onSnapshot(query(collection(db, "runners"), where("room", "==", code)), (snap) => {
      S.runners = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })); render();
    }, fail));
    S.subs.push(onSnapshot(query(collection(db, "meets"), where("room", "==", code)), (snap) => {
      S.meets = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })); render();
    }, fail));
  }

  const liveRunners = () => S.runners.filter((r) => Date.now() - tsMs(r) < LIVE_MS).sort((a, b) => (a.id === S.uid ? -1 : b.id === S.uid ? 1 : tsMs(b) - tsMs(a)));

  // ---------- 새 글이 왔을 때: 달리는 중이면 읽어주고 워치로 ----------
  function incoming(m) {
    if (S.heard.has(m.id)) return; S.heard.add(m.id);
    if (m.uid === S.uid || tsMs(m) < S.since - 5000) return;     // 내 글, 앱 열기 전 글은 알리지 않음
    const toMe = m.kind === "cheer" && m.to === S.uid;
    if (m.kind === "cheer" && !toMe) return;
    if (!toMe && m.kind !== "alert" && !S.open) return;           // 일반 글은 창을 보고 있을 때만 화면에
    const say = toMe ? `${m.nick}님의 응원: ${m.text}` : m.kind === "alert" ? `${m.nick}님 알림: ${m.text}` : `${m.nick}: ${m.text}`;
    if (!S.open || toMe) toast(toMe ? `👏 ${m.nick}: ${m.text}` : say);
    if (S.running && (toMe || m.kind === "alert")) {
      try { window.VoiceCoach?.isOn?.() && window.VoiceCoach.say(say.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, "")); } catch (e) {}
      post({ type: "social", from: m.nick, fromUid: m.uid, text: m.text, kind: m.kind });
    }
  }

  // ---------- 쓰기 ----------
  async function ready() {
    if (!S.room) { toast("먼저 지역을 골라 주세요"); return false; }
    if (!nick()) { openPanel(); return false; }
    if (!F) { toast("아직 연결 중이에요"); return false; }
    if (Date.now() - S.lastPost < 2500) { toast("조금만 천천히 보내 주세요"); return false; }
    S.lastPost = Date.now(); return true;
  }
  async function send(text, kind, extra) {
    if (!(await ready())) return false;
    const d = { uid: S.uid, nick: nick(), text: String(text).slice(0, 140), kind, ts: F.serverTimestamp() };
    const c = courseName(); if (c) d.course = c;
    Object.assign(d, extra || {});
    try { await F.addDoc(F.collection(F.db, "rooms", S.room, "msgs"), d); return true; }
    catch (e) { console.error(e); toast("보내지 못했어요"); return false; }
  }
  const cheer = (r, text) => send(text || "힘내요! 끝까지 화이팅 💪", "cheer", { to: r.id, toNick: String(r.nick || "러너").slice(0, 12) });
  async function del(m) { try { await F.deleteDoc(F.doc(F.db, "rooms", S.room, "msgs", m.id)); } catch (e) { toast("삭제하지 못했어요"); } }

  async function addMeet(title, whenLocal, km) {
    if (!title || !whenLocal || !(await ready())) return false;
    const at = new Date(whenLocal).getTime();
    const when = new Date(at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
    try {
      await F.addDoc(F.collection(F.db, "meets"), { room: S.room, uid: S.uid, nick: nick(), title: title.slice(0, 60), when, at, km, joins: [S.uid], ts: F.serverTimestamp() });
      toast("모집 글을 올렸어요"); return true;
    } catch (e) { console.error(e); toast("올리지 못했어요"); return false; }
  }
  async function join(m, on) {
    try { await F.updateDoc(F.doc(F.db, "meets", m.id), { joins: on ? F.arrayUnion(S.uid) : F.arrayRemove(S.uid) }); }
    catch (e) { console.error(e); toast("처리하지 못했어요"); }
  }
  async function delMeet(m) { try { await F.deleteDoc(F.doc(F.db, "meets", m.id)); } catch (e) { toast("삭제하지 못했어요"); } }

  // ---------- 달리는 중 표시 ----------
  async function beat() {
    if (!F || !S.running || !S.room || !nick()) return;
    const d = { room: S.room, nick: nick(), km: Math.round(S.runDist / 100) / 10, ts: F.serverTimestamp() };
    const c = courseName(); if (c) d.course = c;
    try { await F.setDoc(F.doc(F.db, "runners", S.uid), d); } catch (e) { console.error(e); }
  }
  function runStart() {
    S.running = true; S.runDist = 0; syncRoom(); beat();
    clearInterval(S.beat); S.beat = setInterval(beat, 45000);
  }
  async function runStop() {
    if (!S.running) return;
    S.running = false; clearInterval(S.beat);
    if (F) try { await F.deleteDoc(F.doc(F.db, "runners", S.uid)); } catch (e) {}
  }

  // 휴대폰 앱(러닝 시작/종료)과 워치(답장)를 같은 채널에서 들음
  if (bc) bc.addEventListener("message", (e) => {
    const m = e.data || {};
    if (m.type === "start") runStart();
    else if (m.type === "tick") { if (!S.running) runStart(); if (m.dist != null) S.runDist = m.dist; }
    else if (m.type === "done" || m.type === "idle") runStop();
    else if (m.cmd === "reply" && m.text) {
      const r = m.to ? { id: m.to, nick: m.toNick } : null;
      (r ? cheer(r, m.text) : send(m.text, "msg")).then((ok) => ok && toast("워치에서 답장을 보냈어요"));
    }
  });
  window.addEventListener("pagehide", () => { if (S.running && F) try { F.deleteDoc(F.doc(F.db, "runners", S.uid)); } catch (e) {} });

  function init(_map, _state) {
    state = _state;
    buildUi();
    setInterval(() => { syncRoom(); if (S.runners.length && (!S.open || S.tab === "live")) render(); }, 1000);   // 지역이 바뀌었는지, "달리는 중" 시간 갱신
    loadFirebase().then((f) => {
      F = f; S.uid = f.uid;
      if (S.room) subscribe(S.room); else syncRoom();
      if (S.running) beat();
      render();
    }).catch((e) => { console.error("커뮤니티 연결 실패", e); S.err = "커뮤니티 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요."; render(); });
  }

  return { init, open: openPanel, send, _S: S };
})();
