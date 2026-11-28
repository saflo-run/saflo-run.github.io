/* 3D 아바타 (three.js)
 * 기본 3D 사람 하나를 만들고, 착용한 상품(헤어·상의·하의·신발·악세사리)에 맞춰 모양과 색을 바꿔요.
 *   const av = await createAvatar(칸, { width, height, yaw, spin });
 *   av.setLook({ hair: 상품, top: 상품, "acc-head": 상품, ... })   // 자리별 착용 상품 (wallet.getEquippedItems())
 *   av.setMoving(true|false)         // 달리는 동작 켜고 끄기
 *   av.rotateBy(라디안)              // 손가락으로 돌리기
 *   av.snapshot(look, view)          // 상품 카드용 사진(dataURL) 한 장 찍기
 *   av.destroy()
 * three.js 를 못 불러오거나 WebGL 이 안 되면 createAvatar 가 에러를 던져요 (호출한 쪽에서 기본 아이콘으로 대체).
 *
 * 새 모양 추가하는 법: 아래 "몸 만들기"에서 그룹을 만들고, setLook() 에서 style/type 에 맞춰 visible 을 켜면 돼요.
 */
const THREE_URL = "https://unpkg.com/three@0.160.0/build/three.module.js";
let threeP = null;
const loadThree = () => (threeP ??= import(THREE_URL).catch((e) => { threeP = null; throw e; }));

const SKIN = "#f1c9a5";
/* 아무것도 안 입었을 때 모습 */
const DEFAULT = {
  hair: { style: "short", color: "#2b211c" },
  top: { style: "tee", color: "#8d99a6", accent: "#8d99a6" },
  bottom: { style: "half", color: "#2b2f36" },
  shoes: { style: "daily", color: "#f2f2f2", sole: "#e4e4e4", accent: "#b9c0c8" },
};
const SOLE_H = { daily: 0.03, trail: 0.045, racer: 0.06 };
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
  let spin = !!opts.spin && !reduceMotion();

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: !!opts.preserve });
  renderer.setPixelRatio(Math.min((typeof devicePixelRatio === "number" && devicePixelRatio) || 1, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "내 아바타");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  const dist = opts.dist ?? 4.3;                          // 카메라 거리 (작을수록 크게 보임)
  const CAM = { pos: [0, 0.92 + 0.63 * dist / 4.3, dist], target: [0, 0.92, 0] };
  const aimCamera = (pos, target, fov = 30) => {
    camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix?.();
    camera.position.set(...pos); camera.lookAt(...target);
  };
  aimCamera(CAM.pos, CAM.target);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x66707c, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(2, 4, 3);
  scene.add(sun);

  /* ---- 재질 (색은 setLook 에서 바꿈) ---- */
  const mats = [];
  const mat = (c, o = {}) => { const m = new THREE.MeshLambertMaterial({ color: c, ...o }); mats.push(m); return m; };
  const two = { side: THREE.DoubleSide };
  const M = {
    skin: mat(SKIN), dark: mat("#1b1b1f"), white: mat("#ffffff"),
    hair: mat(DEFAULT.hair.color, two),
    top: mat(DEFAULT.top.color), topAcc: mat(DEFAULT.top.color, two), armU: mat(DEFAULT.top.color), armF: mat(SKIN),
    bottom: mat(DEFAULT.bottom.color), bottomAcc: mat(DEFAULT.bottom.color), thigh: mat(DEFAULT.bottom.color), shin: mat(SKIN),
    shoe: mat(DEFAULT.shoes.color), sole: mat(DEFAULT.shoes.sole), shoeAcc: mat(DEFAULT.shoes.accent),
    cap: mat("#e4572e", two), capAcc: mat("#e4572e", two),
    lens: new THREE.MeshPhongMaterial({ color: "#15171a", shininess: 90, specular: 0xffffff, side: THREE.DoubleSide }),
    frame: mat("#1b1b1f", two),
    pack: mat("#8e44ad"), packAcc: mat("#c8f25b"),
    watch: mat("#1d1e22"), watchFace: mat("#111", { emissive: "#c8f25b", emissiveIntensity: 0.6 }),
  };
  mats.push(M.lens);

  const put = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
  const group = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); return g; };
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 12);
  const sphere = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
  const dome = (r, thetaLen) => new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, thetaLen);
  const ring = (R, t) => new THREE.TorusGeometry(R, t, 8, 28);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const flat = (o) => { o.rotation.x = Math.PI / 2; return o; };     // 도넛(링)을 바닥과 나란히 눕히기

  /* ---- 몸 만들기 (앞쪽이 +z, 발바닥이 y=0) ---- */
  const root = new THREE.Group();            // 보는 방향(회전)
  const body = new THREE.Group();            // 달릴 때 위아래·앞으로 기울기
  root.add(body); scene.add(root);

  // 몸통 · 골반
  const pelvis = put(capsule(0.19, 0.08), M.bottom, 0, 0.92); pelvis.scale.set(1.2, 1, 0.75);
  const torso = put(capsule(0.2, 0.34), M.top, 0, 1.2); torso.scale.set(1.15, 1, 0.72);
  body.add(pelvis, torso, put(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12), M.skin, 0, 1.62));

  // 상의 장식: 목 테두리 · 배번표 · 가로 줄무늬 · 바람막이(지퍼·카라·밑단)
  const neckRing = flat(put(ring(0.078, 0.014), M.topAcc, 0, 1.565));
  const bib = group(put(box(0.21, 0.15, 0.008), M.white, 0, 1.2, 0.15), put(box(0.13, 0.035, 0.01), M.topAcc, 0, 1.21, 0.152),
                    put(box(0.17, 0.012, 0.01), M.topAcc, 0, 1.155, 0.152));
  const stripes = group(...[1.13, 1.3].map((y) => { const r = flat(put(ring(0.2, 0.02), M.topAcc, 0, y)); r.scale.set(1.15, 0.72, 1); return r; }));
  const jacket = group(put(box(0.014, 0.62, 0.012), M.topAcc, 0, 1.22, 0.158),
                       put(new THREE.CylinderGeometry(0.085, 0.1, 0.08, 16, 1, true), M.top, 0, 1.585),
                       (() => { const r = flat(put(ring(0.2, 0.022), M.topAcc, 0, 0.88)); r.scale.set(1.2, 0.78, 1); return r; })());
  body.add(neckRing, bib, stripes, jacket);

  // 머리 · 얼굴
  const HEAD_Y = 1.78;
  const head = new THREE.Group(); head.position.set(0, HEAD_Y, 0);
  head.add(put(sphere(0.17, 20, 16), M.skin));
  head.add(put(sphere(0.017, 8, 8), M.dark, -0.06, -0.02, 0.158), put(sphere(0.017, 8, 8), M.dark, 0.06, -0.02, 0.158));
  body.add(head);

  // 헤어: 스타일마다 그룹 하나씩 (setLook 에서 하나만 켬)
  const hairBase = () => { const h = put(dome(0.182, Math.PI * 0.62), M.hair); h.rotation.x = -0.45; return h; };
  const tail = group(put(capsule(0.045, 0.17), M.hair, 0, -0.12, 0)); tail.position.set(0, 0.03, -0.19); tail.rotation.x = 0.45;
  const curlBumps = [];
  const curly = group(hairBase());
  for (let t = 0; t <= 115; t += 16) {                     // 머리 위에 작은 공을 촘촘히 붙여서 곱슬 표현
    const th = t * Math.PI / 180, n = Math.max(1, Math.round(13 * Math.sin(th)));
    for (let i = 0; i < n; i++) {
      const ph = (i / n) * Math.PI * 2 + t;
      const d = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
      if (d[2] > 0.3 && d[1] < 0.62) continue;             // 얼굴 쪽은 비움
      if (d[1] < -0.3) continue;
      const b = put(sphere(0.052, 10, 8), M.hair, d[0] * 0.175, d[1] * 0.175 + 0.01, d[2] * 0.175);
      b.userData.top = d[1] > 0.35;                        // 모자를 쓰면 정수리 공은 숨김
      curlBumps.push(b); curly.add(b);
    }
  }
  const bob = put(dome(0.193, Math.PI * 0.72), M.hair); bob.rotation.x = -0.75; bob.scale.set(1.06, 1, 1.06);
  const HAIR = {
    short: group(hairBase()),
    ponytail: group(hairBase(), put(sphere(0.035), M.hair, 0, 0.03, -0.175), tail),
    bun: group(hairBase(), put(sphere(0.078, 16, 12), M.hair, 0, 0.15, -0.1)),
    bob: group(bob),
    curly,
  };
  Object.values(HAIR).forEach((g) => { g.visible = false; head.add(g); });

  // 모자 · 바이저 · 헤어밴드
  const brim = () => { const b = put(new THREE.CylinderGeometry(0.2, 0.2, 0.018, 20, 1, false, -Math.PI / 2, Math.PI), M.capAcc, 0, 0.06, 0.02); b.scale.z = 1.5; b.rotation.x = 0.1; return b; };
  const capDome = put(dome(0.2, Math.PI * 0.5), M.cap, 0, 0.01, 0); capDome.rotation.x = -0.2;
  const cap = group(capDome, brim(), put(sphere(0.02, 8, 6), M.capAcc, 0, 0.215, -0.04));
  const visor = group(brim(), flat(put(ring(0.18, 0.02), M.cap, 0, 0.065)));
  const band = put(ring(0.178, 0.024), M.cap, 0, 0.045); band.rotation.x = Math.PI / 2 - 0.28;
  // 스포츠 선글라스: 얼굴을 감싸는 렌즈 + 위쪽 테 + 다리
  const glasses = group(
    put(new THREE.CylinderGeometry(0.195, 0.19, 0.06, 24, 1, true, -0.85, 1.7), M.lens, 0, -0.02, 0),
    put(new THREE.CylinderGeometry(0.198, 0.198, 0.014, 24, 1, true, -0.9, 1.8), M.frame, 0, 0.013, 0),
    put(box(0.012, 0.012, 0.18), M.frame, -0.18, 0.008, -0.04), put(box(0.012, 0.012, 0.18), M.frame, 0.18, 0.008, -0.04));
  const HEADWEAR = { cap, visor, headband: band, glasses };
  Object.values(HEADWEAR).forEach((g) => { g.visible = false; head.add(g); });

  // 등: 백팩 · 러닝 조끼
  const backpack = group(put(box(0.34, 0.42, 0.17), M.pack, 0, 1.25, -0.23), put(box(0.24, 0.12, 0.03), M.packAcc, 0, 1.15, -0.32),
                         put(box(0.05, 0.36, 0.02), M.pack, -0.12, 1.32, 0.15), put(box(0.05, 0.36, 0.02), M.pack, 0.12, 1.32, 0.15));
  const vest = group(put(box(0.3, 0.34, 0.06), M.pack, 0, 1.28, -0.17),
                     put(box(0.08, 0.36, 0.02), M.pack, -0.11, 1.3, 0.152), put(box(0.08, 0.36, 0.02), M.pack, 0.11, 1.3, 0.152),
                     put(box(0.08, 0.025, 0.32), M.pack, -0.11, 1.53, 0), put(box(0.08, 0.025, 0.32), M.pack, 0.11, 1.53, 0),
                     put(new THREE.CylinderGeometry(0.032, 0.032, 0.13, 12), M.packAcc, -0.11, 1.33, 0.19),
                     put(new THREE.CylinderGeometry(0.032, 0.032, 0.13, 12), M.packAcc, 0.11, 1.33, 0.19),
                     put(box(0.2, 0.02, 0.012), M.packAcc, 0, 1.2, 0.16));
  const BACK = { backpack, vest };
  Object.values(BACK).forEach((g) => { g.visible = false; body.add(g); });

  // 팔: 어깨 → 팔꿈치 → 손
  function arm(s) {
    const g = new THREE.Group(); g.position.set(s * 0.285, 1.46, 0);
    g.add(put(capsule(0.062, 0.2), M.armU, 0, -0.17));
    const fore = new THREE.Group(); fore.position.set(0, -0.32, 0);
    fore.add(put(capsule(0.05, 0.2), M.armF, 0, -0.15), put(sphere(0.055, 10, 8), M.skin, 0, -0.32));
    g.add(fore); body.add(g);
    return { g, fore };
  }
  const aL = arm(-1), aR = arm(1);
  const watch = group(flat(put(ring(0.052, 0.013), M.watch, 0, -0.255)), put(box(0.014, 0.05, 0.045), M.watchFace, -0.06, -0.255, 0));
  watch.visible = false; aL.fore.add(watch);

  // 다리: 엉덩이 → 무릎 → 발
  function leg(s) {
    const g = new THREE.Group(); g.position.set(s * 0.1, 0.9, 0);
    const thigh = put(capsule(0.09, 0.22), M.thigh, 0, -0.2);
    const shorts = group(put(new THREE.CylinderGeometry(0.112, 0.128, 0.2, 16), M.bottom, 0, -0.085),
                         flat(put(ring(0.126, 0.01), M.bottomAcc, 0, -0.18)));
    const thighLine = put(box(0.012, 0.3, 0.03), M.bottomAcc, s * 0.088, -0.2, 0);
    g.add(thigh, shorts, thighLine);
    const shin = new THREE.Group(); shin.position.set(0, -0.4, 0);
    const calf = put(capsule(0.07, 0.26), M.shin, 0, -0.2);
    const shinLine = put(box(0.012, 0.3, 0.03), M.bottomAcc, s * 0.068, -0.2, 0);
    const cuff = flat(put(ring(0.074, 0.022), M.bottomAcc, 0, -0.35));
    // 신발: 갑피 + 앞코 + 밑창 + 옆 라인 + 뒤꿈치 탭
    const sole = put(box(0.138, 1, 0.295), M.sole, 0, 0, 0.005);
    const shoe = group(put(box(0.12, 0.075, 0.25), M.shoe, 0, 0.01, 0),
                       (() => { const t = put(sphere(0.06, 12, 8), M.shoe, 0, -0.008, 0.1); t.scale.set(1, 0.6, 0.75); return t; })(),
                       sole,
                       (() => { const l = put(box(0.124, 0.022, 0.12), M.shoeAcc, 0, 0.005, 0.01); l.rotation.x = -0.25; return l; })(),
                       put(box(0.05, 0.05, 0.02), M.shoeAcc, 0, 0.055, -0.125));
    shoe.position.set(0, -0.43, 0.05);
    shin.add(calf, shinLine, cuff, shoe);
    g.add(shin); body.add(g);
    return { g, shin, thigh, calf, shorts, thighLine, shinLine, cuff, sole, shoe };
  }
  const lL = leg(-1), lR = leg(1);

  /* ---- 착용한 상품 반영 ---- */
  let moving = false, k = 0, phase = 0, spinA = 0, acc = 0, dirty = true, held = false, ponySwing = false;
  function setLook(eq = {}) {
    const lk = (slot) => ({ ...DEFAULT[slot], ...(eq[slot]?.look || {}) });
    const hair = lk("hair"), top = lk("top"), bot = lk("bottom"), sh = lk("shoes");
    const headAcc = eq["acc-head"]?.look, face = eq["acc-face"]?.look, back = eq["acc-back"]?.look, wrist = eq["acc-wrist"]?.look;

    // 헤어
    M.hair.color.set(hair.color);
    for (const [k, g] of Object.entries(HAIR)) g.visible = k === (HAIR[hair.style] ? hair.style : "short");
    ponySwing = hair.style === "ponytail";
    const hatOn = headAcc?.type === "cap";
    curlBumps.forEach((b) => { b.visible = !(hatOn && b.userData.top); });

    // 상의
    const st = top.style;
    M.top.color.set(top.color);
    M.topAcc.color.set(top.accent || top.color);
    M.armU.color.set(st === "singlet" ? SKIN : top.color);
    M.armF.color.set(st === "long" || st === "jacket" ? top.color : SKIN);
    neckRing.visible = st === "tee" || st === "stripe" || st === "long";
    bib.visible = st === "singlet";
    stripes.visible = st === "stripe";
    jacket.visible = st === "jacket";
    torso.scale.set(st === "jacket" ? 1.2 : 1.15, 1, st === "jacket" ? 0.78 : 0.72);

    // 하의
    const bs = bot.style;
    M.bottom.color.set(bot.color);
    M.bottomAcc.color.set(bot.accent || bot.color);
    M.thigh.color.set(bs === "shorts" ? SKIN : bot.color);
    M.shin.color.set(bs === "long" || bs === "jogger" ? bot.color : SKIN);
    for (const l of [lL, lR]) {
      l.shorts.visible = bs === "shorts";
      l.thighLine.visible = l.shinLine.visible = bs === "long" && !!bot.accent;
      l.cuff.visible = bs === "jogger";
      const fat = bs === "jogger" ? 1.18 : 1;
      l.thigh.scale.set(fat, 1, fat); l.calf.scale.set(fat, 1, fat);
    }

    // 신발 (밑창 두께가 스타일마다 다름)
    M.shoe.color.set(sh.color); M.sole.color.set(sh.sole || sh.color); M.shoeAcc.color.set(sh.accent || sh.color);
    const h = SOLE_H[sh.style] || SOLE_H.daily;
    for (const l of [lL, lR]) { l.sole.scale.y = h; l.sole.position.y = -0.0275 - h / 2; }

    // 악세사리
    cap.visible = hatOn; visor.visible = headAcc?.type === "visor"; band.visible = headAcc?.type === "headband";
    if (headAcc) { M.cap.color.set(headAcc.color || "#e4572e"); M.capAcc.color.set(headAcc.accent || headAcc.color || "#e4572e"); }
    glasses.visible = face?.type === "glasses";
    if (face) { M.lens.color.set(face.color || "#15171a"); M.frame.color.set(face.accent || "#1b1b1f"); }
    backpack.visible = back?.type === "backpack"; vest.visible = back?.type === "vest";
    if (back) { M.pack.color.set(back.color || "#8e44ad"); M.packAcc.color.set(back.accent || "#c8f25b"); }
    watch.visible = wrist?.type === "watch";
    if (wrist) { M.watch.color.set(wrist.color || "#1d1e22"); M.watchFace.emissive?.set?.(wrist.accent || "#c8f25b"); }
    dirty = true;
  }
  setLook({});

  /* ---- 동작 ---- */
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
    tail.rotation.x = 0.45 + (ponySwing ? Math.sin(phase * 2) * 0.25 * k + 0.35 * k : 0);   // 포니테일 찰랑
    root.rotation.y = baseYaw + spinA;
  }
  pose();

  function frame(dt) {
    acc += dt;
    const active = moving || k > 0 || (spin && !held);
    if (!active && !dirty) { acc = 0; return; }                 // 가만히 서 있으면 다시 그리지 않아 배터리 절약
    if (acc < 1 / 30) return;                                    // 30프레임으로 제한
    if (!host.isConnected || !host.getClientRects().length) { acc = 0; return; }   // 화면에 안 보이면 건너뜀
    const step = acc; acc = 0;
    const target = moving ? 1 : 0;
    k += (target - k) * Math.min(1, step * 10);
    if (Math.abs(target - k) < 0.01) k = target;
    if (k > 0) phase += step * 11;
    if (spin && !held) spinA += step * 0.9;
    pose();
    renderer.render(scene, camera);
    dirty = false;
  }

  /* 상품 카드용 사진 한 장: 잠깐 그 상품을 입히고, 카메라를 그 부위로 옮겨 찍은 뒤 되돌림
   * view = { target:[x,y,z], dist, yaw, height, fov } (yaw 0 = 정면) */
  let lastLook = {};
  function snapshot(look, view = {}) {
    const t = view.target || [0, 1.0, 0], d = view.dist ?? 3.6, yw = view.yaw ?? 0.5, hy = view.height ?? 0.15;
    const saved = { k, yaw: root.rotation.y };
    setLook(look);
    k = 0; root.rotation.y = 0; pose(); root.rotation.y = 0;
    aimCamera([t[0] + Math.sin(yw) * d, t[1] + hy * d, t[2] + Math.cos(yw) * d], t, view.fov ?? 30);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    k = saved.k; aimCamera(CAM.pos, CAM.target); setLook(lastLook); pose(); root.rotation.y = saved.yaw;
    return url;
  }

  const api = {
    canvas: renderer.domElement,
    frame,
    setLook(eq) { lastLook = eq || {}; setLook(lastLook); },
    setMoving(v) { moving = !!v; },
    rotateBy(rad) { spinA += rad; dirty = true; },
    hold(v) { held = !!v; dirty = true; },                    // 손가락으로 돌리는 동안 자동 회전 멈춤
    snapshot,
    destroy() {
      unregister(api);
      scene.traverse((o) => { o.geometry?.dispose?.(); });
      mats.forEach((m) => m.dispose?.());
      renderer.dispose?.(); renderer.forceContextLoss?.();
      renderer.domElement.remove?.();
    },
  };
  if (!opts.still) register(api);                             // still: 사진 찍기 전용 (화면 루프에 안 넣음)
  return api;
}
