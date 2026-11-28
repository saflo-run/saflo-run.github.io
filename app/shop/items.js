/* 상점 데이터: 부위(분류) · 상품 · 코인 충전 상품
 * 상품을 늘리거나 가격을 바꾸려면 이 파일만 고치면 돼요.
 *
 * ITEMS 항목
 *   id        고유 이름 (구매·착용 기록에 쓰이니 한 번 정하면 바꾸지 마세요)
 *   name      상점에 보이는 이름
 *   desc      카드에 보이는 한 줄 설명 (없어도 됨)
 *   category  CATEGORIES 의 id 중 하나 (상점 탭)
 *   price     코인 가격
 *   image     상품 사진 주소. 비워두면 3D 착용 컷을 자동으로 만들어 보여줘요 (예: "shop/img/cap1.png")
 *   look      아바타에 어떻게 보일지 (아래 STYLES 참고)
 *
 * look 에 쓸 수 있는 값
 *   hair   → { style: "short" | "ponytail" | "bun" | "bob" | "curly", color }
 *   top    → { style: "tee" | "singlet" | "long" | "jacket" | "stripe", color, accent }
 *   bottom → { style: "shorts" | "half" | "long" | "jogger", color, accent }
 *   shoes  → { style: "daily" | "trail" | "racer", color, sole, accent }
 *   acc    → { type: "cap" | "visor" | "headband" | "glasses" | "backpack" | "vest" | "watch", color, accent }
 *   color = 기본 색, accent = 포인트 색(줄무늬·로고·지퍼 등), sole = 신발 밑창 색
 */
export const CATEGORIES = [
  { id: "hair", label: "헤어" },
  { id: "top", label: "상의" },
  { id: "bottom", label: "하의" },
  { id: "shoes", label: "신발" },
  { id: "acc", label: "악세사리" },
];

/* 악세사리는 끼는 자리가 달라서 여러 개를 같이 착용할 수 있어요 (모자 + 선글라스 + 조끼 + 시계).
 * 같은 자리끼리는 하나만 (모자와 헤어밴드는 같이 못 씀). */
const ACC_SLOT = {
  cap: "acc-head", visor: "acc-head", headband: "acc-head",
  glasses: "acc-face",
  backpack: "acc-back", vest: "acc-back",
  watch: "acc-wrist",
};
export const SLOT_LABEL = {
  hair: "헤어", top: "상의", bottom: "하의", shoes: "신발",
  "acc-head": "모자·밴드", "acc-face": "안경", "acc-back": "가방·조끼", "acc-wrist": "손목",
};
/* 상품이 아바타의 어느 자리에 입혀지는지 */
export const slotOf = (it) => (it?.category === "acc" ? ACC_SLOT[it.look?.type] || "acc-head" : it?.category);

export const ITEMS = [
  /* ---- 헤어 ---- */
  { id: "hair-short-brown", name: "내추럴 숏컷", desc: "가볍고 깔끔한 기본 컷", category: "hair", price: 600, image: "", look: { style: "short", color: "#5a3a26" } },
  { id: "hair-pony-black", name: "하이 포니테일", desc: "달릴 때 찰랑이는 묶음 머리", category: "hair", price: 900, image: "", look: { style: "ponytail", color: "#1f1a17" } },
  { id: "hair-bun-brown", name: "똥머리 번", desc: "땀 걱정 없는 올림 머리", category: "hair", price: 900, image: "", look: { style: "bun", color: "#6b4329" } },
  { id: "hair-bob-ash", name: "애쉬 단발", desc: "귀를 덮는 단정한 보브", category: "hair", price: 1100, image: "", look: { style: "bob", color: "#8a8478" } },
  { id: "hair-curly-pink", name: "핑크 펌", desc: "통통 튀는 곱슬 펌", category: "hair", price: 1400, image: "", look: { style: "curly", color: "#e58fb0" } },

  /* ---- 상의 ---- */
  { id: "top-tee-navy", name: "드라이핏 티셔츠", desc: "기본 반팔 러닝 티", category: "top", price: 800, image: "", look: { style: "tee", color: "#24345c", accent: "#c8f25b" } },
  { id: "top-singlet-red", name: "레이스 싱글렛", desc: "배번표가 달린 대회용 민소매", category: "top", price: 1200, image: "", look: { style: "singlet", color: "#d63a2f", accent: "#1d1d1f" } },
  { id: "top-long-mint", name: "긴팔 러닝 티", desc: "쌀쌀한 새벽 러닝용", category: "top", price: 1000, image: "", look: { style: "long", color: "#5cc9b0", accent: "#ffffff" } },
  { id: "top-jacket-neon", name: "네온 바람막이", desc: "밤에도 잘 보이는 형광 재킷", category: "top", price: 1800, image: "", look: { style: "jacket", color: "#d9f23a", accent: "#222222" } },
  { id: "top-stripe-white", name: "투톤 스트라이프 티", desc: "가슴에 두 줄 포인트", category: "top", price: 1000, image: "", look: { style: "stripe", color: "#f3f3f3", accent: "#3a86ff" } },

  /* ---- 하의 ---- */
  { id: "bottom-shorts-black", name: "스플릿 쇼츠", desc: "가볍고 짧은 러닝 반바지", category: "bottom", price: 800, image: "", look: { style: "shorts", color: "#1e1f24", accent: "#c8f25b" } },
  { id: "bottom-shorts-orange", name: "오렌지 쇼츠", desc: "눈에 띄는 컬러 반바지", category: "bottom", price: 900, image: "", look: { style: "shorts", color: "#f37b2b", accent: "#ffffff" } },
  { id: "bottom-half-navy", name: "하프 타이츠", desc: "무릎 위까지 잡아주는 5부", category: "bottom", price: 1000, image: "", look: { style: "half", color: "#26345a" } },
  { id: "bottom-long-purple", name: "롱 레깅스", desc: "옆선 라인이 들어간 9부", category: "bottom", price: 1200, image: "", look: { style: "long", color: "#3b2a5c", accent: "#ff6fb1" } },
  { id: "bottom-jogger-gray", name: "조거 팬츠", desc: "편한 회복 러닝용", category: "bottom", price: 1100, image: "", look: { style: "jogger", color: "#7d838c", accent: "#33363c" } },

  /* ---- 신발 ---- */
  { id: "shoes-daily-white", name: "데일리 러닝화", desc: "매일 신기 좋은 쿠션화", category: "shoes", price: 1200, image: "", look: { style: "daily", color: "#f4f4f4", sole: "#e6e6e6", accent: "#3a86ff" } },
  { id: "shoes-daily-black", name: "올블랙 러닝화", desc: "어디에나 어울리는 검정", category: "shoes", price: 1200, image: "", look: { style: "daily", color: "#232428", sole: "#2e2f33", accent: "#8d99a6" } },
  { id: "shoes-trail-olive", name: "트레일화", desc: "두꺼운 밑창, 산길용", category: "shoes", price: 1600, image: "", look: { style: "trail", color: "#5d6b3c", sole: "#2a2a2a", accent: "#f2a33a" } },
  { id: "shoes-racer-pink", name: "카본 레이서", desc: "기록 단축용 두툼한 폼", category: "shoes", price: 2400, image: "", look: { style: "racer", color: "#ff5c8a", sole: "#d9f23a", accent: "#ffffff" } },

  /* ---- 악세사리 ---- */
  { id: "acc-cap-red", name: "러닝 캡", desc: "햇빛 가리는 가벼운 모자", category: "acc", price: 1000, image: "", look: { type: "cap", color: "#e4572e", accent: "#e4572e" } },
  { id: "acc-cap-black", name: "블랙 러닝 캡", desc: "챙만 흰색인 투톤 모자", category: "acc", price: 1100, image: "", look: { type: "cap", color: "#1f2024", accent: "#f2f2f2" } },
  { id: "acc-visor-white", name: "썬 바이저", desc: "정수리가 시원한 챙 모자", category: "acc", price: 900, image: "", look: { type: "visor", color: "#f5f5f5" } },
  { id: "acc-band-lime", name: "헤어밴드", desc: "땀을 막아주는 이마 밴드", category: "acc", price: 600, image: "", look: { type: "headband", color: "#c8f25b" } },
  { id: "acc-glasses-mirror", name: "스포츠 선글라스", desc: "얼굴을 감싸는 고글형", category: "acc", price: 1500, image: "", look: { type: "glasses", color: "#3a8bd6", accent: "#1b1b1f" } },
  { id: "acc-vest-teal", name: "러닝 조끼", desc: "물병 두 개가 들어가는 베스트", category: "acc", price: 2000, image: "", look: { type: "vest", color: "#1f6f78", accent: "#e8f4ff" } },
  { id: "acc-pack-purple", name: "미니 백팩", desc: "출퇴근 러닝용 작은 가방", category: "acc", price: 1500, image: "", look: { type: "backpack", color: "#8e44ad", accent: "#c8f25b" } },
  { id: "acc-watch-black", name: "GPS 워치", desc: "왼쪽 손목 러닝 시계", category: "acc", price: 1800, image: "", look: { type: "watch", color: "#1d1e22", accent: "#c8f25b" } },
];

/* 러닝코인 충전 (데모 가격: 코인 × 10원) */
export const COIN_PACKS = [
  { coins: 100, won: 1000 },
  { coins: 1000, won: 10000 },
  { coins: 10000, won: 100000 },
];
