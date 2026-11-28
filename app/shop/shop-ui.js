/* 상점 화면: 홈 시트의 '아바타 상점' 줄 → 상점 창(코인 잔액 · 3D 미리보기 · 부위별 탭 · 상품) → 코인 충전 창
 *
 * 입어보기: 상품 사진을 누르면 위쪽 3D 미리보기에만 입혀져요 (코인은 안 듦, 지도 위 아바타는 그대로).
 *           여러 개를 섞어 입어볼 수 있고, '한번에 적용'을 누르면 안 가진 건 사고 가진 건 입어요.
 */
import { CATEGORIES, ITEMS, COIN_PACKS, slotOf, SLOT_LABEL } from "./items.js";
import * as wallet from "./wallet.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmt = (n) => n.toLocaleString("ko-KR");
const itemById = (id) => ITEMS.find((i) => i.id === id);
const catLabel = (it) => (it.category === "acc" ? SLOT_LABEL[slotOf(it)] : CATEGORIES.find((c) => c.id === it.category)?.label) || "";

/* createPreview(칸) → 3D 미리보기 아바타 (안 되면 null)
 * getThumb(상품) → Promise<사진 주소> (없거나 실패하면 빈 칸) */
export function createShopUI({ createPreview, getThumb }) {
  let tab = "all", packIdx = 0, previewStarted = false, preview = null, toastT = null;
  let tryOn = {};                 // 입어보는 중인 상품 { 자리: 상품id }

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
    <div class="sp-stage">
      <div class="sp-preview" id="spPreview" role="button" tabindex="0" aria-label="미리보기: 누르면 달리기, 옆으로 밀면 돌리기"></div>
      <small class="sp-hint" id="spHint">옆으로 밀어서 돌려보기 · 탭하면 달리기</small>
      <div class="sp-fit" id="spFit" hidden>
        <span class="sp-fit-t" id="spFitT"></span>
        <button class="sp-fit-reset" id="spFitReset">원래대로</button>
        <button class="sp-fit-apply" id="spFitApply"></button>
      </div>
    </div>
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

  /* ---------- 입어보기 ---------- */
  const previewLook = () => {
    const eq = wallet.getEquippedItems();
    for (const [slot, id] of Object.entries(tryOn)) eq[slot] = itemById(id);
    return eq;
  };
  const isTrying = (it) => tryOn[slotOf(it)] === it.id;
  function toggleTry(it) {
    const slot = slotOf(it);
    if (tryOn[slot] === it.id) delete tryOn[slot];
    else if (wallet.isEquipped(it.id)) { delete tryOn[slot]; toast("이미 입고 있는 상품이에요"); }
    else tryOn[slot] = it.id;
    afterTryChange();
  }
  function afterTryChange() {
    for (const [slot, id] of Object.entries(tryOn)) if (wallet.isEquipped(id)) delete tryOn[slot];   // 산 건 입어보기 목록에서 뺌
    preview?.setLook(previewLook());
    renderFit(); renderGrid();
  }
  function renderFit() {
    const ids = Object.values(tryOn);
    $("spFit").hidden = !ids.length;
    $("spHint").hidden = !!ids.length;
    if (!ids.length) return;
    const cost = ids.map(itemById).filter((it) => !wallet.isOwned(it.id)).reduce((s, it) => s + it.price, 0);
    $("spFitT").textContent = `입어보는 중 ${ids.length}개`;
    $("spFitApply").textContent = cost ? `🪙 ${fmt(cost)} 구매하고 입기` : "이대로 입기";
  }

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
      const own = wallet.isOwned(it.id), on = wallet.isEquipped(it.id), trying = isTrying(it);
      const card = el("article", "sp-card" + (on ? " on" : "") + (trying ? " trying" : ""));

      // 사진(누르면 입어보기)
      const img = el("button", "sp-img");
      img.setAttribute("aria-label", `${it.name} ${trying ? "입어보기 취소" : "입어보기"}`);
      img.setAttribute("aria-pressed", String(trying));
      const im = el("img"); im.alt = ""; im.decoding = "async"; img.appendChild(im);
      Promise.resolve(getThumb?.(it)).then((src) => { if (src) { im.src = src; img.classList.add("ready"); } }).catch(() => {});
      img.appendChild(el("span", "sp-try", trying ? "입어보는 중" : on ? "착용 중" : "입어보기"));
      img.onclick = () => toggleTry(it);

      card.append(img, el("small", "sp-cat", catLabel(it)), el("b", "sp-name", it.name));
      if (it.desc) card.appendChild(el("small", "sp-desc", it.desc));
      card.appendChild(el("div", "sp-price num", own ? "보유 중" : `🪙 ${fmt(it.price)}`));
      const btn = el("button", "sp-btn" + (!own ? " buy" : on ? " off" : ""), !own ? "구매" : on ? "착용 중 · 해제" : "착용");
      btn.onclick = () => {
        if (!own) {
          const r = wallet.buyItem(it.id);
          if (r.ok) toast(`${it.name} 구매 완료! 바로 입혀 봤어요`);
          else if (r.reason === "coins") { toast(`코인이 ${fmt(r.need)}개 모자라요`); openCharge(`코인이 ${fmt(r.need)}개 모자라요. 충전하고 다시 구매해 보세요.`); }
        } else if (on) wallet.unequip(slotOf(it));
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

  function renderAll() { renderWallet(); renderTabs(); renderGrid(); renderFit(); }

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
        if (!p) { $("spPreview").classList.add("off"); $("spHint").hidden = true; }
        else p.setLook(previewLook());
      });
    }
    $("spClose").focus();
  }
  function close() {
    closeCharge(); panel.hidden = true;
    if (Object.keys(tryOn).length) { tryOn = {}; preview?.setLook(previewLook()); }   // 닫으면 입어보기는 초기화
    row.focus?.();
  }
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
  $("spFitReset").onclick = () => { tryOn = {}; afterTryChange(); };
  $("spFitApply").onclick = () => {
    const r = wallet.buyAndEquipAll(Object.values(tryOn));
    if (r.ok) { tryOn = {}; afterTryChange(); toast(r.cost ? `🪙 ${fmt(r.cost)} 사용 · 입어본 대로 입었어요` : "입어본 대로 입었어요"); }
    else if (r.reason === "coins") openCharge(`코인이 ${fmt(r.need)}개 모자라요. 충전하고 다시 눌러 주세요.`);
  };

  /* 미리보기: 옆으로 밀면 돌리기, 짧게 누르면 달리기 켜고 끄기 */
  let running = false, drag = null;
  const pv = $("spPreview");
  pv.style.touchAction = "pan-y";
  pv.addEventListener("pointerdown", (e) => { if (!preview) return; drag = { x: e.clientX, moved: 0 }; preview.hold(true); pv.setPointerCapture?.(e.pointerId); });
  pv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx);
    preview.rotateBy(dx * 0.02);
  });
  const end = () => {
    if (!drag) return;
    const tap = drag.moved < 6; drag = null; preview.hold(false);
    if (tap) { running = !running; preview.setMoving(running); }
  };
  pv.addEventListener("pointerup", end);
  pv.addEventListener("pointercancel", () => { if (drag) { drag = null; preview.hold(false); } });
  pv.addEventListener("keydown", (e) => {
    if (!preview) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); running = !running; preview.setMoving(running); }
    if (e.key === "ArrowLeft") preview.rotateBy(-0.3);
    if (e.key === "ArrowRight") preview.rotateBy(0.3);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || panel.hidden) return;
    if (!$("spCharge").hidden) closeCharge(); else close();
  });

  wallet.subscribe(() => {
    renderWallet();
    for (const [slot, id] of Object.entries(tryOn)) if (wallet.isEquipped(id)) delete tryOn[slot];   // 산 건 입어보기 목록에서 뺌
    preview?.setLook(previewLook());
    if (!panel.hidden) { renderGrid(); renderFit(); }
  });
  renderWallet();
  return { open, close };
}
