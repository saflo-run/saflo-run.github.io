// SAFLO 러닝 아트: 달리고 나면 내가 달린 길을 한 장의 그림(아트 카드)으로
// - 러닝 완료 화면에 "러닝 아트 만들기" 버튼 → 스타일 고르기 · 제목 붙이기 · 이미지 저장/공유
// - 달린 기록은 이 휴대폰에 자동 보관 → 홈의 "내 러닝 아트"에서 다시 보기
// 휴대폰 앱과는 BroadcastChannel("runnavi")의 완료(done) 메시지로만 연결돼요. 없어도 앱은 그대로 동작해요.
window.RunArt = (() => {
  const KEY = "saflo_art", MAX = 40, W = 1080, H = 1350;
  const STYLES = {
    neon:   { name: "네온",     bg: "#0b0c0d", road: "rgba(255,255,255,.10)", road2: "rgba(200,242,91,.16)", line: "#c8f25b", glow: "rgba(200,242,91,.55)", ink: "#f3f5f2", sub: "#8f968f", accent: "#c8f25b", toilet: "#5bb8ff" },
    poster: { name: "포스터",   bg: "#f3efe4", road: "rgba(30,30,30,.10)",   road2: "rgba(30,30,30,.18)",   line: "#16181a", glow: null,                  ink: "#16181a", sub: "#6f6a5e", accent: "#e2553b", toilet: "#2a7de1" },
    sunset: { name: "노을",     bg: "#1b1033", road: "rgba(255,255,255,.08)", road2: "rgba(255,170,120,.18)", line: "#ffb36b", glow: "rgba(255,120,90,.6)",  ink: "#fff3e8", sub: "#b9a6c9", accent: "#ff7a6b", toilet: "#7fd3ff" },
    line:   { name: "선만",     bg: "#0b0c0d", road: null,                    road2: null,                   line: "#c8f25b", glow: "rgba(200,242,91,.45)", ink: "#f3f5f2", sub: "#8f968f", accent: "#c8f25b", toilet: null },
  };
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const store = {
    all() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } },
    save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); return true; } catch (e) { return false; } },
  };
  let state = null, cur = null, style = "neon";
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("runnavi") : null;

  const fmtTime = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`; };
  const fmtPace = (p) => (!p || !isFinite(p) ? "–" : `${Math.floor(p / 60)}'${String(Math.round(p % 60)).padStart(2, "0")}"`);
  const hav = (a, b) => { const R = 6371000, r = Math.PI / 180, dLa = (b[1] - a[1]) * r, dLo = (b[0] - a[0]) * r;
    const s = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
  function thin(pts, n) { if (pts.length <= n) return pts; const st = (pts.length - 1) / (n - 1); return Array.from({ length: n }, (_, i) => pts[Math.round(i * st)]); }

  // ---------- 화면 ----------
  function css() {
    const s = document.createElement("style");
    s.textContent = `
    #raPanel{position:fixed;inset:0;z-index:62;background:var(--bg);display:flex;flex-direction:column;max-width:560px;margin:0 auto}
    #raPanel[hidden]{display:none}
    .ra-head{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 16px 8px}
    .ra-head h2{flex:1;margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}
    .ra-x{width:40px;height:40px;border-radius:12px;background:var(--card);font-size:20px}
    .ra-body{flex:1;overflow-y:auto;padding:4px 16px 16px;display:flex;flex-direction:column;gap:12px}
    .ra-canvas{width:100%;aspect-ratio:4/5;border-radius:18px;overflow:hidden;background:#000;box-shadow:0 14px 40px rgba(0,0,0,.45)}
    .ra-canvas canvas{width:100%;height:100%;display:block}
    .ra-styles{display:flex;gap:6px}
    .ra-styles button{flex:1;height:38px;border-radius:12px;background:var(--card);color:var(--ink-2);font-weight:700;font-size:14px}
    .ra-styles button[aria-pressed="true"]{background:var(--lime);color:var(--lime-ink)}
    .ra-title{height:46px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:0 14px;font-size:16px;width:100%;box-sizing:border-box}
    .ra-row{display:flex;gap:8px}.ra-row .bigbtn{margin:0}
    .ra-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .ra-item{position:relative;border-radius:14px;overflow:hidden;background:#0b0c0d;aspect-ratio:4/5;text-align:left}
    .ra-item canvas{width:100%;height:100%;display:block}
    .ra-item span{position:absolute;left:0;right:0;bottom:0;padding:18px 10px 8px;font-size:12px;font-weight:700;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.75))}
    .ra-empty{color:var(--ink-2);text-align:center;padding:40px 8px;font-size:14px;line-height:1.6}
    .ra-note{font-size:12px;color:var(--ink-2);line-height:1.5;text-align:center}
    #raDoneBtn{margin-bottom:8px}`;
    document.head.appendChild(s);
  }
  function buildUi() {
    css();
    const p = el("section"); p.id = "raPanel"; p.hidden = true; p.setAttribute("aria-label", "러닝 아트");
    p.innerHTML = `<div class="ra-head"><h2 id="raTitle">러닝 아트</h2><button class="ra-x" id="raClose" aria-label="닫기">✕</button></div><div class="ra-body" id="raBody"></div>`;
    document.body.appendChild(p);
    $("raClose").onclick = () => (p.hidden = true);
    // 홈: 내 러닝 아트
    const row = el("button", "row"); row.id = "raRow";
    row.innerHTML = `<span class="ic" aria-hidden="true">🎨</span><span class="t"><b>내 러닝 아트</b><small id="raRowSub"></small></span><span class="go" aria-hidden="true">›</span>`;
    row.onclick = () => openGallery();
    const anchor = $("cmRow") || $("watchRow") || $("courseRow");
    if (anchor) anchor.after(row);
    rowSub();
    // 완료 화면: 러닝 아트 만들기
    const home = $("btnHome");
    if (home) { const b = el("button", "bigbtn", "🎨 내가 달린 길로 러닝 아트 만들기"); b.id = "raDoneBtn"; b.onclick = () => cur && openEditor(cur); home.before(b); home.classList.add("alt"); }
  }
  function rowSub() { const n = store.all().length, s = $("raRowSub"); if (s) s.textContent = n ? `달린 길 ${n}개가 그림으로 남아 있어요` : "러닝을 끝내면 달린 길이 그림으로 남아요"; }

  // ---------- 그리기 ----------
  function project(trace, box) {
    const lat0 = trace.reduce((s, c) => s + c[1], 0) / trace.length, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [lo, la] of trace) { const x = lo * kx, y = la * ky; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = Math.max(x1 - x0, 60), h = Math.max(y1 - y0, 60), s = Math.min(box.w / w, box.h / h);
    const ox = box.x + (box.w - w * s) / 2 - (x0 - (w - (x1 - x0)) / 2) * s, oy = box.y + (box.h - h * s) / 2 + (y1 + (h - (y1 - y0)) / 2) * s;
    const f = ([lo, la]) => [lo * kx * s + ox, oy - la * ky * s];
    f.inv = { x0: (box.x - ox) / s / kx, x1: (box.x + box.w - ox) / s / kx, y0: (oy - box.y - box.h) / s / ky, y1: (oy - box.y) / s / ky };
    f.mPerPx = 1 / s;
    return f;
  }
  function roadsIn(bb) {
    const out = [];
    if (!state || !state.loaded) return out;
    const padX = (bb.x1 - bb.x0) * .25, padY = (bb.y1 - bb.y0) * .25;
    const inb = (c) => c[0] > bb.x0 - padX && c[0] < bb.x1 + padX && c[1] > bb.y0 - padY && c[1] < bb.y1 + padY;
    for (const reg of state.loaded.values()) for (const f of reg.lines || []) {
      const cs = f.geometry.coordinates;
      if (inb(cs[0]) || inb(cs[cs.length - 1]) || inb(cs[cs.length >> 1])) { out.push([f.properties.r, cs]); if (out.length > 6000) return out; }
    }
    return out;
  }
  function toiletsOn(trace) {
    if (!state || !state.toilets) return [];
    const pts = thin(trace, 200);
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const pad = .001;
    return state.toilets.filter((t) => t.ll[0] > x0 - pad && t.ll[0] < x1 + pad && t.ll[1] > y0 - pad && t.ll[1] < y1 + pad && pts.some((p) => hav(p, t.ll) <= 80)).map((t) => t.ll);
  }
  const font = () => getComputedStyle(document.body).fontFamily || "sans-serif";

  function draw(cv, run, st, small) {
    const S = STYLES[st] || STYLES.neon, ctx = cv.getContext("2d"), F = font();
    cv.width = W; cv.height = H;
    ctx.fillStyle = S.bg; ctx.fillRect(0, 0, W, H);
    const box = small ? { x: 80, y: 120, w: W - 160, h: H - 300 } : { x: 96, y: 250, w: W - 192, h: 760 };
    const P = project(run.trace, box);
    // 배경: 실제 러닝 길 (전용로는 조금 더 밝게)
    if (S.road && !small) {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const [r, cs] of roadsIn(P.inv)) {
        ctx.strokeStyle = r === 0 ? S.road2 : S.road; ctx.lineWidth = r === 0 ? 3.2 : 2;
        ctx.beginPath(); cs.forEach((c, i) => { const [x, y] = P(c); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      }
      // 그림 영역 밖은 배경색으로 부드럽게
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, S.bg); g.addColorStop(.17, S.bg + "00"); g.addColorStop(.75, S.bg + "00"); g.addColorStop(.82, S.bg);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // 달린 길
    const pts = run.trace.map(P);
    const stroke = (w, c, blur, glowC) => {
      ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = w; ctx.strokeStyle = c;
      if (blur) { ctx.shadowBlur = blur; ctx.shadowColor = glowC; }
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
    };
    const lw = small ? 22 : 15;
    if (S.glow) { stroke(lw * 2.4, S.glow.replace(/[\d.]+\)$/, ".18)"), 0); stroke(lw, S.line, 38, S.glow); }
    stroke(lw, S.line, 0);
    // 지나간 화장실
    if (S.toilet && !small) for (const ll of (run.toiletLL || [])) {
      const [x, y] = P(ll);
      ctx.fillStyle = S.toilet; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = S.bg; ctx.lineWidth = 4; ctx.stroke();
    }
    // 출발·도착
    const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
    ctx.fillStyle = S.bg; ctx.strokeStyle = S.line; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(sx, sy, small ? 20 : 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = S.accent; ctx.beginPath(); ctx.arc(ex, ey, small ? 18 : 13, 0, Math.PI * 2); ctx.fill();
    if (small) return;

    // 위: 제목
    ctx.textBaseline = "alphabetic"; ctx.fillStyle = S.accent;
    ctx.font = `900 34px ${F}`; ctx.fillText("SAFLO RUN ART", 96, 112);
    ctx.fillStyle = S.ink; ctx.font = `800 64px ${F}`;
    fitText(ctx, run.title || "나의 러닝", 96, 190, W - 192, 64, F);
    ctx.fillStyle = S.sub; ctx.font = `600 28px ${F}`; ctx.textAlign = "right";
    ctx.fillText(run.dateText || "", W - 96, 112); ctx.textAlign = "left";
    // 아래: 기록
    const stats = [["거리", `${(run.dist / 1000).toFixed(2)}`, "km"], ["시간", fmtTime(run.time), ""], ["페이스", fmtPace(run.pace), "/km"],
      run.steps ? ["걸음", run.steps.toLocaleString(), ""] : ["지나간 화장실", `${run.toilets ?? 0}`, "곳"]];
    const y0 = 1105, cw = (W - 192) / 4;
    ctx.strokeStyle = S.sub; ctx.globalAlpha = .35; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(96, y0 - 50); ctx.lineTo(W - 96, y0 - 50); ctx.stroke(); ctx.globalAlpha = 1;
    stats.forEach(([k, v, u], i) => {
      const x = 96 + cw * i;
      ctx.fillStyle = S.sub; ctx.font = `600 26px ${F}`; ctx.fillText(k, x, y0);
      ctx.fillStyle = S.ink; ctx.font = `800 54px ${F}`; ctx.fillText(v, x, y0 + 64);
      if (u) { const w = ctx.measureText(v).width; ctx.fillStyle = S.sub; ctx.font = `700 26px ${F}`; ctx.fillText(u, x + w + 6, y0 + 64); }
    });
    ctx.fillStyle = S.sub; ctx.font = `600 26px ${F}`;
    ctx.fillText(run.place || "", 96, H - 74);
    ctx.textAlign = "right"; ctx.fillStyle = S.accent; ctx.font = `800 26px ${F}`; ctx.fillText("saflo-run.github.io", W - 96, H - 74); ctx.textAlign = "left";
  }
  function fitText(ctx, t, x, y, maxW, size, F) {
    let s = size; ctx.font = `800 ${s}px ${F}`;
    while (ctx.measureText(t).width > maxW && s > 30) { s -= 2; ctx.font = `800 ${s}px ${F}`; }
    ctx.fillText(t, x, y);
  }

  // ---------- 편집 화면 ----------
  function openEditor(run) {
    const body = $("raBody"); body.innerHTML = ""; $("raTitle").textContent = "러닝 아트 만들기";
    const box = el("div", "ra-canvas"), cv = document.createElement("canvas"); box.appendChild(cv);
    const styles = el("div", "ra-styles");
    for (const [k, s] of Object.entries(STYLES)) {
      const b = el("button", null, s.name); b.setAttribute("aria-pressed", k === style); b.onclick = () => { style = k; styles.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(cv, run, style); };
      styles.appendChild(b);
    }
    const t = el("input", "ra-title"); t.maxLength = 24; t.value = run.title || ""; t.placeholder = "제목 (예: 태화강 강아지 런)"; t.setAttribute("aria-label", "그림 제목");
    t.oninput = () => { run.title = t.value.trim() || run.defTitle; draw(cv, run, style); update(run); };
    const r1 = el("div", "ra-row");
    const save = el("button", "bigbtn", "이미지 저장 · 공유"); save.onclick = () => share(cv, run);
    r1.append(save);
    const gal = el("button", "bigbtn alt", "내 러닝 아트 모아보기"); gal.onclick = openGallery;
    body.append(box, styles, t, r1, gal, el("div", "ra-note", "출발점은 빈 원, 도착점은 채운 원이에요. 파란 점은 지나간 화장실이에요."));
    $("raPanel").hidden = false;
    requestAnimationFrame(() => draw(cv, run, style));
  }
  async function share(cv, run) {
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    const name = `saflo-art-${(run.id || Date.now())}.png`;
    try {
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: run.title || "SAFLO 러닝 아트" }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // ---------- 갤러리 ----------
  function openGallery() {
    const body = $("raBody"); body.innerHTML = ""; $("raTitle").textContent = "내 러닝 아트";
    const list = store.all();
    if (!list.length) { body.appendChild(el("div", "ra-empty", "아직 그림이 없어요.\n코스를 골라 달리고 나면 내가 달린 길이 여기에 그림으로 남아요.")); $("raPanel").hidden = false; return; }
    const g = el("div", "ra-grid");
    for (const run of list) {
      const b = el("button", "ra-item"), cv = document.createElement("canvas");
      b.append(cv, el("span", null, `${run.title} · ${(run.dist / 1000).toFixed(1)}km`));
      b.onclick = () => openEditor(run);
      g.appendChild(b);
      requestAnimationFrame(() => draw(cv, run, "neon", true));
    }
    body.append(g, el("div", "ra-note", "그림은 이 휴대폰에만 저장돼요."));
    $("raPanel").hidden = false;
  }
  function update(run) { const list = store.all(), i = list.findIndex((x) => x.id === run.id); if (i >= 0) { list[i] = slim(run); store.save(list); } }
  const slim = (r) => ({ ...r, trace: thin(r.trace, 300).map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]) });

  // ---------- 러닝이 끝나면 ----------
  function onDone(m) {
    if (!m.trace || m.trace.length < 2) return;
    const reg = state && state.cur && state.loaded && state.loaded.get(state.cur);
    const label = state && state.cur && state.byCode ? state.byCode[state.cur].label : "";
    const d = new Date();
    const defTitle = reg && reg.courseName ? reg.courseName : `${label.split(" ").slice(-1)[0] || ""} 러닝`.trim();
    const full = (state && state.trace && state.trace.length > m.trace.length) ? state.trace : m.trace;
    cur = { id: d.getTime(), title: defTitle, defTitle, dist: m.dist, time: m.time, pace: m.pace, toilets: m.toilets, steps: m.steps || null,
      place: label, dateText: `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      trace: thin(full, 1200), toiletLL: toiletsOn(full).slice(0, 40) };
    const list = store.all(); list.unshift(slim(cur)); store.save(list); rowSub();
  }
  if (bc) bc.addEventListener("message", (e) => { const m = e.data || {}; if (m.type === "done") onDone(m); });

  function init(_map, _state) { state = _state; buildUi(); }
  return { init, open: openGallery, _draw: draw, _onDone: onDone };
})();
