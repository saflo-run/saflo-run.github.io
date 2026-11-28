/* 상품 카드 사진: items.js 에 image 가 비어 있으면, 3D 아바타에 그 상품만 입혀서 그 부위를 가까이 찍어요.
 * 사진 찍기용 아바타 하나를 같이 쓰고, 한 장씩 차례로 찍어서 휴대폰에 무리가 없게 해요.
 *   getThumb(상품) → Promise<사진 주소(dataURL)>
 *
 * 부위별 카메라 위치는 VIEWS 에서 바꾸면 돼요.
 *   target: 카메라가 보는 곳 [x, y(높이, 발바닥 0 · 머리 1.78), z(앞 +)]
 *   dist: 거리 · yaw: 도는 각도(0 = 정면, + = 아바타 왼쪽에서) · height: 위에서 내려다보는 정도
 */
import { createAvatar } from "./avatar3d.js";
import { slotOf } from "./items.js";

const SIZE = 220;
const VIEWS = {
  hair:        { target: [0, 1.8, -0.03], dist: 1.4,  yaw: 1.1,  height: 0.12 },
  "acc-head":  { target: [0, 1.82, 0],    dist: 1.35, yaw: 0.55, height: 0.12 },
  "acc-face":  { target: [0, 1.77, 0],    dist: 1.25, yaw: 0.5,  height: 0.05 },
  top:         { target: [0, 1.25, 0],    dist: 2.8,  yaw: 0.4,  height: 0.08 },
  bottom:      { target: [0, 0.62, 0],    dist: 2.6,  yaw: 0.4,  height: 0.05 },
  shoes:       { target: [0.03, 0.07, 0.05], dist: 1.25, yaw: 1.05, height: 0.32 },
  "acc-back":  { target: [0, 1.25, 0],    dist: 2.4,  yaw: Math.PI - 0.7, height: 0.1 },
  "acc-wrist": { target: [-0.3, 0.88, 0.04], dist: 1.15, yaw: -1.15, height: 0.12 },
};

let avP = null;
let queue = Promise.resolve();
const cache = new Map();

export function getThumb(item) {
  if (item.image) return Promise.resolve(item.image);        // 직접 넣은 사진이 있으면 그걸 씀
  if (cache.has(item.id)) return cache.get(item.id);
  const p = queue.then(async () => {
    avP ??= createAvatar(document.createElement("div"), { width: SIZE, height: SIZE, preserve: true, still: true })
      .catch((e) => { avP = null; throw e; });
    const av = await avP;
    await new Promise((r) => setTimeout(r, 0));             // 한 장 찍고 화면에 숨 돌릴 틈 주기
    const slot = slotOf(item);
    return av.snapshot({ [slot]: item }, VIEWS[slot]);
  });
  queue = p.catch(() => {});
  cache.set(item.id, p);
  p.catch(() => cache.delete(item.id));
  return p;
}
