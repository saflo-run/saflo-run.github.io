/* 3D 아바타 (three.js)
 * 기본 3D 사람 하나를 만들고, 착용한 상품에 맞춰 색·모자·가방 등을 바꿔요.
 *   const av = await createAvatar(칸, { width, height, yaw, spin });
 *   av.setLook(getEquippedItems())   // 부위별 착용 상품
 *   av.setMoving(true|false)         // 달리는 동작 켜고 끄기
 *   av.destroy()
 * three.js 를 못 불러오거나 WebGL 이 안 되면 createAvatar 가 에러를 던져요 (호출한 쪽에서 기본 아이콘으로 대체).
 */
const THREE_URL = "https://unpkg.com/three@0.160.0/build/three.module.js";
let threeP = null;
const loadThree = () => (threeP ??= import(THREE_URL).catch((e) => { threeP = null; throw e; }));

const BASE = { skin: "#f1c9a5", hair: "#2b211c", top: "#8d99a6", bottom: "#2b2f36", shoes: "#f2f2f2" };
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- 화면 그리기 루프 (아바타 여러 개가 하나를 같이 씀) ---- */
const live = new Set();
let raf = 0, lastT = 0;
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min((now - lastT) / 1000, 0.1); lastT = now;
  if (typeof document !== "undefined" && document.hidden) return;
  for (const a of live) a.frame(dt);
}
function register(a) { live.add(a); if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } }
function unregister(a) { live.delete(a); if (!live.size && raf) { cancelAnimationFrame(raf); raf = 0; } }

export async function createAvatar(host, opts = {}) {
  const THREE = opts.three || (await loadThree());      // opts.three: 테스트용
  const W = opts.width || 84, H = opts.height || 104;
  const baseYaw = opts.yaw ?? Math.PI + 0.55;            // 기본: 뒤쪽에서 살짝 비스듬히 (달리는 방향을 보는 모습)
  const spin = !!opts.spin && !reduceMotion();

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min((typeof devicePixelRatio === "number" && devicePixelRatio) || 1, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "내 아바타");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  camera.position.set(0, 1.55, 4.3);
  camera.lookAt(0, 0.92, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x66707c, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(2, 4, 3);
  scene.add(sun);

  /* ---- 몸 만들기 (앞쪽이 +z) ---- */
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const M = { skin: mat(BASE.skin), hair: mat(BASE.hair), top: mat(BASE.top), bottom: mat(BASE.bottom),
              shoes: mat(BASE.shoes), dark: mat("#1b1b1f"), cap: mat("#e4572e"), pack: mat("#8e44ad"), lens: mat("#15171a") };
  const put = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 12);

  const root = new THREE.Group();            // 보는 방향(회전)
  const body = new THREE.Group();            // 달릴 때 위아래·앞으로 기울기
  root.add(body); scene.add(root);

  const pelvis = put(capsule(0.19, 0.08), M.bottom, 0, 0.92); pelvis.scale.set(1.2, 1, 0.75);
  const torso = put(capsule(0.2, 0.34), M.top, 0, 1.2); torso.scale.set(1.15, 1, 0.72);
  body.add(pelvis, torso, put(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12), M.skin, 0, 1.62));

  const HEAD_Y = 1.78;
  const head = new THREE.Group(); head.position.set(0, HEAD_Y, 0);
  head.add(put(new THREE.SphereGeometry(0.17, 20, 16), M.skin));
  head.add(put(new THREE.SphereGeometry(0.017, 8, 8), M.dark, -0.06, -0.02, 0.158), put(new THREE.SphereGeometry(0.017, 8, 8), M.dark, 0.06, -0.02, 0.158));
  const hair = put(new THREE.SphereGeometry(0.182, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hair);
  hair.rotation.x = -0.45;                   // 앞이마는 드러나고 뒤통수는 덮이게 살짝 뒤로 젖힘
  head.add(hair);

  const cap = new THREE.Group();
  const dome = put(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M.cap, 0, 0.01, 0);
  dome.rotation.x = -0.2;
  const brim = put(new THREE.CylinderGeometry(0.2, 0.2, 0.018, 20, 1, false, -Math.PI / 2, Math.PI), M.cap, 0, 0.06, 0.02);
  brim.scale.z = 1.5; brim.rotation.x = 0.1;
  cap.add(dome, brim); cap.visible = false; head.add(cap);

  const glasses = new THREE.Group();
  glasses.add(put(new THREE.BoxGeometry(0.2, 0.02, 0.02), M.lens, 0, -0.015, 0.168),
              put(new THREE.BoxGeometry(0.08, 0.055, 0.02), M.lens, -0.052, -0.02, 0.168),
              put(new THREE.BoxGeometry(0.08, 0.055, 0.02), M.lens, 0.052, -0.02, 0.168));
  glasses.visible = false; head.add(glasses);
  body.add(head);

  const pack = new THREE.Group();
  pack.add(put(new THREE.BoxGeometry(0.34, 0.42, 0.17), M.pack, 0, 1.25, -0.23));
  pack.visible = false; body.add(pack);

  function arm(s) {                          // 어깨 → 팔꿈치
    const g = new THREE.Group(); g.position.set(s * 0.285, 1.46, 0);
    g.add(put(capsule(0.06, 0.2), M.top, 0, -0.17));
    const fore = new THREE.Group(); fore.position.set(0, -0.32, 0);
    fore.add(put(capsule(0.05, 0.2), M.skin, 0, -0.15), put(new THREE.SphereGeometry(0.055, 10, 8), M.skin, 0, -0.32));
    g.add(fore); body.add(g);
    return { g, fore };
  }
  function leg(s) {                          // 엉덩이 → 무릎 → 발
    const g = new THREE.Group(); g.position.set(s * 0.1, 0.9, 0);
    g.add(put(capsule(0.09, 0.22), M.bottom, 0, -0.2));
    const shin = new THREE.Group(); shin.position.set(0, -0.4, 0);
    shin.add(put(capsule(0.07, 0.26), M.skin, 0, -0.2), put(new THREE.BoxGeometry(0.13, 0.1, 0.28), M.shoes, 0, -0.43, 0.05));
    g.add(shin); body.add(g);
    return { g, shin };
  }
  const aL = arm(-1), aR = arm(1), lL = leg(-1), lR = leg(1);

  /* ---- 착용한 상품 반영 ---- */
  function setLook(eq = {}) {
    const col = (cat, base) => eq[cat]?.look?.color || base;
    M.top.color.set(col("top", BASE.top));
    M.bottom.color.set(col("bottom", BASE.bottom));
    M.shoes.color.set(col("shoes", BASE.shoes));
    const h = eq.head?.look, a = eq.acc?.look;
    cap.visible = h?.type === "cap";
    if (cap.visible) M.cap.color.set(h.color || "#e4572e");
    pack.visible = a?.type === "backpack";
    if (pack.visible) M.pack.color.set(a.color || "#8e44ad");
    glasses.visible = a?.type === "glasses";
    if (glasses.visible && a.color) M.lens.color.set(a.color);
    dirty = true;
  }

  /* ---- 동작 ---- */
  let moving = false, k = 0, phase = 0, spinA = 0, acc = 0, dirty = true;
  function pose() {
    const s = Math.sin(phase), c = Math.cos(phase);
    lL.g.rotation.x = s * 0.85 * k;               // 다리: 앞으로는 − 방향
    lR.g.rotation.x = -s * 0.85 * k;
    lL.shin.rotation.x = Math.max(0, -c) * 1.2 * k;   // 무릎: 다리가 앞으로 나올 때 접힘
    lR.shin.rotation.x = Math.max(0, c) * 1.2 * k;
    aL.g.rotation.x = -lL.g.rotation.x * 0.9;     // 팔은 반대 다리와 같이
    aR.g.rotation.x = -lR.g.rotation.x * 0.9;
    aL.fore.rotation.x = aR.fore.rotation.x = -0.15 - 1.0 * k;
    body.position.y = Math.abs(s) * 0.05 * k;
    body.rotation.x = 0.14 * k;
    root.rotation.y = baseYaw + spinA;
  }
  pose();

  function frame(dt) {
    acc += dt;
    const active = moving || k > 0 || spin;
    if (!active && !dirty) { acc = 0; return; }                 // 가만히 서 있으면 다시 그리지 않아 배터리 절약
    if (acc < 1 / 30) return;                                    // 30프레임으로 제한
    if (!host.isConnected || !host.getClientRects().length) { acc = 0; return; }   // 화면에 안 보이면 건너뜀
    const step = acc; acc = 0;
    const target = moving ? 1 : 0;
    k += (target - k) * Math.min(1, step * 10);
    if (Math.abs(target - k) < 0.01) k = target;
    if (k > 0) phase += step * 11;
    if (spin) spinA += step * 0.9;
    pose();
    renderer.render(scene, camera);
    dirty = false;
  }

  const api = {
    canvas: renderer.domElement,
    frame,
    setLook,
    setMoving(v) { moving = !!v; },
    destroy() {
      unregister(api);
      scene.traverse((o) => { o.geometry?.dispose?.(); });
      Object.values(M).forEach((m) => m.dispose?.());
      renderer.dispose?.(); renderer.forceContextLoss?.();
      renderer.domElement.remove?.();
    },
  };
  register(api);
  return api;
}
