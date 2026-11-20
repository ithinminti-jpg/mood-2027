/* 2027 나만의 무드 카드 — app.js */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- color math ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const toHex = (arr) => '#' + arr.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  function lum(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function ratio(a, b) {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return toHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  function shade(hex, amt) {
    // amt < 0 darkens, > 0 lightens
    const target = amt < 0 ? '#000000' : '#ffffff';
    return mix(hex, target, Math.abs(amt));
  }
  function ensureContrast(color, bg, target) {
    if (ratio(color, bg) >= target) return color;
    const target2 = lum(bg) > 0.42 ? '#17140f' : '#fffdf7';
    for (let t = 0.12; t <= 1.001; t += 0.07) {
      const c = mix(color, target2, t);
      if (ratio(c, bg) >= target) return c;
    }
    return target2;
  }

  /* ---------- state ---------- */
  const state = {
    name: '',
    keyword: '',
    colorId: null,
    pointKey: null,
    iconId: null,
    styleKey: 'any',
    group: 'basic'
  };

  let DATA = null;
  let COLORS = new Map();
  let POINTS = new Map();
  let ICONS = new Map();
  let STYLES = new Map();
  let submitting = false;
  let submitted = false;

  const card = $('#moodCard');
  const cardKeyword = $('#cardKeyword');
  const cardName = $('#cardName');
  const cardIcon = $('#cardIcon');
  const cardIconEmpty = $('#cardIconEmpty');
  const stageHint = $('#stageHint');
  const dock = $('#dock');
  const dockTitle = $('#dockTitle');
  const dockSub = $('#dockSub');
  const dockDot = $('#dockDot');
  const dockIcon = $('#dockIcon');
  const submitBtn = $('#submitBtn');

  const PAGES = {
    basic: '기본',
    shape: '라인·구분',
    extra: '시즌·취미'
  };

  /* ---------- rendering ---------- */
  function renderColors() {
    const grid = $('#colorGrid');
    const frag = document.createDocumentFragment();
    DATA.colors.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.setAttribute('aria-label', c.name);
      b.dataset.id = c.id;
      b.innerHTML = `<img src="${c.file}" alt="" loading="lazy" width="135" height="135"><span class="swatch-check" aria-hidden="true">✓</span>`;
      frag.appendChild(b);
    });
    grid.appendChild(frag);
    grid.addEventListener('click', e => {
      const b = e.target.closest('.swatch');
      if (!b) return;
      selectColor(b.dataset.id);
    });
  }

  function selectColor(id) {
    state.colorId = id;
    $$('#colorGrid .swatch').forEach(el => {
      el.setAttribute('aria-checked', String(el.dataset.id === id));
    });
    const c = COLORS.get(id);
    $('#colorPicked').innerHTML = c ? `고른 색 · <b>${c.name}</b>` : '아직 고르지 않았어요';
    $('#errColor').hidden = true;
    update();
  }

  function renderPoints() {
    const grid = $('#pointGrid');
    DATA.points.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'point';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.dataset.key = p.key;
      b.innerHTML = `<span class="orb" style="background:${p.swatch}"></span><span>${p.label}</span>`;
      grid.appendChild(b);
    });
    grid.addEventListener('click', e => {
      const b = e.target.closest('.point');
      if (!b) return;
      state.pointKey = b.dataset.key;
      $$('#pointGrid .point').forEach(el => el.setAttribute('aria-checked', String(el.dataset.key === state.pointKey)));
      $('#errPoint').hidden = true;
      update();
    });
  }

  function renderTabs() {
    const tabs = $('#iconTabs');
    DATA.groups.forEach((g, i) => {
      const n = DATA.icons.filter(x => x.group === g.key).length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === 0));
      b.dataset.key = g.key;
      b.innerHTML = `${g.label}<span class="count">${n}</span>`;
      tabs.appendChild(b);
    });
    tabs.addEventListener('click', e => {
      const b = e.target.closest('.tab');
      if (!b) return;
      state.group = b.dataset.key;
      $$('#iconTabs .tab').forEach(el => el.setAttribute('aria-selected', String(el.dataset.key === state.group)));
      renderIconGrid();
    });
  }

  function renderIconGrid() {
    const grid = $('#iconGrid');
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    DATA.icons.filter(i => i.group === state.group).forEach(i => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'icon-cell';
      b.dataset.group = i.group;
      b.dataset.id = i.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i.id === state.iconId));
      b.setAttribute('aria-label', i.name);
      b.innerHTML = `<img src="${i.file}" alt="" loading="lazy" width="${i.w}" height="${i.h}">`;
      frag.appendChild(b);
    });
    grid.appendChild(frag);
  }

  function renderStyles() {
    const grid = $('#styleGrid');
    DATA.styles.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'style';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(s.key === state.styleKey));
      b.dataset.key = s.key;
      const cls = s.key === 'classic' ? 'serif' : s.key === 'modern' ? 'sans' : s.key === 'hand' ? 'hand' : 'serif';
      b.innerHTML = `<span class="aa ${cls}">Aa</span><span>${s.label}</span>`;
      grid.appendChild(b);
    });
    grid.addEventListener('click', e => {
      const b = e.target.closest('.style');
      if (!b) return;
      state.styleKey = b.dataset.key;
      $$('#styleGrid .style').forEach(el => el.setAttribute('aria-checked', String(el.dataset.key === state.styleKey)));
      update();
    });
  }

  function selectIcon(id) {
    state.iconId = id;
    $$('#iconGrid .icon-cell').forEach(el => el.setAttribute('aria-checked', String(el.dataset.id === id)));
    const i = ICONS.get(id);
    $('#iconPicked').innerHTML = i ? `고른 그림 · <b>${i.name}</b>` : '아직 고르지 않았어요';
    $('#errIcon').hidden = true;
    update();
  }

  /* icon grid delegate (registered once) */
  function bindIconGrid() {
    $('#iconGrid').addEventListener('click', e => {
      const b = e.target.closest('.icon-cell');
      if (!b) return;
      selectIcon(b.dataset.id);
    });
  }

  /* ---------- live preview ---------- */
  const DEFAULT_BG = { bg: '#efe9de', bg2: '#e6dfd1' };

  function computeSkin() {
    const color = state.colorId ? COLORS.get(state.colorId) : null;
    const point = state.pointKey ? POINTS.get(state.pointKey) : null;
    const bg = color ? color.hex : DEFAULT_BG.bg;
    const bg2 = color ? shade(color.hex, color.pearl ? -0.08 : -0.12) : DEFAULT_BG.bg2;
    const fg = point ? ensureContrast(point.swatch, bg, 3.1) : '#8a8073';
    const line = point ? ensureContrast(point.swatch, bg, 1.5) : 'rgba(34,30,24,.35)';
    const pearl = !!(color && color.pearl);
    return { bg, bg2, fg, line, pearl, color, point };
  }

  function update() {
    if (submitted) return;
    const skin = computeSkin();

    card.style.setProperty('--card-bg', skin.bg);
    card.style.setProperty('--card-bg2', skin.bg2);
    card.style.setProperty('--card-fg', skin.fg);
    card.style.setProperty('--card-line', skin.line);
    card.dataset.pearl = skin.pearl ? '1' : '0';
    card.dataset.style = state.styleKey || 'any';

    const kw = state.keyword.trim();
    cardKeyword.textContent = kw || '나만의 무드';
    const len = kw.length;
    const scale = len <= 7 ? 1 : len <= 11 ? 0.9 : len <= 16 ? 0.78 : 0.68;
    card.style.setProperty('--kw-scale', String(scale));

    card.dataset.latin = (/^[\x20-\x7E]+$/.test(kw) && /[A-Za-z]/.test(kw)) ? '1' : '0';

    const nm = state.name.trim();
    cardName.textContent = nm ? `${nm} 님` : '이름';

    const icon = state.iconId ? ICONS.get(state.iconId) : null;
    if (icon) {
      if (cardIcon.getAttribute('src') !== icon.file) cardIcon.setAttribute('src', icon.file);
      cardIcon.hidden = false;
      cardIconEmpty.hidden = true;
    } else {
      cardIcon.hidden = true;
      cardIcon.removeAttribute('src');
      cardIconEmpty.hidden = false;
    }

    // dock
    if (skin.color) {
      dockDot.style.background = skin.color.hex;
      dockDot.style.opacity = '0.9';
    } else {
      dockDot.style.opacity = '0';
    }
    if (icon) {
      dockIcon.src = icon.file;
      dockIcon.hidden = false;
    } else {
      dockIcon.hidden = true;
      dockIcon.removeAttribute('src');
    }
    const parts = [];
    if (skin.color) parts.push(skin.color.name);
    if (skin.point) parts.push(skin.point.label);
    dockTitle.textContent = parts.length ? parts.join(' · ') : '카드를 채워 주세요';
    dockSub.textContent = icon ? `고른 그림 · ${icon.name}` : '이름 · 키워드 · 색 · 포인트 · 그림';

    const done = ['name', 'keyword', 'colorId', 'pointKey', 'iconId'].filter(k => !!state[k]).length;
    stageHint.textContent = done === 5
      ? '마음에 드나요? 카드로 완성해 보세요'
      : done === 0 ? '색과 그림을 고르면 카드가 채워져요' : `다섯 가지 중 ${done}가지를 골랐어요`;
  }

  /* ---------- inputs ---------- */
  function bindInputs() {
    const nameEl = $('#inputName');
    const kwEl = $('#inputKeyword');

    nameEl.addEventListener('input', () => {
      state.name = nameEl.value;
      if (state.name.trim()) $('#errName').hidden = true;
      update();
    });
    kwEl.addEventListener('input', () => {
      state.keyword = kwEl.value;
      if (state.keyword.trim()) $('#errKeyword').hidden = true;
      update();
    });

    $('#keywordChips').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      kwEl.value = b.dataset.word;
      state.keyword = b.dataset.word;
      $('#errKeyword').hidden = true;
      update();
      kwEl.focus({ preventScroll: true });
    });
  }

  /* ---------- validation ---------- */
  function validate() {
    const problems = [];
    const set = (id, bad) => { $(id).hidden = !bad; if (bad) problems.push(id); };
    const nm = state.name.trim();
    set('#errName', !nm);
    set('#errKeyword', !state.keyword.trim());
    set('#errColor', !state.colorId);
    set('#errPoint', !state.pointKey);
    set('#errIcon', !state.iconId);
    return problems;
  }

  function focusFirstProblem(problems) {
    const map = {
      '#errName': '#panel-name',
      '#errKeyword': '#panel-keyword',
      '#errColor': '#panel-color',
      '#errPoint': '#panel-point',
      '#errIcon': '#panel-icon'
    };
    if (!problems.length) return;
    const panel = $(map[problems[0]]);
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (problems[0] === '#errName') $('#inputName').focus({ preventScroll: true });
    if (problems[0] === '#errKeyword') $('#inputKeyword').focus({ preventScroll: true });
  }

  /* ---------- submit ---------- */
  async function submit(e) {
    e?.preventDefault();
    if (submitting) return;
    const problems = validate();
    if (problems.length) {
      focusFirstProblem(problems);
      return;
    }

    const color = COLORS.get(state.colorId);
    const point = POINTS.get(state.pointKey);
    const icon = ICONS.get(state.iconId);
    const style = STYLES.get(state.styleKey);

    const entries = DATA.form.entries;
    const body = new URLSearchParams();
    body.append(entries.name, state.name.trim());
    body.append(entries.keyword, state.keyword.trim());
    body.append(entries.color, color.ans);
    body.append(entries.point, point.ans);
    body.append(entries.icon, icon.ans);
    body.append(entries.style, style ? style.ans : '상관없음');

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '담는 중…';

    let failed = false;
    try {
      await fetch(DATA.form.url, { method: 'POST', mode: 'no-cors', body });
    } catch (err) {
      failed = true;
    }

    submitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = '카드 완성하기';

    if (failed) {
      dockTitle.textContent = '전송이 되지 않았어요';
      dockSub.textContent = '연결을 확인하고 한 번만 더 눌러 주세요';
      return;
    }
    showDone();
  }

  function showDone() {
    submitted = true;
    const skin = computeSkin();
    const stage = $('#doneStage');
    stage.innerHTML = '';
    const clone = card.cloneNode(true);
    clone.removeAttribute('id');
    clone.removeAttribute('aria-live');
    $$('[id]', clone).forEach(el => el.removeAttribute('id'));
    stage.appendChild(clone);
    $('#doneSub').textContent = `${state.name.trim()} 님의 카드가 완성됐어요.`;
    $('#doneScreen').hidden = false;
    $('#doneScreen').scrollTop = 0;
    dock.classList.add('hide');
    document.body.style.overflow = 'hidden';
  }

  function closeDone() {
    $('#doneScreen').hidden = true;
    document.body.style.overflow = '';
    submitted = false;
    dock.classList.remove('hide');
    update();
  }

  function resetAll() {
    ['#inputName', '#inputKeyword'].forEach(s => { $(s).value = ''; });
    state.name = '';
    state.keyword = '';
    state.colorId = null;
    state.pointKey = null;
    state.iconId = null;
    state.styleKey = 'any';
    $$('#colorGrid .swatch').forEach(el => el.setAttribute('aria-checked', 'false'));
    $$('#pointGrid .point').forEach(el => el.setAttribute('aria-checked', 'false'));
    $$('#styleGrid .style').forEach(el => el.setAttribute('aria-checked', String(el.dataset.key === 'any')));
    renderIconGrid();
    $('#colorPicked').textContent = '아직 고르지 않았어요';
    $('#iconPicked').textContent = '아직 고르지 않았어요';
    ['#errName', '#errKeyword', '#errColor', '#errPoint', '#errIcon'].forEach(s => { $(s).hidden = true; });
    closeDone();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- card image ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function setFont(ctx, font) {
    ctx.font = font;
  }

  function letterSpacing(ctx, px) {
    try { ctx.letterSpacing = px + 'px'; } catch (e) { /* older engines */ }
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    const pushLongWord = (word) => {
      // break a word that is wider than the line by characters
      let chunk = '';
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      return chunk;
    };
    for (const raw of words) {
      const word = raw;
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        if (ctx.measureText(word).width > maxWidth) {
          line = pushLongWord(word);
        } else {
          line = word;
        }
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  async function renderCardCanvas() {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    const W = 900, H = 1206, R = 92;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const skin = computeSkin();

    // body
    ctx.save();
    roundRect(ctx, 0, 0, W, H, R);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, skin.bg);
    g.addColorStop(1, skin.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // light falloff at edges for depth
    const vg = ctx.createRadialGradient(W / 2, H * 0.35, W * 0.15, W / 2, H * 0.5, W * 0.95);
    vg.addColorStop(0, 'rgba(255,255,255,0.20)');
    vg.addColorStop(0.55, 'rgba(255,255,255,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (skin.pearl) {
      ctx.globalCompositeOperation = 'screen';
      const p1 = ctx.createRadialGradient(W * 0.78, H * 0.1, 0, W * 0.78, H * 0.1, W * 0.6);
      p1.addColorStop(0, 'rgba(255,235,250,0.42)');
      p1.addColorStop(1, 'rgba(255,235,250,0)');
      ctx.fillStyle = p1; ctx.fillRect(0, 0, W, H);
      const p2 = ctx.createRadialGradient(W * 0.2, H * 0.92, 0, W * 0.2, H * 0.92, W * 0.55);
      p2.addColorStop(0, 'rgba(210,240,255,0.34)');
      p2.addColorStop(1, 'rgba(210,240,255,0)');
      ctx.fillStyle = p2; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    // punched hole
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, 48, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#f7f2e8';
    ctx.fill();
    ctx.restore();

    // inner frame
    ctx.save();
    roundRect(ctx, 34, 34, W - 68, H - 68, 68);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = skin.line;
    ctx.stroke();
    ctx.restore();

    const fg = skin.fg;
    ctx.fillStyle = fg;
    ctx.textBaseline = 'alphabetic';

    // head : year + mark
    ctx.save();
    ctx.textAlign = 'left';
    letterSpacing(ctx, 9);
    setFont(ctx, '600 60px "Cormorant Garamond", "Noto Serif KR", serif');
    ctx.fillText('2027', 74, 168);
    letterSpacing(ctx, 6);
    ctx.globalAlpha = 0.85;
    ctx.textAlign = 'right';
    setFont(ctx, '500 21px "Noto Sans KR", sans-serif');
    ctx.fillText('MOOD CARD', W - 74, 158);
    ctx.restore();

    // keyword
    const kw = state.keyword.trim() || '나만의 무드';
    ctx.save();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    const styleKey = state.styleKey || 'any';
    let family = '"Noto Serif KR", serif';
    let weight = '500';
    if (styleKey === 'modern') { family = '"Noto Sans KR", sans-serif'; weight = '700'; }
    else if (styleKey === 'hand') { family = '"Nanum Pen Script", cursive'; weight = '400'; }
    const latin = /^[\x20-\x7E]+$/.test(kw) && /[A-Za-z]/.test(kw);
    if (latin && (styleKey === 'any' || styleKey === 'classic')) {
      family = '"Cormorant Garamond", "Noto Serif KR", serif';
      weight = '600';
    }
    let size = styleKey === 'hand' ? 84 : latin ? 92 : 72;
    letterSpacing(ctx, latin ? 3 : 0);
    setFont(ctx, `${weight} ${size}px ${family}`);
    const maxW = W - 190;
    let lines = wrapLines(ctx, kw, maxW);
    while (lines.length > 2 && size > 40) {
      size -= 6;
      setFont(ctx, `${weight} ${size}px ${family}`);
      lines = wrapLines(ctx, kw, maxW);
    }
    while (lines.some(l => ctx.measureText(l).width > maxW) && size > 34) {
      size -= 4;
      setFont(ctx, `${weight} ${size}px ${family}`);
      lines = wrapLines(ctx, kw, maxW);
    }
    const lh = size * 1.28;
    const blockTop = 470 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, blockTop + i * lh));
    ctx.restore();

    // medallion
    const my = 790, mr = 148;
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,253,247,0.92)';
    ctx.fill();
    ctx.restore();

    const icon = state.iconId ? ICONS.get(state.iconId) : null;
    if (icon) {
      try {
        const img = new Image();
        img.src = icon.file;
        if (img.decode) { await img.decode(); } else {
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        }
        const box = mr * 1.42;
        const k = Math.min(box / img.naturalWidth, box / img.naturalHeight);
        const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
        ctx.drawImage(img, W / 2 - dw / 2, my - dh / 2, dw, dh);
      } catch (e) { /* skip */ }
    }

    // foot
    ctx.save();
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(W / 2 - 52, 1014, 104, 3);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    letterSpacing(ctx, 2);
    setFont(ctx, '500 40px "Noto Sans KR", sans-serif');
    const nm = state.name.trim();
    ctx.fillText(nm ? `${nm} 님` : '', W / 2, 1086);
    ctx.globalAlpha = 0.72;
    letterSpacing(ctx, 8);
    setFont(ctx, '300 20px "Noto Sans KR", sans-serif');
    ctx.fillText('정미년 · 2027', W / 2, 1130);
    ctx.restore();

    return canvas;
  }

  async function saveCard() {
    const btn = $('#saveBtn');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '만드는 중…';
    try {
      const canvas = await renderCardCanvas();
      const name = (state.name.trim() || 'mood').replace(/[\\/:*?"<>|\s]+/g, '-');
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('no blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `2027-mood-card-${name}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      btn.textContent = '저장했어요';
      setTimeout(() => { btn.textContent = original; }, 1600);
    } catch (e) {
      btn.textContent = '저장이 막혔어요';
      setTimeout(() => { btn.textContent = original; }, 1800);
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      const res = await fetch('data.json', { cache: 'no-cache' });
      DATA = await res.json();
    } catch (e) {
      stageHint.textContent = '카드 재료를 불러오지 못했어요. 새로고침해 주세요.';
      return;
    }
    DATA.colors.forEach(c => COLORS.set(c.id, c));
    DATA.points.forEach(p => POINTS.set(p.key, p));
    DATA.icons.forEach(i => ICONS.set(i.id, i));
    DATA.styles.forEach(s => STYLES.set(s.key, s));

    renderColors();
    renderPoints();
    renderTabs();
    renderIconGrid();
    renderStyles();
    bindIconGrid();
    bindInputs();

    $('#moodForm').addEventListener('submit', submit);
    $('#saveBtn').addEventListener('click', saveCard);
    $('#againBtn').addEventListener('click', resetAll);

    update();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
