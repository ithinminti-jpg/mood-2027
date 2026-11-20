/* 2027 나만의 무드 — app.js */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- base64 (한글) ---------- */
  function b64utf8(s) {
    try {
      const bin = atob(s);
      const bytes = Array.prototype.map.call(bin, c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('');
      return decodeURIComponent(bytes);
    } catch (e) { return s; }
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
  const COLORS = new Map();
  const POINTS = new Map();
  const ICONS = new Map();
  const STYLES = new Map();
  let submitting = false;
  let submitted = false;

  const dock = $('#dock');
  const dockTitle = $('#dockTitle');
  const dockSub = $('#dockSub');
  const dockSwatch = $('#dockSwatch');
  const submitBtn = $('#submitBtn');

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
    updateDock();
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
      updateDock();
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
      updateDock();
    });
  }

  function selectIcon(id) {
    state.iconId = id;
    $$('#iconGrid .icon-cell').forEach(el => el.setAttribute('aria-checked', String(el.dataset.id === id)));
    const i = ICONS.get(id);
    $('#iconPicked').innerHTML = i ? `고른 그림 · <b>${i.name}</b>` : '아직 고르지 않았어요';
    $('#errIcon').hidden = true;
    updateDock();
  }

  function bindIconGrid() {
    $('#iconGrid').addEventListener('click', e => {
      const b = e.target.closest('.icon-cell');
      if (!b) return;
      selectIcon(b.dataset.id);
    });
  }

  /* ---------- 선택 요약 (하단 도크) ---------- */
  function pickedCount() {
    return ['name', 'keyword', 'colorId', 'pointKey', 'iconId'].filter(k => !!state[k]).length;
  }

  function updateDock() {
    const color = state.colorId ? COLORS.get(state.colorId) : null;
    const point = state.pointKey ? POINTS.get(state.pointKey) : null;
    const icon = state.iconId ? ICONS.get(state.iconId) : null;

    if (color) {
      dockSwatch.style.background = color.hex;
      dockSwatch.classList.add('on');
    } else {
      dockSwatch.classList.remove('on');
    }

    const n = pickedCount();
    dockTitle.textContent = n === 0
      ? '아직 고른 게 없어요'
      : n === 5 ? '다 골랐어요. 이대로 참여해 주세요' : `다섯 가지 중 ${n}가지를 골랐어요`;

    const picked = [];
    if (color) picked.push(color.name);
    if (point) picked.push(point.label);
    if (icon) picked.push(icon.name);
    dockSub.textContent = picked.length ? picked.join(' · ') : '이름 · 키워드 · 컬러 · 포인트 · 그림';
  }

  /* ---------- inputs ---------- */
  function bindInputs() {
    const nameEl = $('#inputName');
    const kwEl = $('#inputKeyword');

    nameEl.addEventListener('input', () => {
      state.name = nameEl.value;
      if (state.name.trim()) $('#errName').hidden = true;
      updateDock();
    });
    kwEl.addEventListener('input', () => {
      state.keyword = kwEl.value;
      if (state.keyword.trim()) $('#errKeyword').hidden = true;
      updateDock();
    });

    $('#keywordChips').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      kwEl.value = b.dataset.word;
      state.keyword = b.dataset.word;
      $('#errKeyword').hidden = true;
      updateDock();
      kwEl.focus({ preventScroll: true });
    });
  }

  /* ---------- validation ---------- */
  function validate() {
    const problems = [];
    const set = (id, bad) => { $(id).hidden = !bad; if (bad) problems.push(id); };
    set('#errName', !state.name.trim());
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
    const ans = v => (DATA.enc && typeof v === 'string' ? b64utf8(v) : v);

    const entries = DATA.form.entries;
    const body = new URLSearchParams();
    body.append(entries.name, state.name.trim());
    body.append(entries.keyword, state.keyword.trim());
    body.append(entries.color, ans(color.ans));
    body.append(entries.point, ans(point.ans));
    body.append(entries.icon, ans(icon.ans));
    body.append(entries.style, style ? ans(style.ans) : '상관없음');

    submitting = true;
    submitBtn.disabled = true;
    const label = submitBtn.textContent;
    submitBtn.textContent = '담는 중…';

    let failed = false;
    try {
      await fetch(DATA.form.url, { method: 'POST', mode: 'no-cors', body });
    } catch (err) {
      failed = true;
    }

    submitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = label;

    if (failed) {
      dockTitle.textContent = '전송이 되지 않았어요';
      dockSub.textContent = '연결을 확인하고 한 번만 더 눌러 주세요';
      return;
    }
    showDone();
  }

  function showDone() {
    submitted = true;
    const color = COLORS.get(state.colorId);
    const point = POINTS.get(state.pointKey);
    const icon = ICONS.get(state.iconId);
    const style = STYLES.get(state.styleKey) || STYLES.get('any');

    const rows = [
      ['이름', state.name.trim()],
      ['키워드', state.keyword.trim()],
      ['컬러', color.name, color.hex],
      ['포인트', point.label],
      ['그림', icon.name],
      ['글씨 느낌', style ? style.label : '상관없음']
    ];

    const list = $('#doneSummary');
    list.innerHTML = '';
    rows.forEach(([k, v, hex]) => {
      const li = document.createElement('li');
      const kEl = document.createElement('span');
      kEl.className = 'k';
      kEl.textContent = k;
      const vEl = document.createElement('span');
      vEl.className = 'v';
      if (hex) {
        const dot = document.createElement('i');
        dot.className = 'dot';
        dot.style.background = hex;
        vEl.appendChild(dot);
      }
      vEl.appendChild(document.createTextNode(v));
      li.appendChild(kEl);
      li.appendChild(vEl);
      list.appendChild(li);
    });

    $('#doneSub').textContent = `${state.name.trim()} 님의 2027 무드가 담겼어요.`;
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
    updateDock();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      const res = await fetch('data.json', { cache: 'no-cache' });
      DATA = await res.json();
    } catch (e) {
      dockTitle.textContent = '재료를 불러오지 못했어요';
      dockSub.textContent = '새로고침해 주세요';
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
    $('#againBtn').addEventListener('click', resetAll);

    updateDock();
    applyDemo();
  }

  /* 미리보기용: 주소에 ?demo=1 을 붙이면 예시가 채워진 상태로 보입니다 (전송과 무관) */
  function applyDemo() {
    const params = new URLSearchParams(location.search);
    const demo = params.get('demo');
    if (!demo) return;
    const hand = demo === '2';
    const nameEl = $('#inputName'), kwEl = $('#inputKeyword');
    nameEl.value = '홍길동'; state.name = '홍길동';
    kwEl.value = hand ? '양껏 행복하자' : 'LUCKY 2027';
    state.keyword = kwEl.value;
    selectColor(hand ? 'c22' : 'c05');
    const pointBtn = document.querySelector(`.point[data-key="${hand ? 'white' : 'silver'}"]`);
    if (pointBtn) pointBtn.click();
    selectIcon('i094');
    const styleBtn = document.querySelector(`.style[data-key="${hand ? 'hand' : 'classic'}"]`);
    if (styleBtn) styleBtn.click();
    updateDock();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
