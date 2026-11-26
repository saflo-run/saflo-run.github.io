// Each event has its own key. Independent tabs never rewrite a shared balance.
(() => {
  const root = 'saflo.distance-rewards.v1/';
  // A successful shop payment may outlive a failed receipt write in this tab.
  const paid = new Set();
  function shopBalance() {
    const balance = window.Shop?.getCoins?.();
    if (!Number.isSafeInteger(balance) || balance < 0) throw Error('상점 지갑 대기 중');
    return balance;
  }
  function prefix(mode) {
    if (!['demo', 'gps'].includes(mode)) throw Error('잘못된 지갑');
    return mode === 'gps' ? 'saflo.distance-rewards.shop-api.v1/gps/' : root + mode + '/';
  }
  function decode(raw) {
    const row = JSON.parse(raw);
    if (!row || !Number.isSafeInteger(row.amount) || row.amount <= 0 ||
        !Number.isSafeInteger(row.km) || row.km < 1 ||
        !Number.isFinite(row.time) || typeof row.session !== 'string') throw Error('저장 기록 오류');
    return row;
  }
  window.SafloDistanceWallet = Object.freeze({
    read(mode) {
      const rows = [];
      const p = prefix(mode);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith(p)) continue;
        const row = decode(localStorage.getItem(k));
        if (row.status !== 'pending') rows.push(row);
      }
      return rows.sort((a,b) => b.time - a.time || b.km - a.km);
    },
    balance(mode, rows) {
      return mode === 'gps' ? shopBalance() : rows.reduce((n, row) => n + row.amount, 0);
    },
    award(mode, row) {
      const key = prefix(mode) + row.session + '/' + row.km;
      const existing = localStorage.getItem(key);
      const stored = existing === null ? null : decode(existing);
      if (stored && stored.status !== 'pending') return stored;
      if (mode === 'gps') {
        if (stored && !paid.has(key)) throw Error('상점 지급 여부 확인 필요');
        if (!stored) {
          const before = shopBalance();
          if (typeof window.Shop.addCoins !== 'function' ||
              Number(localStorage.getItem('saflo_coins') || 0) !== before ||
              !Number.isSafeInteger(before + row.amount)) throw Error('상점 잔액 확인 필요');
          localStorage.setItem(key, JSON.stringify({...row, status:'pending'}));
          if (window.Shop.addCoins(row.amount) !== true ||
              shopBalance() !== before + row.amount ||
              Number(localStorage.getItem('saflo_coins')) !== before + row.amount)
            throw Error('상점 지급 여부 확인 필요');
          paid.add(key);
        }
        row = stored ? {...stored, status:'done'} : row;
      }
      localStorage.setItem(key, JSON.stringify(row));
      paid.delete(key);
      return row;
    },
    changed(mode, key) { return key === null || key.startsWith(prefix(mode)) || (mode === 'gps' && key === 'saflo_coins'); }
  });
})();
