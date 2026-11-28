/* 러닝코인 지갑 · 보유 아이템 · 착용 상태
 * 지금은 데모라서 이 휴대폰(localStorage)에만 저장해요.
 * 나중에 서버(Firebase 등)로 옮길 때는 이 파일의 load/save 부분만 바꾸면 돼요.
 */
import { ITEMS, slotOf } from "./items.js";

const KEY = { coins: "saflo_coins", owned: "saflo_shop_owned", equipped: "saflo_shop_equipped" };

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 못 해도 앱은 계속 */ } },
};
const readJSON = (k, fallback) => { try { const v = JSON.parse(store.get(k)); return v ?? fallback; } catch (e) { return fallback; } };
const itemById = (id) => ITEMS.find((i) => i.id === id);

let coins = 0;
let owned = new Set();
let equipped = {};          // { 자리: 상품id }  자리 = hair · top · bottom · shoes · acc-head · acc-face · acc-back · acc-wrist
const listeners = new Set();

function load() {
  const c = Math.floor(Number(store.get(KEY.coins)));
  coins = Number.isFinite(c) && c > 0 ? c : 0;
  const o = readJSON(KEY.owned, []);
  owned = new Set(Array.isArray(o) ? o.filter((id) => itemById(id)) : []);
  const e = readJSON(KEY.equipped, {});
  equipped = {};
  for (const [slot, id] of Object.entries(e && typeof e === "object" ? e : {})) {
    const it = itemById(id);
    if (it && slotOf(it) === slot && owned.has(id)) equipped[slot] = id;   // 없어진 상품·다른 자리는 걸러냄
  }
}
function save() {
  store.set(KEY.coins, String(coins));
  store.set(KEY.owned, JSON.stringify([...owned]));
  store.set(KEY.equipped, JSON.stringify(equipped));
}
function emit() {
  for (const fn of listeners) { try { fn(); } catch (e) { console.error("상점 알림", e); } }
}

load();
// 다른 탭에서 바뀌면 따라가기
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("storage", (e) => { if (Object.values(KEY).includes(e.key)) { load(); emit(); } });
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const getCoins = () => coins;
export const isOwned = (id) => owned.has(id);
export const isEquipped = (id) => { const it = itemById(id); return !!it && equipped[slotOf(it)] === id; };

/* 자리별로 지금 입고 있는 상품 → { hair: 상품, top: 상품, "acc-head": 상품, ... } */
export function getEquippedItems() {
  const out = {};
  for (const [slot, id] of Object.entries(equipped)) out[slot] = itemById(id);
  return out;
}

/* 코인 넣기 (충전, 러닝 보상 등) */
export function addCoins(n) {
  n = Math.floor(Number(n));
  if (!(n > 0)) return false;
  coins += n; save(); emit();
  return true;
}

/* 구매: 성공하면 바로 착용까지 */
export function buyItem(id) {
  const it = itemById(id);
  if (!it) return { ok: false, reason: "none" };
  if (owned.has(id)) return { ok: false, reason: "owned" };
  if (coins < it.price) return { ok: false, reason: "coins", need: it.price - coins };
  coins -= it.price;
  owned.add(id);
  equipped[slotOf(it)] = id;
  save(); emit();
  return { ok: true, item: it };
}

export function equipItem(id) {
  const it = itemById(id);
  if (!it || !owned.has(id)) return false;
  equipped[slotOf(it)] = id; save(); emit();
  return true;
}

/* slot: 자리 이름 (slotOf(상품)) */
export function unequip(slot) {
  if (!equipped[slot]) return false;
  delete equipped[slot]; save(); emit();
  return true;
}

/* 여러 개를 한 번에: 안 가진 건 사고, 가진 건 입기 (입어보기 → "한번에 적용")
 * 코인이 모자라면 아무것도 바꾸지 않아요. */
export function buyAndEquipAll(ids) {
  const list = [...new Set(ids)].map(itemById).filter(Boolean);
  const cost = list.filter((it) => !owned.has(it.id)).reduce((s, it) => s + it.price, 0);
  if (coins < cost) return { ok: false, reason: "coins", need: cost - coins };
  coins -= cost;
  for (const it of list) { owned.add(it.id); equipped[slotOf(it)] = it.id; }
  save(); emit();
  return { ok: true, cost };
}
