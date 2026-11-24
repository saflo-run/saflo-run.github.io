/* 아바타 · 상점 불러오기 (index.html 에는 이 파일 한 줄만 들어가요)
 * 실제 코드는 같은 폴더의 index.js 와 나머지 파일들에 있고, init() 이 불려야 그때 받아와요.
 * 이 폴더가 없어도 앱은 그대로 동작합니다.
 */
(() => {
  const base = new URL("./", document.currentScript.src).href;
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = base + "shop.css";
  document.head.appendChild(css);

  window.Shop = {
    init(map, state) {
      return import(base + "index.js").then((m) => {
        window.Shop.addCoins = m.addCoins;      // 코인 지급: window.Shop.addCoins(숫자)
        window.Shop.getCoins = m.getCoins;
        m.init(map, state);
      }).catch((e) => console.error("아바타 상점", e));
    },
  };
})();
