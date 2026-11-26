(() => {
  const rule = { meters: 1000, normal: 100, special: 200, chance: .30 };
  const wallet = window.SafloDistanceWallet;
  if (!wallet) return;
  let run, meterShown = -1, noticeTimer;
  const el = id => document.getElementById('sfre-' + id);
  const total = rows => rows.reduce((sum, row) => sum + row.amount, 0);
  function start(kind) {
    clearTimeout(noticeTimer);
    meterShown = -1;
    run = {
      id: crypto.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
      mode: kind === 'gps' ? 'gps' : 'demo', active: true, meters: 0, lastDistance: 0,
      lastFix: null, next: 1, pending: null, rows: [], error: false, retryAt: 0
    };
    el('panel').hidden = el('summary').hidden = false;
    el('notice').textContent = '';
    el('history').open = false;
    refresh();
    renderDistance();
  }
  function refresh() {
    try {
      run.rows = wallet.read(run.mode);
      run.balance = wallet.balance(run.mode, run.rows);
      run.error = Boolean(run.pending);
    } catch { run.error = true; }
    renderWallet();
  }
  function renderWallet() {
    const rows = run.rows;
    const earned = total(rows.filter(r => r.session === run.id));
    const label = run.mode === 'gps' ? '상점 코인' : '체험용';
    el('wallet').textContent = label + ' 잔액 ' + (run.error ? '확인 필요' : run.balance.toLocaleString() + ' C');
    el('earned').textContent = '이번 러닝 +' + earned + ' C';
    el('result').textContent = el('earned').textContent + ' · ' + el('wallet').textContent;
    el('retry').hidden = !run.error;
    el('problem').hidden = !run.error;
    const list = el('list');
    list.replaceChildren();
    for (const r of rows) {
      const li = document.createElement('li');
      const date = new Date(r.time).toLocaleString('ko-KR', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
      li.textContent = (r.session === run.id ? '이번 러닝' : date) + ' · ' + r.km + 'km · ' +
        (r.special ? '특별' : '일반') + ' +' + r.amount + ' C';
      if (r.special) li.className = 'sfre-special';
      list.append(li);
    }
    if (!rows.length) list.textContent = '아직 획득한 코인이 없어요.';
  }
  function renderDistance() {
    const meters = Math.floor(run.meters);
    if (meters === meterShown) return;
    meterShown = meters;
    const progress = meters % rule.meters;
    el('progress').value = progress / rule.meters;
    el('left').textContent = '다음 코인까지 ' + (rule.meters - progress).toLocaleString() + 'm · ' +
      Math.floor(progress / rule.meters * 100) + '%';
  }
  function settle(force = false) {
    if (!force && Date.now() < run.retryAt) return;
    let earned = 0, special = false;
    try {
      while (run.next * rule.meters <= run.meters) {
        if (!run.pending) {
          const rare = Math.random() < rule.chance;
          run.pending = {session:run.id, km:run.next, time:Date.now(), special:rare, amount:rare ? rule.special : rule.normal};
        }
        const saved = wallet.award(run.mode, run.pending);
        earned += saved.amount;
        special ||= saved.special;
        run.next++;
        run.pending = null;
        window.SafloCourseCoins?.collect(saved, run.point);
      }
      if (earned || run.error || force) refresh();
    } catch {
      run.error = true;
      renderWallet();
    }
    run.retryAt = run.error ? Date.now() + 3000 : 0;
    if (earned) {
      const n = el('notice');
      n.classList.toggle('sfre-special', special);
      n.textContent = (special ? '특별 이벤트' : '거리 이벤트') + ' · +' + earned + ' C';
      n.animate?.([{opacity:.3},{opacity:1}], {duration:matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250});
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => { n.textContent = ''; }, 3500);
    }
  }
  function distance(cumulative, fix, point, along) {
    if (!run?.active || !Number.isFinite(cumulative) || cumulative < run.lastDistance) return;
    run.point = point;
    const delta = cumulative - run.lastDistance;
    run.lastDistance = cumulative;
    if (run.mode === 'gps') {
      const previous = run.lastFix;
      const acc = fix?.coords.accuracy, speed = fix?.coords.speed, time = fix?.timestamp;
      const good = Number.isFinite(acc) && acc >= 0 && acc <= 35 && Number.isFinite(time) &&
        !(Number.isFinite(speed) && speed > 7);
      run.lastFix = good ? time : null;
      if (!good || previous === null) return;
      const seconds = (time - previous) / 1000;
      if (seconds <= 0 || seconds > 30 || delta / seconds > 7 || delta / seconds < .5) return;
    }
    run.meters += delta;
    settle();
    if (run.mode === 'demo' && Number.isFinite(along)) {
      window.SafloCourseCoins?.progress(along, run.next * rule.meters - run.meters, run.next);
    }
    renderDistance();
  }
  function end() {
    if (!run?.active) return;
    run.active = false;
    settle(true);
  }
  el('retry').onclick = () => run && settle(true);
  window.addEventListener('storage', e => { if (run && wallet.changed(run.mode, e.key)) refresh(); });
  window.SafloDistanceEvents = Object.freeze({stepMeters:rule.meters, start, distance, end, resetFix() { if (run) run.lastFix = null; }});
})();
