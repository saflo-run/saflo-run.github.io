/* 상점 데이터: 부위(분류) · 상품 · 코인 충전 상품
 * 상품을 늘리거나 가격을 바꾸려면 이 파일만 고치면 돼요.
 *
 * ITEMS 항목
 *   id        고유 이름 (구매·착용 기록에 쓰이니 한 번 정하면 바꾸지 마세요)
 *   name      상점에 보이는 이름
 *   category  CATEGORIES 의 id 중 하나
 *   price     코인 가격
 *   image     상품 사진 주소 (비워두면 빈 칸으로 보여요. 예: "shop/img/cap1.png")
 *   look      아바타에 어떻게 보일지
 *               head   → { type: "cap", color }
 *               top / bottom / shoes → { color }
 *               acc    → { type: "backpack" | "glasses", color }
 */
export const CATEGORIES = [
  { id: "head", label: "머리" },
  { id: "top", label: "상의" },
  { id: "bottom", label: "하의" },
  { id: "shoes", label: "신발" },
  { id: "acc", label: "악세사리" },
];

export const ITEMS = [
  { id: "item1", name: "상품1", category: "head",   price: 1000, image: "", look: { type: "cap", color: "#e4572e" } },
  { id: "item2", name: "상품2", category: "top",    price: 1000, image: "", look: { color: "#3a86ff" } },
  { id: "item3", name: "상품3", category: "bottom", price: 1000, image: "", look: { color: "#f4b400" } },
  { id: "item4", name: "상품4", category: "shoes",  price: 1000, image: "", look: { color: "#c8f25b" } },
  { id: "item5", name: "상품5", category: "acc",    price: 1000, image: "", look: { type: "backpack", color: "#8e44ad" } },
];

/* 러닝코인 충전 (데모 가격: 코인 × 10원) */
export const COIN_PACKS = [
  { coins: 100, won: 1000 },
  { coins: 1000, won: 10000 },
  { coins: 10000, won: 100000 },
];
