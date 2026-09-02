/* 新疆旅游路线自动生成器 - 核心逻辑 */
(function () {
  'use strict';

  const ATTRACTIONS = window.ATTRACTIONS || [];
  const OUTLINE_FC = window.XINJIANG_OUTLINE || { features: [] };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MAP_W = 1000, MAP_H = 1000, PAD = 40;
  const NATURAL_CATS = ['湖泊','草原','峡谷','沙漠','雅丹','山峰','冰川','森林','温泉','地质','河流','胡杨','地貌','湿地'];

  const $ = (id) => document.getElementById(id);
  const svg = $('mapSvg');
  const outlineG = $('outlineG');
  const markerG = $('markerG');
  const routeLayer = $('routeLayer');
  const routePointsG = $('routePoints');
  const routeLabelsG = $('routeLabels');
  const tooltip = $('tooltip');
  const searchInput = $('searchInput');
  const suggestionsBox = $('suggestions');
  const listEl = $('selectedList');
  const emptyHint = $('emptyHint');
  const mapHint = $('mapHint');
  const statCount = $('statCount');
  const statKm = $('statKm');
  const statHours = $('statHours');
  const playBtn = $('playBtn');
  const replayBtn = $('replayBtn');
  const speedSel = $('speedSel');
  const routeInfo = $('routeInfo');
  const routeProgress = $('routeProgress');

  const state = {
    selected: [],
    byId: new Map(ATTRACTIONS.map(a => [a.id, a])),
    proj: null,
    view: { x: 0, y: 0, w: MAP_W, h: MAP_H },
    dragging: null,
    anim: null,
    totalKm: 0,
    sugIdx: 0,
    notes: {},
    color: null,
    textColor: '#eaf2ff',
    chipBg: '#0e1830',
    theme: 'dark',
  };

  const EXAMPLES = {
    north: ['urumqi-grand-bazaar','tianshan-tianchi','turpan-flame','turpan-grapes','bayanbulak','nalati','sayram-lake','karamay-devilcity','hem','kanas'],
    duku: ['urumqi-grand-bazaar','dushanzi-canyon','qiaoerma','nalati','bayanbulak','jiqushibawan','dalongchi','kuqa-canyon','kuqa-oldtown'],
    south: ['kashgar-oldcity','idkah-mosque','xiangfei-park','oytak-glacier','baisha-lake','karakul-lake','muztagh-ata','panlong-road','tashkurgan-stone','khunjerab-pass'],
    loop: ['urumqi-grand-bazaar','turpan-flame','kumtag-desert','hami-kings-tomb','korla','bosten-lake','kuqa-oldtown','kezil-grottoes','kuqa-canyon','wensu-canyon','kashgar-oldcity','karakul-lake','muztagh-ata','tashkurgan-stone','hetian-night','niya-ruins','desert-road','tarim-populus','sayram-lake','hem','kanas'],
  };

  /* ---------- SVG 工具 ---------- */
  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function walkRings(fn) {
    (function visit(o) {
      if (!o) return;
      if (o.type === 'FeatureCollection') return (o.features || []).forEach(visit);
      if (o.type === 'Feature') return visit(o.geometry);
      if (o.type === 'GeometryCollection') return (o.geometries || []).forEach(visit);
      if (o.type === 'Polygon') return (o.coordinates || []).forEach(ring => fn(ring));
      if (o.type === 'MultiPolygon') return (o.coordinates || []).forEach(poly => (poly || []).forEach(ring => fn(ring)));
    })(OUTLINE_FC);
  }

  function computeBounds() {
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    walkRings(ring => {
      for (const p of ring) {
        const lng = p[0], lat = p[1];
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    });
    return { minLng, maxLng, minLat, maxLat };
  }

  function buildProjection(bounds) {
    const midLat = ((bounds.minLat + bounds.maxLat) / 2) * Math.PI / 180;
    const xScale = Math.cos(midLat);
    const geoW = (bounds.maxLng - bounds.minLng) * xScale;
    const geoH = bounds.maxLat - bounds.minLat;
    const k = Math.min((MAP_W - 2 * PAD) / geoW, (MAP_H - 2 * PAD) / geoH);
    const offX = (MAP_W - geoW * k) / 2;
    const offY = (MAP_H - geoH * k) / 2;
    return {
      x: lng => (lng - bounds.minLng) * xScale * k + offX,
      y: lat => (bounds.maxLat - lat) * k + offY,
    };
  }

  function outlinePathD() {
    const parts = [];
    walkRings(ring => {
      if (!ring || ring.length < 3) return;
      let d = '';
      ring.forEach((p, i) => {
        d += (i ? 'L' : 'M') + state.proj.x(p[0]).toFixed(2) + ' ' + state.proj.y(p[1]).toFixed(2) + ' ';
      });
      parts.push(d + 'Z');
    });
    return parts.join('');
  }

  function haversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.pow(Math.sin(dLat / 2), 2) +
              Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
              Math.pow(Math.sin(dLng / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function formatDriveTime(km) {
    const hrs = km * 1.4 / 50;
    return hrs >= 24 ? (hrs / 24).toFixed(1) + ' 天' : hrs.toFixed(1) + ' 小时';
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function setRouteColor(hex) {
    state.color = hex || null;
    const grad = $('routeGrad');
    if (!grad) return;
    grad.textContent = '';
    const mk = (off, col) => {
      const s = document.createElementNS(SVG_NS, 'stop');
      s.setAttribute('offset', off);
      s.setAttribute('stop-color', col);
      grad.appendChild(s);
    };
    if (state.color) {
      mk('0%', lighten(state.color, 0.35));
      mk('100%', state.color);
      routeProgress.style.background = 'linear-gradient(90deg, ' + lighten(state.color, 0.35) + ', ' + state.color + ')';
      document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('active', b.dataset.c === state.color));
    } else {
      mk('0%', '#22d3ee');
      mk('55%', '#818cf8');
      mk('100%', '#f472b6');
      routeProgress.style.background = '';
      document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('active', b.dataset.c === ''));
    }
  }

  function applyTextStyle() {
    document.querySelectorAll('.pt-chip-bg').forEach(r => { r.style.fill = state.chipBg; });
    document.querySelectorAll('.pt-chip-text').forEach(t => { t.style.fill = state.textColor; });
    document.querySelectorAll('.seg-label').forEach(t => { t.style.fill = state.textColor; });
  }

  function setTheme(key) {
    state.theme = key;
    ['dark', 'light', 'gold', 'aurora'].forEach(k => $('mapWrap').classList.toggle('theme-' + k, k === key));
    document.querySelectorAll('.theme-opt').forEach(o => o.classList.toggle('active', o.dataset.theme === key));
    $('themePanel').classList.remove('show');
  }

  function isNatural(a) {
    return NATURAL_CATS.some(c => (a.category || '').indexOf(c) >= 0);
  }

  /* ---------- 地图渲染 ---------- */
  function renderOutline() {
    outlineG.textContent = '';
    const d = outlinePathD();
    el('path', { d: d, class: 'outline-shadow' }, outlineG);
    el('path', { d: d, class: 'outline' }, outlineG);
  }

  function renderAttractions() {
    markerG.textContent = '';
    ATTRACTIONS.forEach(a => {
      const x = state.proj.x(a.lng), y = state.proj.y(a.lat);
      const g = el('g', { class: 'marker', transform: 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')' }, markerG);
      el('circle', { r: 8, class: 'dot-halo' }, g);
      el('circle', { r: 5, class: isNatural(a) ? 'dot dot-n' : 'dot dot-c' }, g);
      const lbl = el('text', { class: 'marker-label', y: -11 }, g);
      lbl.textContent = a.name;

      g.addEventListener('mousedown', e => e.stopPropagation());
      g.addEventListener('click', e => {
        e.stopPropagation();
        addAttraction(a);
      });
      g.addEventListener('mouseenter', () => showTip(a));
      g.addEventListener('mousemove', e => moveTip(e));
      g.addEventListener('mouseleave', hideTip);
    });
  }

  function applyView() {
    svg.setAttribute('viewBox', state.view.x + ' ' + state.view.y + ' ' + state.view.w + ' ' + state.view.h);
  }

  /* ---------- 景点选择 ---------- */
  function addAttraction(a) {
    state.selected.push(a);
    renderRoute();
    setMapHint(false);
    syncHash();
  }

  function removeAttraction(idx) {
    state.selected.splice(idx, 1);
    renderRoute();
    setMapHint(state.selected.length === 0);
    syncHash();
  }

  function moveAttraction(idx, dir) {
    const to = idx + dir;
    if (to < 0 || to >= state.selected.length) return;
    const tmp = state.selected[idx];
    state.selected[idx] = state.selected[to];
    state.selected[to] = tmp;
    renderRoute();
    syncHash();
  }

  function optimizeOrder() {
    if (state.selected.length < 3) return;
    const order = [state.selected[0]];
    const rest = state.selected.slice(1);
    while (rest.length) {
      const cur = order[order.length - 1];
      let bestIdx = 0, bestD = Infinity;
      rest.forEach((a, i) => {
        const d = haversineKm(cur, a);
        if (d < bestD) { bestD = d; bestIdx = i; }
      });
      order.push(rest.splice(bestIdx, 1)[0]);
    }
    state.selected = order;
    renderRoute();
    syncHash();
    toast('已按就近顺序智能排序');
  }

  function setExample(key) {
    const ids = EXAMPLES[key] || [];
    const picked = [];
    ids.forEach(id => {
      const a = state.byId.get(id);
      if (a && !picked.some(p => p.id === id)) picked.push(a);
    });
    state.selected = picked;
    renderRoute();
    setMapHint(picked.length === 0);
    syncHash();
    if (picked.length >= 2) startRouteAnimation();
    toast('已加载示例路线');
  }

  /* ---------- 轨迹渲染 ---------- */
  function smoothPathD(pts) {
    if (pts.length < 2) return '';
    let d = 'M ' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 3, c1y = p1[1] + (p2[1] - p0[1]) / 3;
      const c2x = p2[0] - (p3[0] - p1[0]) / 3, c2y = p2[1] - (p3[1] - p1[1]) / 3;
      d += ' C ' + c1x.toFixed(2) + ' ' + c1y.toFixed(2) + ', ' + c2x.toFixed(2) + ' ' + c2y.toFixed(2) + ', ' +
           p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
    }
    return d;
  }

  function rectsOverlap(a, b, pad) {
    return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x &&
           a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
  }

  function chipFontSize(len) {
    if (len >= 12) return 9.5;
    if (len >= 8) return 10.5;
    return 11.5;
  }

  /* 站点名字标签：紧贴圆圈旁，允许堆叠压着 */
  function layoutChips(pts, names) {
    const badgeBoxes = pts.map(p => ({ x: p[0] - 10, y: p[1] - 10, w: 20, h: 20, kind: 'badge' }));
    const dirs = pts.map(p => p[0] > 780 ? -1 : 1);
    const metas = names.map(n => {
      const fs = chipFontSize(n.length);
      return { fs: fs, tw: Math.ceil(n.length * fs) + 16 };
    });
    const result = new Array(pts.length);
    const committed = [];
    pts.forEach((p, i) => {
      const dir = dirs[i], meta = metas[i];
      const tw = meta.tw;
      const dx = dir * 10;
      const x0 = p[0] + dx + (dir > 0 ? 0 : -tw);
      const y0 = p[1] - 10;
      result[i] = { dx: dx, dy: 0, tw: tw, fs: meta.fs };
      committed.push({ x: x0, y: y0, w: tw, h: 20, idx: i });
    });
    state.routeBoxes = badgeBoxes.concat(committed);
    return result;
  }

  /* 里程标签避让：自动找不压字的位置 */
  function segLabelPos(mx, my, textW, segBoxes) {
    const cands = [{ dx: 0, dy: 0 }];
    for (let k = 1; k <= 9; k++) {
      cands.push({ dx: 0, dy: k * 16 }, { dx: 0, dy: -k * 16 });
      cands.push({ dx: 14, dy: k * 16 }, { dx: -14, dy: k * 16 });
      cands.push({ dx: 14, dy: -k * 16 }, { dx: -14, dy: -k * 16 });
    }
    let best = null, bestScore = Infinity;
    for (const c of cands) {
      const yy = my - 10 + c.dy;
      const r = { x: mx + c.dx - textW / 2, y: yy - 8, w: textW, h: 16 };
      let score = 0, clash = false;
      for (const b of state.routeBoxes) {
        if (rectsOverlap(r, b, 5)) { score++; clash = true; }
      }
      for (const s of segBoxes) {
        if (rectsOverlap(r, s, 5)) { score++; clash = true; }
      }
      if (!clash) return { x: mx + c.dx, y: yy };
      if (score < bestScore) { bestScore = score; best = { x: mx + c.dx, y: yy }; }
    }
    return best || { x: mx, y: my - 10 };
  }

  function renderRoute() {
    routeLayer.textContent = '';
    routePointsG.textContent = '';
    routeLabelsG.textContent = '';
    $('routeTrail').textContent = '';
    stopAnim();
    hideArrival();
    state.lastArrived = -1;
    state.arrivals = null;
    state.ptEls = [];

    const n = state.selected.length;
    statCount.textContent = n;
    renderList();
    if (n < 2) {
      playBtn.disabled = true;
      replayBtn.disabled = true;
      statKm.textContent = '0 km';
      statHours.textContent = '—';
      routeInfo.textContent = n === 1 ? '再添加一个景点即可生成轨迹' : '添加至少两个景点开始';
      routeProgress.style.width = '0%';
      return;
    }

    const pts = state.selected.map(a => [state.proj.x(a.lng), state.proj.y(a.lat)]);
    const d = smoothPathD(pts);

    el('path', { id: 'routeCasing', d: d, class: 'route-casing' }, routeLayer);
    el('path', { id: 'routeMain', d: d, class: 'route-main' }, routeLayer);
    const carG = el('g', { id: 'routeCar' }, routeLayer);
    el('use', { href: '#carIcon', x: -13, y: -13, width: 26, height: 26, class: 'route-car' }, carG);

    const chipNames = state.selected.map(a => a.name + (state.notes[a.id] ? ' · ' + state.notes[a.id] : ''));
    const chipLayout = layoutChips(pts, chipNames);
    pts.forEach((p, i) => {
      const isFirst = i === 0, isLast = i === pts.length - 1;
      const badge = el('g', {
        class: 'pt-badge ' + (isFirst ? 'first' : isLast ? 'last' : 'mid'),
        transform: 'translate(' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ')',
      }, routePointsG);
      el('circle', { r: 13, class: 'pt-halo' }, badge);
      el('circle', { r: 10.5, class: 'pt-ring' }, badge);
      el('circle', { r: 8, class: 'pt-circle' }, badge);
      const num = el('text', { class: 'pt-text', y: 3.5 }, badge);
      num.setAttribute('font-size', 10);
      num.textContent = i + 1;

      const label = chipNames[i];
      const cl = chipLayout[i];
      const chip = el('g', { class: 'pt-chip', transform: 'translate(' + cl.dx + ' ' + cl.dy + ')' }, badge);
      const rect = el('rect', { x: cl.dx > 0 ? 0 : -cl.tw, y: 0, width: cl.tw, height: 20, rx: 10 }, chip);
      rect.setAttribute('class', 'pt-chip-bg');
      const t = el('text', { x: cl.dx > 0 ? cl.tw / 2 : -cl.tw / 2, y: 14, class: 'pt-chip-text' }, chip);
      t.setAttribute('font-size', cl.fs);
      t.textContent = label;
      state.ptEls.push(badge);
    });

    computeArrivals($('routeMain'), pts);
    fitRoute();

    const total = renderSegLabels(pts);

    state.totalKm = total;
    statKm.textContent = total.toFixed(0) + ' km';
    statHours.textContent = formatDriveTime(total);
    playBtn.disabled = false;
    replayBtn.disabled = false;

    applyTextStyle();
    startRouteAnimation();
  }

  /* 更新自定义备注后的标签：重新避让布局，不打断动画 */
  function updateChips() {
    if (state.selected.length < 2) return;
    const pts = state.selected.map(a => [state.proj.x(a.lng), state.proj.y(a.lat)]);
    const names = state.selected.map(a => a.name + (state.notes[a.id] ? ' · ' + state.notes[a.id] : ''));
    const layout = layoutChips(pts, names);
    state.ptEls.forEach((badge, i) => {
      const chip = badge.querySelector('.pt-chip');
      const rect = badge.querySelector('.pt-chip-bg');
      const text = badge.querySelector('.pt-chip-text');
      if (!chip || !rect || !text) return;
      const cl = layout[i];
      chip.setAttribute('transform', 'translate(' + cl.dx + ' ' + cl.dy + ')');
      rect.setAttribute('x', cl.dx > 0 ? 0 : -cl.tw);
      rect.setAttribute('width', cl.tw);
      text.setAttribute('x', cl.dx > 0 ? cl.tw / 2 : -cl.tw / 2);
      text.setAttribute('font-size', cl.fs);
      text.textContent = names[i];
    });
    applyTextStyle();
    renderSegLabels(pts);
  }

  function renderSegLabels(pts) {
    routeLabelsG.textContent = '';
    const segBoxes = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const km = haversineKm(state.selected[i], state.selected[i + 1]);
      total += km;
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      const textW = Math.max(30, (km.toFixed(0) + ' km').length * 6.5 + 10);
      const pos = segLabelPos(mx, my, textW, segBoxes);
      const t = el('text', { x: pos.x, y: pos.y, class: 'seg-label' }, routeLabelsG);
      t.textContent = km.toFixed(0) + ' km';
      segBoxes.push({ x: pos.x - textW / 2, y: pos.y - 8, w: textW, h: 16 });
    }
    return total;
  }

  /* ---------- 到站检测 / 路线聚焦 ---------- */
  function computeArrivals(main, pts) {
    state.arrivals = null;
    if (!main || !pts || pts.length < 2) return;
    const total = Math.max(main.getTotalLength(), 1);
    const SAMPLES = 320;
    const samples = [];
    for (let k = 0; k <= SAMPLES; k++) samples.push(main.getPointAtLength(total * k / SAMPLES));
    const arr = [0];
    for (let i = 1; i < pts.length - 1; i++) {
      let best = 0, bd = Infinity;
      for (let k = 0; k <= SAMPLES; k++) {
        const dx = samples[k].x - pts[i][0], dy = samples[k].y - pts[i][1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bd) { bd = dist; best = k; }
      }
      arr.push(best / SAMPLES);
    }
    arr.push(1);
    for (let i = 1; i < arr.length; i++) arr[i] = Math.max(arr[i], arr[i - 1]);
    state.arrivals = arr;
  }

  function fitRoute() {
    if (state.selected.length < 2) return;
    const pts = state.selected.map(a => [state.proj.x(a.lng), state.proj.y(a.lat)]);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });
    const padX = Math.max(110, (maxX - minX) * 0.18);
    const padY = Math.max(110, (maxY - minY) * 0.18);
    let w = maxX - minX + padX * 2;
    let h = maxY - minY + padY * 2;
    w = Math.max(260, Math.min(w, MAP_W * 2.5));
    h = Math.max(260, Math.min(h, MAP_H * 2.5));
    state.view = { x: minX - padX, y: minY - padY, w: w, h: h };
    applyView();
  }

  function pulseWaypoint(idx) {
    (state.ptEls || []).forEach((g, i) => g.classList.toggle('current', i === idx));
  }

  function showArrival(a, idx, total) {
    const card = $('arrivalCard');
    $('arrivalBadge').textContent = (idx + 1) + '/' + total;
    $('arrivalTitle').textContent = a.name;
    const note = state.notes[a.id];
    $('arrivalMeta').textContent = (a.category || '') + ' · ' + (a.city || '') + (a.region ? ' · ' + a.region : '') + (note ? ' · ' + note : '');
    $('arrivalDesc').textContent = a.desc || '';
    card.classList.remove('finish');
    card.classList.add('show');
  }

  function showFinish() {
    const card = $('arrivalCard');
    $('arrivalBadge').textContent = '✓';
    $('arrivalTitle').textContent = '路线完成！';
    $('arrivalMeta').textContent = '共 ' + state.selected.length + ' 站 · 总里程 ' + state.totalKm.toFixed(0) + ' km · 预估驾车 ' + formatDriveTime(state.totalKm);
    $('arrivalDesc').textContent = state.selected.map(a => a.name).join(' → ');
    card.classList.add('finish', 'show');
    pulseWaypoint(state.selected.length - 1);
  }

  function hideArrival() {
    const card = $('arrivalCard');
    if (card) card.classList.remove('show', 'finish');
    (state.ptEls || []).forEach(g => g.classList.remove('current'));
  }

  /* ---------- 轨迹动画 ---------- */
  function startRouteAnimation() {
    stopAnim();
    const main = $('routeMain');
    if (!main || state.selected.length < 2) return;
    const len = Math.max(main.getTotalLength(), 1);
    const dur = Math.min(14, 2.8 + len / 320) / parseFloat(speedSel.value);
    state.anim = { t: 0, len: len, dur: dur, playing: true, last: performance.now(), raf: 0 };
    drawFrame(0);
    routeInfo.textContent = '正在连接路线… 0%';
    state.anim.raf = requestAnimationFrame(tick);
    updatePlayBtn();
  }

  function tick(now) {
    const a = state.anim;
    if (!a) return;
    if (a.playing) a.t = Math.min(1, a.t + (now - a.last) / 1000 / a.dur);
    a.last = now;
    drawFrame(a.t);
    if (a.t >= 1) {
      a.playing = false;
      routeInfo.textContent = '轨迹完成 · 总里程 ' + state.totalKm.toFixed(0) + ' km';
      updatePlayBtn();
      showFinish();
      return;
    }
    a.raf = requestAnimationFrame(tick);
  }

  function drawFrame(t) {
    const main = $('routeMain');
    const car = $('routeCar');
    const trailG = $('routeTrail');
    if (!main || !car || !state.anim) return;
    const shown = state.anim.len * t;
    main.setAttribute('stroke-dasharray', shown.toFixed(2) + ' ' + state.anim.len.toFixed(2));
    const head = main.getPointAtLength(shown);
    const guide = main.getPointAtLength(Math.max(0, shown - 10));
    const angle = Math.atan2(head.y - guide.y, head.x - guide.x) * 180 / Math.PI;
    car.setAttribute('transform', 'translate(' + head.x.toFixed(2) + ' ' + head.y.toFixed(2) + ') rotate(' + angle.toFixed(1) + ')');
    if (trailG) {
      trailG.textContent = '';
      for (let i = 1; i <= 10; i++) {
        const back = Math.max(0, shown - i * 16);
        const p = main.getPointAtLength(back);
        el('circle', {
          cx: p.x.toFixed(2),
          cy: p.y.toFixed(2),
          r: (5.5 - i * 0.4).toFixed(2),
          fill: state.color ? lighten(state.color, 0.2) : '#67e8f9',
          opacity: (0.55 * (1 - i / 11)).toFixed(3),
        }, trailG);
      }
    }
    routeProgress.style.width = (t * 100).toFixed(1) + '%';
    if (t < 1) {
      routeInfo.textContent = '正在连接路线… ' + (t * 100).toFixed(0) + '%';
      if (state.arrivals) {
        let reached = 0;
        for (let i = state.arrivals.length - 1; i >= 0; i--) {
          if (t >= state.arrivals[i]) { reached = i; break; }
        }
        if (reached !== state.lastArrived) {
          state.lastArrived = reached;
          pulseWaypoint(reached);
          showArrival(state.selected[reached], reached, state.selected.length);
        }
      }
    }
  }

  function stopAnim() {
    if (state.anim && state.anim.raf) cancelAnimationFrame(state.anim.raf);
    state.anim = null;
  }

  function togglePlay() {
    const a = state.anim;
    if (!a) { startRouteAnimation(); return; }
    if (a.t >= 1 && !a.playing) {
      a.t = 0;
      routeProgress.style.width = '0%';
      routeInfo.textContent = '正在连接路线… 0%';
    }
    if (a.playing) {
      a.playing = false;
      cancelAnimationFrame(a.raf);
      routeInfo.textContent = '已暂停';
    } else {
      a.playing = true;
      a.last = performance.now();
      a.raf = requestAnimationFrame(tick);
    }
    updatePlayBtn();
  }

  function updatePlayBtn() {
    const a = state.anim;
    playBtn.textContent = a && a.playing ? '⏸ 暂停' : '▶ 播放';
  }

  /* ---------- 列表 ---------- */
  function renderList() {
    listEl.textContent = '';
    emptyHint.style.display = state.selected.length ? 'none' : 'block';
    state.selected.forEach((a, i) => {
      const row = document.createElement('div');
      row.className = 'sel-item' + (i === 0 ? ' first' : '') + (i === state.selected.length - 1 ? ' last' : '');

      const order = document.createElement('span');
      order.className = 'order';
      order.textContent = i + 1;

      const name = document.createElement('span');
      name.className = 'sname';
      name.textContent = a.name;

      const meta = document.createElement('span');
      meta.className = 'smeta';
      meta.textContent = (a.region || '') + ' · ' + (a.city || '') + ' · ' + (a.category || '');

      const ops = document.createElement('span');
      ops.className = 'ops';
      const up = document.createElement('button');
      up.textContent = '↑';
      up.disabled = i === 0;
      up.title = '上移';
      up.addEventListener('click', () => moveAttraction(i, -1));
      const down = document.createElement('button');
      down.textContent = '↓';
      down.disabled = i === state.selected.length - 1;
      down.title = '下移';
      down.addEventListener('click', () => moveAttraction(i, 1));
      const del = document.createElement('button');
      del.textContent = '✕';
      del.className = 'del';
      del.title = '移除';
      del.addEventListener('click', () => removeAttraction(i));
      ops.append(up, down, del);

      const top = document.createElement('div');
      top.className = 'sel-top';
      top.append(order, name, meta, ops);

      const note = document.createElement('input');
      note.className = 'note-input';
      note.type = 'text';
      note.maxLength = 18;
      note.placeholder = '自定义备注（显示在地图标签后）';
      note.value = state.notes[a.id] || '';
      note.addEventListener('input', () => {
        state.notes[a.id] = note.value.trim();
        updateChips();
      });

      row.append(top, note);
      listEl.appendChild(row);
    });
  }

  /* ---------- 搜索 ---------- */
  function matches(a, q) {
    q = q.trim().toLowerCase();
    if (!q) return false;
    return (a.name + ' ' + (a.keywords || '') + ' ' + (a.city || '') + ' ' + (a.region || '')).toLowerCase().indexOf(q) >= 0;
  }

  function onSearch() {
    const q = searchInput.value.trim();
    const list = q ? ATTRACTIONS.filter(a => matches(a, q)).slice(0, 8) : [];
    renderSuggestions(list);
  }

  function renderSuggestions(list) {
    suggestionsBox.textContent = '';
    if (!list.length) { suggestionsBox.style.display = 'none'; return; }
    state.sugIdx = 0;
    list.forEach((a, i) => {
      const d = document.createElement('div');
      d.className = 'sug-item' + (i === 0 ? ' active' : '');
      d.innerHTML = '<b></b><span></span>';
      d.querySelector('b').textContent = a.name;
      d.querySelector('span').textContent = a.category + ' · ' + (a.city || '');
      d.addEventListener('mousedown', e => { e.preventDefault(); pickSuggestion(a); });
      d.addEventListener('mouseenter', () => setSugActive(i));
      suggestionsBox.appendChild(d);
    });
    suggestionsBox.style.display = 'block';
  }

  function setSugActive(i) {
    state.sugIdx = i;
    Array.prototype.forEach.call(suggestionsBox.children, (c, j) => c.classList.toggle('active', j === i));
  }

  function pickSuggestion(a) {
    addAttraction(a);
    searchInput.value = '';
    suggestionsBox.style.display = 'none';
    searchInput.focus();
  }

  function hideSuggestions() {
    suggestionsBox.style.display = 'none';
  }

  /* ---------- 提示 / 分享 ---------- */
  function showTip(a) {
    tooltip.innerHTML = '<b></b><span></span>' + (a.desc ? '<p></p>' : '');
    tooltip.querySelector('b').textContent = a.name;
    tooltip.querySelector('span').textContent = a.category + ' · ' + (a.city || '') + (a.region ? ' · ' + a.region : '');
    if (a.desc) tooltip.querySelector('p').textContent = a.desc;
    tooltip.style.display = 'block';
  }

  function moveTip(e) {
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top = (e.clientY + 14) + 'px';
  }

  function hideTip() {
    tooltip.style.display = 'none';
  }

  function setMapHint(show) {
    mapHint.style.opacity = show ? '1' : '0';
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function syncHash() {
    try {
      history.replaceState(null, '', '#route=' + state.selected.map(a => a.id).join(','));
    } catch (e) { /* 忽略 */ }
  }

  function loadFromHash() {
    const m = location.hash.match(/route=([\w,-]+)/);
    if (!m) return;
    m[1].split(',').forEach(id => {
      const a = state.byId.get(id);
      if (a && !state.selected.some(s => s.id === id)) state.selected.push(a);
    });
  }

  function shareLink() {
    const url = location.href.split('#')[0] + '#route=' + state.selected.map(a => a.id).join(',');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => toast('分享链接已复制')).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(url) {
    const v = document.createElement('textarea');
    v.value = url;
    document.body.appendChild(v);
    v.select();
    try { document.execCommand('copy'); toast('分享链接已复制'); } catch (e) { prompt('复制下面链接即可分享路线：', url); }
    v.remove();
  }

  /* ---------- 缩放 / 平移 ---------- */
  function screenToSvg(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function zoomAt(p, factor) {
    const nw = clamp(state.view.w * factor, 40, MAP_W * 4);
    const ratio = nw / state.view.w;
    state.view.h *= ratio;
    state.view.x = p.x - (p.x - state.view.x) * ratio;
    state.view.y = p.y - (p.y - state.view.y) * ratio;
    state.view.w = nw;
    applyView();
  }

  function zoomCenter(factor) {
    zoomAt({ x: state.view.x + state.view.w / 2, y: state.view.y + state.view.h / 2 }, factor);
  }

  function resetView() {
    state.view = { x: 0, y: 0, w: MAP_W, h: MAP_H };
    applyView();
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    searchInput.addEventListener('input', onSearch);
    searchInput.addEventListener('focus', onSearch);
    searchInput.addEventListener('keydown', e => {
      const items = suggestionsBox.children;
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSugActive((state.sugIdx + 1) % items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSugActive((state.sugIdx - 1 + items.length) % items.length); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[state.sugIdx];
        if (item) {
          const idx = Array.prototype.indexOf.call(items, item);
          pickSuggestion(ATTRACTIONS.filter(a => matches(a, searchInput.value.trim()))[idx]);
        }
      } else if (e.key === 'Escape') hideSuggestions();
    });
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('.search-wrap')) hideSuggestions();
    });

    document.querySelectorAll('.ex').forEach(b => b.addEventListener('click', () => setExample(b.dataset.ex)));
    $('sortBtn').addEventListener('click', optimizeOrder);
    $('colorPick').addEventListener('input', e => setRouteColor(e.target.value));
    document.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => {
      setRouteColor(b.dataset.c || null);
      $('colorPick').value = b.dataset.c || '#22d3ee';
    }));
    $('textColorPick').addEventListener('input', e => {
      state.textColor = e.target.value;
      applyTextStyle();
    });
    $('chipBgPick').addEventListener('input', e => {
      state.chipBg = e.target.value;
      applyTextStyle();
    });
    $('themeBtn').addEventListener('click', e => {
      e.stopPropagation();
      $('themePanel').classList.toggle('show');
    });
    document.querySelectorAll('.theme-opt').forEach(o => o.addEventListener('click', () => setTheme(o.dataset.theme)));
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('.theme-wrap')) $('themePanel').classList.remove('show');
    });
    $('clearBtn').addEventListener('click', () => {
      state.selected = [];
      renderRoute();
      setMapHint(true);
      syncHash();
    });
    playBtn.addEventListener('click', togglePlay);
    replayBtn.addEventListener('click', startRouteAnimation);
    speedSel.addEventListener('change', () => { if (state.anim) startRouteAnimation(); });
    $('shareBtn').addEventListener('click', shareLink);

    $('zoomIn').addEventListener('click', () => zoomCenter(0.72));
    $('zoomOut').addEventListener('click', () => zoomCenter(1 / 0.72));
    $('fitBtn').addEventListener('click', fitRoute);
    $('resetView').addEventListener('click', resetView);

    svg.addEventListener('wheel', e => {
      e.preventDefault();
      zoomAt(screenToSvg(e), e.deltaY > 0 ? 1.18 : 1 / 1.18);
    }, { passive: false });

    svg.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      state.dragging = { sx: e.clientX, sy: e.clientY, vx: state.view.x, vy: state.view.y, moved: 0 };
      svg.classList.add('dragging');
    });
    window.addEventListener('mousemove', e => {
      if (!state.dragging) return;
      const dx = e.clientX - state.dragging.sx;
      const dy = e.clientY - state.dragging.sy;
      state.dragging.moved = Math.max(state.dragging.moved, Math.hypot(dx, dy));
      if (state.dragging.moved > 3) {
        const scale = state.view.w / svg.clientWidth;
        state.view.x = state.dragging.vx - dx * scale;
        state.view.y = state.dragging.vy - dy * scale;
        applyView();
      }
    });
    window.addEventListener('mouseup', () => {
      if (state.dragging && state.dragging.moved <= 3) {
        // 单击空白处：不做特殊处理
      }
      state.dragging = null;
      svg.classList.remove('dragging');
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    const bounds = computeBounds();
    state.proj = buildProjection(bounds);
    svg.setAttribute('viewBox', '0 0 ' + MAP_W + ' ' + MAP_H);
    renderOutline();
    renderAttractions();
    setTheme(state.theme);
    loadFromHash();
    renderRoute();
    renderList();
    setMapHint(state.selected.length === 0);
    bindEvents();
    if (state.selected.length >= 2) startRouteAnimation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
