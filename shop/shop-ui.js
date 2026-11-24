/* 상점 화면: 홈 시트의 '아바타 상점' 줄 → 상점 창(코인 잔액 · 3D 미리보기 · 부위별 탭 · 상품) → 코인 충전 창 */
import { CATEGORIES, ITEMS, COIN_PACKS } from "./items.js";
import * as wallet from "./wallet.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmt = (n) => n.toLocaleString("ko-KR");
const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || "";

/* createPreview(칸) → 3D 미리보기를 칸에 붙이고 { setMoving } 를 돌려줌 (안 되면 null) */
export function createShopUI({ createPreview }) {
  let tab = "all", packIdx = 0, previewStarted = false, preview = null, toastT = null;

  /* ---------- 뼈대 ---------- */
  const row = el("button", "row"); row.id = "shopRow";
  row.innerHTML = `<span class="ic" aria-hidden="true">🛍️</span>
    <span class="t"><b>아바타 상점</b><small id="shopRowSub"></small></span>
    <span class="go" aria-hidden="true">›</span>`;
  const anchor = $("rkRow") || $("cmRow") || $("watchRow") || $("courseRow");
  if (anchor) anchor.after(row);
  else { row.classList.add("sp-fab"); document.body.appendChild(row); }      // 놓을 자리가 없으면 떠 있는 버튼으로

  const panel = el("section"); panel.id = "shopPanel"; panel.hidden = true;
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", "아바타 상점");
  panel.innerHTML = `
    <div class="sp-head"><h2>아바타 상점</h2><button class="sp-x" id="spClose" aria-label="닫기">✕</button></div>
    <button class="sp-wallet" id="spWallet" aria-label="러닝코인 충전하기">
      <span class="sp-coin" aria-hidden="true">🪙</span>
      <span class="sp-bal"><small>내 러닝코인</small><b id="spBal" class="num"></b></span>
      <span class="sp-plus">충전 +</span>
    </button>
    <div class="sp-stage"><div class="sp-preview" id="spPreview" title="눌러서 달리는 모습 보기"></div></div>
    <div class="sp-tabs" id="spTabs" role="group" aria-label="부위"></div>
    <div class="sp-grid" id="spGrid"></div>
    <div class="sp-sheet-wrap" id="spCharge" hidden>
      <div class="sp-scrim" id="spScrim"></div>
      <div class="sp-sheet" role="dialog" aria-modal="true" aria-label="러닝코인 충전">
        <div class="sp-grip"></div>
        <h3>러닝코인 충전</h3>
        <p class="sp-note" id="spNote">데모 버전이에요. 실제로 결제되지는 않고 코인만 채워져요.</p>
        <div class="sp-packs" id="spPacks"></div>
        <button class="sp-pay" id="spPay"></button>
      </div>
    </div>
    <div class="sp-toast" id="spToast" role="status" aria-live="polite"></div>`;
  document.body.appendChild(panel);

  /* ---------- 그리기 ---------- */
  function renderWallet() {
    const c = wallet.getCoins();
    $("spBal").textContent = `${fmt(c)} 코인`;
    $("shopRowSub").textContent = `🪙 ${fmt(c)} 코인 · 아바타 꾸미기`;
  }

  function renderTabs() {
    const box = $("spTabs"); box.textContent = "";
    for (const c of [{ id: "all", label: "전체" }, ...CATEGORIES]) {
      const b = el("button", null, c.label);
      b.setAttribute("aria-pressed", String(c.id === tab));
      b.onclick = () => { tab = c.id; renderTabs(); renderGrid(); };
      box.appendChild(b);
    }
  }

  function renderGrid() {
    const box = $("spGrid"); box.textContent = "";
    const list = ITEMS.filter((i) => tab === "all" || i.category === tab);
    if (!list.length) { box.appendChild(el("div", "sp-empty", "이 부위는 아직 상품이 없어요.")); return; }
    for (const it of list) {
      const own = wallet.isOwned(it.id), on = wallet.isEquipped(it.id);
      const card = el("article", "sp-card" + (on ? " on" : ""));
      const img = el("div", "sp-img");
      if (it.image) { const im = el("img"); im.src = it.image; im.alt = ""; im.loading = "lazy"; img.appendChild(im); }
      card.append(img, el("small", "sp-cat", catLabel(it.category)), el("b", "sp-name", it.name),
        el("div", "sp-price num", own ? "보유 중" : `🪙 ${fmt(it.price)}`));
      const btn = el("button", "sp-btn" + (!own ? " buy" : on ? " off" : ""), !own ? "구매" : on ? "착용 중 · 해제" : "착용");
      btn.onclick = () => {
        if (!own) {
          const r = wallet.buyItem(it.id);
          if (r.ok) toast(`${it.name} 구매 완료! 바로 입혀 봤어요`);
          else if (r.reason === "coins") { toast(`코인이 ${fmt(r.need)}개 모자라요`); openCharge(`코인이 ${fmt(r.need)}개 모자라요. 충전하고 다시 구매해 보세요.`); }
        } else if (on) wallet.unequip(it.category);
        else wallet.equipItem(it.id);
      };
      card.appendChild(btn);
      box.appendChild(card);
    }
  }

  function renderPacks() {
    const box = $("spPacks"); box.textContent = "";
    COIN_PACKS.forEach((p, i) => {
      const b = el("button", "sp-pack");
      b.setAttribute("aria-pressed", String(i === packIdx));
      b.append(el("span", "c", `🪙 ${fmt(p.coins)} 코인`), el("span", "w num", `${fmt(p.won)}원`));
      b.onclick = () => { packIdx = i; renderPacks(); };
      box.appendChild(b);
    });
    const p = COIN_PACKS[packIdx];
    $("spPay").textContent = `${fmt(p.won)}원 결제하고 ${fmt(p.coins)}코인 받기`;
  }

  function renderAll() { renderWallet(); renderTabs(); renderGrid(); }

  /* ---------- 열고 닫기 ---------- */
  function toast(text) {
    const t = $("spToast"); t.textContent = text; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2200);
  }
  function open() {
    panel.hidden = false; renderAll();
    if (!previewStarted) {                                   // 3D 미리보기는 처음 열 때만 만듦
      previewStarted = true;
      Promise.resolve(createPreview($("spPreview"))).then((p) => {
        preview = p;
        if (!p) $("spPreview").classList.add("off");
      });
    }
    $("spClose").focus();
  }
  function close() { closeCharge(); panel.hidden = true; row.focus?.(); }
  function openCharge(note) {
    $("spNote").textContent = note || "데모 버전이에요. 실제로 결제되지는 않고 코인만 채워져요.";
    renderPacks(); $("spCharge").hidden = false; $("spPay").focus();
  }
  function closeCharge() { $("spCharge").hidden = true; }

  row.onclick = open;
  $("spClose").onclick = close;
  $("spWallet").onclick = () => openCharge();
  $("spScrim").onclick = closeCharge;
  $("spPay").onclick = () => {
    const p = COIN_PACKS[packIdx];
    wallet.addCoins(p.coins);                                // 데모: 결제 없이 바로 지급 (실서비스는 결제 완료 후 서버에서 지급)
    closeCharge(); toast(`${fmt(p.coins)}코인이 충전됐어요`);
  };
  let running = false;
  $("spPreview").onclick = () => { if (!preview) return; running = !running; preview.setMoving(running); };
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || panel.hidden) return;
    if (!$("spCharge").hidden) closeCharge(); else close();
  });

  wallet.subscribe(() => { renderWallet(); if (!panel.hidden) renderGrid(); });
  renderWallet();
  return { open, close };
}
