/* 2027 나만의 무드 — app.js (v4) */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const LIMIT = 2;          // 그림·라인 각각 두 개까지
  const LINE_SKIP = 'i101'; // ROOM NO. 라인은 보기에서 제외

  /* ---------- state ---------- */
  const state = {
    name: '',
    keyword: '',
    number: '',
    colorId: null,
    moodKey: null,
    arts: [],   // 그림 최대 2 (고른 순서)
    lines: []   // 라인·구분 최대 2 (고른 순서)
  };

  let DATA = null;
  const COLORS = new Map();
  const MOODS = new Map();
  const ICONS = new Map();
  let ART_IDS = [];
  let LINE_IDS = [];
  let submitting = false;

  const dock = $('#dock');
  const dockTitle = $('#dockTitle');
  const dockSub = $('#dockSub');
  const dockSwatch = $('#dockSwatch');
  const submitBtn = $('#submitBtn');

  /* ---------- helpers ---------- */
  const stripBrackets = s => String(s).replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- color ---------- */
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
      if (b) selectColor(b.dataset.id);
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

  /* ---------- mood (골드 / 실버) ---------- */
  function renderMoods() {
    const grid = $('#moodGrid');
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
      state.moodKey = b.dataset.key;
      $$('#moodGrid .point').forEach(el => el.setAttribute('aria-checked', String(el.dataset.key === state.moodKey)));
      $('#errMood').hidden = true;
      updateDock();
    });
  }

  /* ---------- image grid (2개 고르기) ---------- */
  function iconButton(i) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-cell';
    b.dataset.id = i.id;
    b.setAttribute('role', 'checkbox');
    b.setAttribute('aria-checked', 'false');
    b.setAttribute('aria-label', i.name);
    b.innerHTML = `<img src="${i.file}" alt="" loading="lazy" width="${i.w}" height="${i.h}"><span class="pick-badge" aria-hidden="true"></span>`;
    return b;
  }

  function renderImageGrids() {
    const artGrid = $('#artGrid');
    const lineGrid = $('#lineGrid');
    const af = document.createDocumentFragment();
    ART_IDS.forEach(id => af.appendChild(iconButton(ICONS.get(id))));
    artGrid.appendChild(af);
    const lf = document.createDocumentFragment();
    LINE_IDS.forEach(id => lf.appendChild(iconButton(ICONS.get(id))));
    lineGrid.appendChild(lf);

    artGrid.addEventListener('click', e => {
      const b = e.target.closest('.icon-cell');
      if (b) togglePick('art', b.dataset.id);
    });
    lineGrid.addEventListener('click', e => {
      const b = e.target.closest('.icon-cell');
      if (b) togglePick('line', b.dataset.id);
    });

    bindArtScroll();
  }

  /* 그림 그리드: 화면 폭에 맞춰 4행 × (4.6열) 가로 스크롤 칸 크기 계산 */
  function sizeArtGrid() {
    const sc = $('#artScroll');
    const grid = $('#artGrid');
    if (!sc || !grid) return;
    const gap = 6;
    const per = window.innerWidth >= 600 ? 6.4 : 4.6;
    const inner = sc.clientWidth - 6; // 좌우 padding 3px 씩
    const cell = Math.max(46, Math.floor((inner - gap * (Math.ceil(per) - 1)) / per));
    grid.style.setProperty('--cell', cell + 'px');
  }

  function bindArtScroll() {
    const sc = $('#artScroll');
    const wrap = $('#artWrap');
    const cue = $('#artCue');
    if (!sc) return;

    const sync = () => {
      const max = sc.scrollWidth - sc.clientWidth;
      if (wrap) wrap.classList.toggle('at-end', max > 0 && sc.scrollLeft >= max - 4);
      if (cue) cue.classList.toggle('off', sc.scrollLeft > 16);
    };
    sc.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', () => { sizeArtGrid(); sync(); });
    sizeArtGrid();
    sync();
  }

  function togglePick(kind, id) {
    const list = kind === 'art' ? state.arts : state.lines;
    const gridSel = kind === 'art' ? '#artGrid' : '#lineGrid';
    const idx = list.indexOf(id);
    let removed = null;

    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      if (list.length >= LIMIT) removed = list.shift();
      list.push(id);
    }

    $$(`${gridSel} .icon-cell`).forEach(el => {
      const pos = list.indexOf(el.dataset.id);
      el.setAttribute('aria-checked', String(pos >= 0));
      const badge = el.querySelector('.pick-badge');
      if (badge) badge.textContent = pos >= 0 ? String(pos + 1) : '';
    });

    if (removed && kind === 'art') notice('artHint', `‘${ICONS.get(removed).name}’ 대신 ‘${ICONS.get(id).name}’을(를) 담았어요.`, true);
    else notice(kind === 'art' ? 'artHint' : 'lineHint');
    if (kind === 'art' && state.arts.length) $('#errIcon').hidden = true;

    refreshPickState();
    updateDock();
  }

  const HINTS = {
    art: '두 개까지 고를 수 있어요. 세 번째를 고르면 먼저 고른 그림이 바뀌어요.',
    line: '두 개까지 고를 수 있어요.'
  };
  const hintTimers = { art: 0, line: 0 };

  function notice(which, msg, flash) {
    const kind = which === 'artHint' ? 'art' : 'line';
    const el = $('#' + which);
    if (!el) return;
    clearTimeout(hintTimers[kind]);
    if (flash && msg) {
      el.textContent = msg;
      el.classList.add('flash');
      hintTimers[kind] = setTimeout(() => {
        el.textContent = HINTS[kind];
        el.classList.remove('flash');
      }, 4200);
    } else {
      el.classList.remove('flash');
      const list = kind === 'art' ? state.arts : state.lines;
      if (list.length >= LIMIT) {
        el.textContent = '두 개 다 골랐어요.';
        el.classList.add('full');
      } else {
        el.textContent = HINTS[kind];
        el.classList.remove('full');
      }
    }
  }

  function refreshPickState() {
    [['art', '#artState', state.arts], ['line', '#lineState', state.lines]].forEach(([kind, sel, list]) => {
      const el = $(sel);
      if (!el) return;
      el.textContent = `${list.length} / ${LIMIT}`;
      el.classList.toggle('is-full', list.length === LIMIT);
    });

    const parts = [];
    state.arts.forEach(id => parts.push(ICONS.get(id).name));
    state.lines.forEach(id => parts.push(ICONS.get(id).name));
    $('#iconPicked').innerHTML = parts.length
      ? `고른 이미지 · <b>${parts.join(' · ')}</b>`
      : '아직 고르지 않았어요';
  }

  /* ---------- inputs ---------- */
  function bindInputs() {
    const nameEl = $('#inputName');
    const kwEl = $('#inputKeyword');
    const numEl = $('#inputNumber');

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
    numEl.addEventListener('input', () => {
      state.number = numEl.value;
      updateDock();
    });
  }

  /* ---------- 선택 요약 (하단 도크) ---------- */
  function basicPicked() {
    return [
      !!state.name.trim(),
      !!state.colorId,
      !!state.moodKey,
      state.arts.length > 0,
      !!state.keyword.trim()
    ].filter(Boolean).length;
  }

  function updateDock() {
    const color = state.colorId ? COLORS.get(state.colorId) : null;
    const mood = state.moodKey ? MOODS.get(state.moodKey) : null;

    if (color) {
      dockSwatch.style.background = color.hex;
      dockSwatch.classList.add('on');
    } else {
      dockSwatch.classList.remove('on');
    }

    const n = basicPicked();
    dockTitle.textContent = n === 0
      ? '아직 고른 게 없어요'
      : n === 5 ? '다 골랐어요. 이대로 참여해 주세요' : `다섯 가지 중 ${n}가지를 골랐어요`;

    const picked = [];
    if (mood) picked.push(mood.label);
    if (state.number.trim()) picked.push(state.number.trim());
    if (state.arts.length) picked.push(`그림 ${state.arts.length}`);
    if (state.lines.length) picked.push(`라인 ${state.lines.length}`);
    dockSub.textContent = picked.length ? picked.join(' · ') : '이름 · 컬러 · 무드 · 그림 · 숫자 · 키워드';
  }

  /* ---------- validation ---------- */
  function validate() {
    const problems = [];
    const set = (id, bad) => { $(id).hidden = !bad; if (bad) problems.push(id); };
    set('#errName', !state.name.trim());
    set('#errColor', !state.colorId);
    set('#errMood', !state.moodKey);
    set('#errIcon', state.arts.length === 0);
    set('#errKeyword', !state.keyword.trim());
    return problems;
  }

  function focusFirstProblem(problems) {
    const map = {
      '#errName': '#panel-name',
      '#errColor': '#panel-color',
      '#errMood': '#panel-mood',
      '#errIcon': '#panel-image',
      '#errKeyword': '#panel-keyword'
    };
    if (!problems.length) return;
    const panel = $(map[problems[0]]);
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (problems[0] === '#errName') $('#inputName').focus({ preventScroll: true });
    if (problems[0] === '#errKeyword') $('#inputKeyword').focus({ preventScroll: true });
  }

  /* ---------- submit ---------- */
  function imageAnswer() {
    const art = state.arts.map(id => stripBrackets(ICONS.get(id).ans));
    const line = state.lines.map(id => stripBrackets(ICONS.get(id).ans));
    return `그림: [${art.join(', ')}] / 라인: [${line.join(', ')}]`;
  }

  async function submit(e) {
    e?.preventDefault();
    if (submitting) return;
    const problems = validate();
    if (problems.length) {
      focusFirstProblem(problems);
      return;
    }

    const color = COLORS.get(state.colorId);
    const mood = MOODS.get(state.moodKey);
    const ans = v => (DATA.enc && typeof v === 'string' ? b64utf8(v) : v);

    const entries = DATA.form.entries;
    const body = new URLSearchParams();
    body.append(entries.name, state.name.trim());
    body.append(entries.color, ans(color.ans));
    body.append(entries.mood, ans(mood.ans));
    body.append(entries.image, imageAnswer());
    body.append(entries.number, state.number.trim());
    body.append(entries.keyword, state.keyword.trim());

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
    const color = COLORS.get(state.colorId);
    const mood = MOODS.get(state.moodKey);

    const artNames = state.arts.map(id => ICONS.get(id).name);
    const lineNames = state.lines.map(id => ICONS.get(id).name);
    const imageText = [
      artNames.length ? `그림 ${artNames.join(' · ')}` : '',
      lineNames.length ? `라인 ${lineNames.join(' · ')}` : ''
    ].filter(Boolean).join(' / ');

    const rows = [
      ['이름', state.name.trim()],
      ['Color', color.name, color.hex],
      ['Mood', mood.label],
      ['Image', imageText || '—'],
      ['Number', state.number.trim() || '—'],
      ['Keyword', state.keyword.trim()]
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
    dock.classList.remove('hide');
  }

  function resetAll() {
    ['#inputName', '#inputKeyword', '#inputNumber'].forEach(s => { $(s).value = ''; });
    state.name = '';
    state.keyword = '';
    state.number = '';
    state.colorId = null;
    state.moodKey = null;
    state.arts = [];
    state.lines = [];
    $$('#colorGrid .swatch').forEach(el => el.setAttribute('aria-checked', 'false'));
    $$('#moodGrid .point').forEach(el => el.setAttribute('aria-checked', 'false'));
    $$('.icon-cell').forEach(el => {
      el.setAttribute('aria-checked', 'false');
      const b = el.querySelector('.pick-badge');
      if (b) b.textContent = '';
    });
    $('#colorPicked').textContent = '아직 고르지 않았어요';
    const sc = $('#artScroll');
    if (sc) sc.scrollLeft = 0;
    $('#artCue')?.classList.remove('off');
    $('#artWrap')?.classList.remove('at-end');
    refreshPickState();
    notice('artHint');
    notice('lineHint');
    ['#errName', '#errKeyword', '#errColor', '#errMood', '#errIcon'].forEach(s => { $(s).hidden = true; });
    closeDone();
    updateDock();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- base64 (한글) ---------- */
  function b64utf8(s) {
    try {
      const bin = atob(s);
      const bytes = Array.prototype.map.call(bin, c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('');
      return decodeURIComponent(bytes);
    } catch (e) { return s; }
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
    DATA.points.forEach(p => MOODS.set(p.key, p));
    DATA.icons.forEach(i => ICONS.set(i.id, i));

    ART_IDS = DATA.icons.filter(i => i.group !== 'shape').map(i => i.id);
    LINE_IDS = DATA.icons.filter(i => i.group === 'shape' && i.id !== LINE_SKIP).map(i => i.id);

    renderColors();
    renderMoods();
    renderImageGrids();
    bindInputs();
    refreshPickState();
    notice('artHint');
    notice('lineHint');

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
    const nameEl = $('#inputName'), kwEl = $('#inputKeyword'), numEl = $('#inputNumber');
    nameEl.value = '홍길동'; state.name = '홍길동';
    kwEl.value = demo === '2' ? '양껏 행복하자' : '나는멋있어';
    state.keyword = kwEl.value;
    numEl.value = demo === '2' ? '0101' : '2027';
    state.number = numEl.value;
    selectColor(demo === '2' ? 'c22' : 'c05');
    const moodBtn = document.querySelector(`#moodGrid .point[data-key="${demo === '2' ? 'silver' : 'gold'}"]`);
    if (moodBtn) moodBtn.click();
    togglePick('art', 'i094');
    togglePick('art', demo === '2' ? 'i001' : 'i006');
    togglePick('line', 'i102');
    if (demo === '2') togglePick('line', 'i105');
    updateDock();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
