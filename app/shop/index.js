/* 아바타 · 상점 시작점: 내 위치 마커에 3D 아바타를 붙이고, 상점 화면을 만든다 */
import * as wallet from "./wallet.js";
import { createAvatar } from "./avatar3d.js";
import { createShopUI } from "./shop-ui.js";

/* 지도 위 내 위치(.me)에 3D 아바타 붙이기. 실패하면 기존 아이콘이 그대로 남아요 */
async function mountMapAvatar(state) {
  const meEl = state?.meEl;
  if (!meEl) return;
  const host = document.createElement("div");
  host.className = "avatar3d";
  meEl.appendChild(host);
  let av;
  try { av = await createAvatar(host, { width: 84, height: 104 }); }
  catch (e) { host.remove(); console.warn("3D 아바타를 못 불러와서 기본 아이콘을 써요", e); return; }

  meEl.classList.add("has-avatar");
  const sync = () => av.setMoving(meEl.classList.contains("moving"));      // index.html 이 켜고 끄는 'moving' 을 따라감
  new MutationObserver(sync).observe(meEl, { attributes: true, attributeFilter: ["class"] });
  sync();
  const look = () => av.setLook(wallet.getEquippedItems());
  look();
  wallet.subscribe(look);
  state.avatar = av;
}

/* 상점 창 안의 큰 미리보기 (처음 열 때 만들어짐) */
async function createPreview(host) {
  try {
    const av = await createAvatar(host, { width: 140, height: 170, yaw: 0.5, spin: true });
    av.setLook(wallet.getEquippedItems());
    wallet.subscribe(() => av.setLook(wallet.getEquippedItems()));
    return av;
  } catch (e) { console.warn("3D 미리보기를 못 불러왔어요", e); return null; }
}

export function init(map, state) {
  createShopUI({ createPreview });
  mountMapAvatar(state);
}

/* 밖에서 쓸 수 있는 함수 (예: 러닝이 끝나면 window.Shop.addCoins(50)) */
export const addCoins = wallet.addCoins;
export const getCoins = wallet.getCoins;
