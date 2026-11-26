// Visual markers only. The existing distance wallet owns all coin awards.
(() => {
  const folder = new URL('.', document.currentScript.src);
  const art = {
    gold: new URL('coin-gold.png', folder).href,
    purple: new URL('coin-purple.png', folder).href
  };
  let map, route, target, burst, timer, lastAt, lastKm;

  function clear() {
    clearTimeout(timer);
    target?.marker.remove();
    burst?.marker.remove();
    map = route = target = burst = null;
    lastAt = lastKm = undefined;
  }
  function pin() {
    const element = document.createElement('div');
    element.className = 'sfre-coin-marker';
    const label = document.createElement('span');
    const img = document.createElement('img');
    img.src = art.gold;
    img.alt = '';
    element.append(label, img);
    // The centre of the coin sits on the route. The label floats above it.
    const marker = new maplibregl.Marker({element, anchor:'bottom', offset:[0,16]});
    return {marker, element, label, img};
  }
  function show(mapInstance, course, step) {
    clear();
    map = mapInstance;
    route = course;
    if (route) progress(0, step, 1);
  }
  function progress(along, left, km) {
    if (!route) return;
    const position = along + Math.max(0, left);
    if (position > route.total + .05) {
      target?.marker.remove();
      target = null;
      lastAt = undefined;
      return;
    }
    if (target && km === lastKm && Math.abs(position - lastAt) < 1) return;
    target ??= pin();
    target.label.textContent = km + ' km';
    target.marker.setLngLat(route.at(position)).addTo(map);
    lastAt = position;
    lastKm = km;
  }
  function collect(row, point) {
    if (!map || !point) return;
    clearTimeout(timer);
    burst?.marker.remove();
    burst = pin();
    burst.img.src = row.special ? art.purple : art.gold;
    burst.label.textContent = '+' + row.amount + ' C';
    burst.element.classList.add('sfre-coin-collected');
    burst.marker.setLngLat(point).addTo(map);
    timer = setTimeout(() => { burst?.marker.remove(); burst = null; }, 1200);
  }
  window.SafloCourseCoins = Object.freeze({show, progress, collect, clear});
})();
