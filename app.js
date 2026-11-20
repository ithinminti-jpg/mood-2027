/* 2027 나만의 무드 — app.js (v5: 그림·라인 각 2자리, 같은 항목 2번 선택 허용) */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const SLOTS = 2;          // 그림·라인 각각 두 자리
  const MARKS = ['①', '②'];
  const LINE_SKIP = 'i101'; // ROOM NO. 라인은 보기에서 제외

  /* ---------- state ---------- */
  const state = {
    name: '',
    keyword: '',
    number: '',
    colorId: null,
    moodKey: null,
    arts: [null, null],   // 그림 자리 ①, ② (같은 항목 중복 허용)
    lines: [null, null]   // 라인·구분 자리 ①, ②
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
  const iconName = id => (id && ICONS.get(id) ? ICONS.get(id).name : '');
  const slotsOf = kind => (kind === 'art' ? state.arts : state.lines);

  /* 받침에 맞는 조사 (을/를) */
  function josa(word, withBatchim, without) {
    const s = String(word).replace(/[)\]}>\s.,]+$/, '');
    for (let i = s.length - 1; i >= 0; i--) {
      const code = s.charCodeAt(i);
      if (code >= 0xAC00 && code <= 0xD7A3) return ((code - 0xAC00) % 28) ? withBatchim : without;
    }
    return without;
  }

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

  /* ---------- 자리(슬롯) 칩 ---------- */
  function renderSlots() {
    [['art', 'artSlots', '그림'], ['line', 'lineSlots', '라인']].forEach(([kind, hostId, label]) => {
      const host = $('#' + hostId);
      if (!host) return;
      for (let i = 0; i < SLOTS; i++) {
        const d = document.createElement('div');
        d.className = 'slot';
        d.dataset.kind = kind;
        d.dataset.slot = String(i);
        d.innerHTML = `
          <span class="slot-no" aria-hidden="true">${MARKS[i]}</span>
          <span class="slot-thumb" aria-hidden="true"></span>
          <span class="slot-name">비어 있음</span>
          <button type="button" class="slot-x" data-kind="${kind}" data-slot="${i}" aria-label="${label} ${i + 1}번 자리 비우기">×</button>`;
        host.appendChild(d);
      }
      host.addEventListener('click', e => {
        const x = e.target.closest('.slot-x');
        if (!x) return;
        clearSlot(kind, Number(x.dataset.slot));
      });
    });
  }

  function syncSlots(kind) {
    const arr = slotsOf(kind);
    $$(`#${kind}Slots .slot`).forEach((el, i) => {
      const id = arr[i];
      const filled = !!id;
      el.classList.toggle('filled', filled);
      const thumb = el.querySelector('.slot-thumb');
      const name = el.querySelector('.slot-name');
      if (filled && ICONS.get(id)) {
        thumb.innerHTML = `<img src="${ICONS.get(id).file}" alt="">`;
        name.textContent = ICONS.get(id).name;
      } else {
        thumb.innerHTML = '';
        name.textContent = '비어 있음';
      }
    });
  }

  function clearSlot(kind, i) {
    const arr = slotsOf(kind);
    if (!arr[i]) return;
    const removed = iconName(arr[i]);
    arr[i] = null;
    syncGrid(kind);
    syncSlots(kind);
    refreshPickState();
    notice(kind === 'art' ? 'artHint' : 'lineHint', `${MARKS[i]} 자리의 ‘${removed}’${josa(removed, '을', '를')} 비웠어요.`, true);
    updateDock();
  }

  /* ---------- image grid ---------- */
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
      if (b) pick('art', b.dataset.id);
    });
    lineGrid.addEventListener('click', e => {
      const b = e.target.closest('.icon-cell');
      if (b) pick('line', b.dataset.id);
    });

    syncGrid('art');
    syncGrid('line');
    bindArtScroll();
  }

  /* 그림 그리드: 화면 폭에 맞춰 4행 × (4.3열) 가로 스크롤 칸 크기 계산 */
  function sizeArtGrid() {
    const sc = $('#artScroll');
    const grid = $('#artGrid');
    if (!sc || !grid) return;
    const gap = 6;
    const per = window.innerWidth >= 600 ? 6.4 : 4.3;
    const inner = sc.clientWidth - 6;
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

  /* 한 번 누르면 빈 자리(① → ②)에 담기고, 둘 다 차 있으면 ② 자리를 바꾼다.
     같은 항목을 두 번 누르면 ①·②에 같은 것이 담긴다. */
  function pick(kind, id) {
    const arr = slotsOf(kind);
    let slot = arr.indexOf(null);
    let replaced = null;
    if (slot === -1) { slot = SLOTS - 1; replaced = arr[slot]; }
    arr[slot] = id;

    syncGrid(kind);
    syncSlots(kind);
    refreshPickState();

    const name = iconName(id);
    const hintId = kind === 'art' ? 'artHint' : 'lineHint';
    if (replaced) {
      notice(hintId, `${MARKS[slot]} 자리의 ‘${iconName(replaced)}’${josa(iconName(replaced), '을', '를')} ‘${name}’${josa(name, '으로', '로')} 바꿨어요.`, true);
    } else if (arr[0] && arr[1] && arr[0] === arr[1]) {
      notice(hintId, `① ② 자리에 같은 ‘${name}’${josa(name, '을', '를')} 담았어요.`, true);
    } else {
      notice(hintId, `${MARKS[slot]} 자리에 ‘${name}’${josa(name, '을', '를')} 담았어요.`, true);
    }

    if (kind === 'art' && state.arts[0]) $('#errIcon').hidden = true;
    updateDock();
  }

  function syncGrid(kind) {
    const arr = slotsOf(kind);
    const gridSel = kind === 'art' ? '#artGrid' : '#lineGrid';
    $$(`${gridSel} .icon-cell`).forEach(el => {
      const marks = [];
      arr.forEach((id, i) => { if (id && id === el.dataset.id) marks.push(MARKS[i]); });
      el.setAttribute('aria-checked', String(marks.length > 0));
      const badge = el.querySelector('.pick-badge');
      if (badge) badge.textContent = marks.join('');
    });
  }

  const HINTS = {
    art: '빈 자리를 누르면 ①, ② 순서로 담겨요. 같은 그림을 두 번 눌러도 돼요.',
    line: '빈 자리를 누르면 ①, ② 순서로 담겨요. 같은 라인을 두 번 눌러도 돼요.'
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
      el.textContent = HINTS[kind];
    }
  }

  function refreshPickState() {
    [['art', '#artState', state.arts], ['line', '#lineState', state.lines]].forEach(([kind, sel, arr]) => {
      const el = $(sel);
      if (!el) return;
      const n = arr.filter(Boolean).length;
      el.textContent = `${n} / ${SLOTS}`;
      el.classList.toggle('is-full', n === SLOTS);
    });

    const parts = [];
    const names = kind => slotsOf(kind).filter(Boolean).map(iconName);
    const art = names('art');
    const line = names('line');
    if (art.length) parts.push(`그림 ${art.join(' · ')}`);
    if (line.length) parts.push(`라인 ${line.join(' · ')}`);
    $('#iconPicked').innerHTML = parts.length
      ? `고른 이미지 · <b>${parts.join(' / ')}</b>`
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
      !!state.arts[0],
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
      : n === 5 ? '다 골랐어요' : `다섯 중 ${n}가지 골랐어요`;

    const picked = [];
    if (mood) picked.push(mood.label);
    if (state.number.trim()) picked.push(state.number.trim());
    const artN = state.arts.filter(Boolean).length;
    const lineN = state.lines.filter(Boolean).length;
    if (artN) picked.push(`그림 ${artN}`);
    if (lineN) picked.push(`라인 ${lineN}`);
    dockSub.textContent = picked.length ? picked.join(' · ') : '여섯 가지만 고르면 돼요';
  }

  /* ---------- validation ---------- */
  function validate() {
    const problems = [];
    const set = (id, bad) => { $(id).hidden = !bad; if (bad) problems.push(id); };
    set('#errName', !state.name.trim());
    set('#errColor', !state.colorId);
    set('#errMood', !state.moodKey);
    set('#errIcon', !state.arts[0]);
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
    const dec = v => (DATA.enc && typeof v === 'string' ? b64utf8(v) : v);
    const label = id => stripBrackets(dec(ICONS.get(id).ans));
    const art = state.arts.filter(Boolean).map(label);
    const line = state.lines.filter(Boolean).map(label);
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

    const artNames = state.arts.filter(Boolean).map(iconName);
    const lineNames = state.lines.filter(Boolean).map(iconName);
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
    state.arts = [null, null];
    state.lines = [null, null];
    $$('#colorGrid .swatch').forEach(el => el.setAttribute('aria-checked', 'false'));
    $$('#moodGrid .point').forEach(el => el.setAttribute('aria-checked', 'false'));
    syncGrid('art');
    syncGrid('line');
    syncSlots('art');
    syncSlots('line');
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
    renderSlots();
    renderImageGrids();
    bindInputs();
    syncSlots('art');
    syncSlots('line');
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
    pick('art', 'i094');
    pick('art', demo === '2' ? 'i094' : 'i006');
    pick('line', 'i102');
    if (demo === '2') pick('line', 'i105');
    updateDock();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
