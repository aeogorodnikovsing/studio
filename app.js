/* Студия: подписи для постов и титры для Reels в айдентике Александра Огородникова.
   Экспорт — точный рендер сцены в PNG через SVG foreignObject (тот же движок, что и на экране). */

'use strict';

const TITR_W = 1080, TITR_H = 1920;

/* форматы поста: 1:1 всегда первый */
const FORMATS = {
  '1:1':  [1080, 1080],
  '3:4':  [1080, 1440],
  '4:5':  [1080, 1350],
  '9:16': [1080, 1920],
};

const $ = (id) => document.getElementById(id);

const viewport = $('viewport');
const holders = { post: $('holder-post'), titry: $('holder-titry') };
const stages = { post: $('stage-post'), titry: $('stage-titry') };
const photoEl = $('photo');
const fileInput = $('file-input');

const state = {
  mode: 'post',
  format: '1:1',
  selected: null, // DOM-элемент слоя
  photo: null,    // {dataUrl, w, h, scale, minScale, tx, ty}
};

const postSize = () => FORMATS[state.format];

/* ────────────────── типы слоёв ────────────────── */

const SWIPE_ARROW =
  '<svg viewBox="0 0 76 44" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M4 10 C 30 42, 52 38, 70 16" stroke="#E8192C" stroke-width="5" stroke-linecap="round" fill="none"/>' +
  '<path d="M59 13 L 71 15 L 66 27" stroke="#E8192C" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '</svg>';

/* спец-слои с собственной версткой */
const SPECIAL = {
  marker:  { size: 32, text: 'ключевая фраза', cls: 'l-marker' },
  sticker: { size: 28, text: 'актуалочка',     cls: 'l-sticker', variants: [['', 'Красный'], ['white', 'Белый']] },
  swipe:   { size: 38, text: 'листай',         cls: 'l-swipe',   variants: [['', 'Тёмный'], ['light', 'Светлый']] },
  stack:   { size: 64, text: '', cls: 'l-stack', script: 'верни мой', bar: '2008 ГОД' },
};

/* пресеты универсального текстового слоя: шрифт/фон/цвет меняются в редакторе */
const PRESETS = {
  post: {
    headline: { font: 'golos800', bg: 'none',  color: 'white', size: 72, text: 'ЗАГОЛОВОК' },
    print:    { font: 'golos',    bg: 'none',  color: 'white', size: 44, text: 'Печатный текст' },
    script:   { font: 'marck',    bg: 'black', color: 'white', size: 34, text: 'рукописная строка' },
  },
  titry: {
    headline: { font: 'golos800', bg: 'none',  color: 'white', size: 88, text: 'ЗАГОЛОВОК ТИТРА' },
    print:    { font: 'golos',    bg: 'none',  color: 'white', size: 36, text: 'Основной текст' },
    script:   { font: 'marck',    bg: 'none',  color: 'white', size: 66, text: 'рукописная строка' },
  },
};

const FONT_OPTS = [['golos800', 'Жирный'], ['golos', 'Обычный'], ['marck', 'Рукопись']];
const BG_OPTS = [['none', 'Нет'], ['black', 'Чёрный'], ['white', 'Белый'], ['red', 'Красный']];
const COLOR_OPTS = [['white', 'Белый'], ['red', 'Красный'], ['black', 'Чёрный']];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* *слово* → красный акцент, переводы строк → <br> */
function richText(s) {
  return escapeHtml(s)
    .replace(/\*([^*\n]+)\*/g, '<span class="accent">$1</span>')
    .replace(/\n/g, '<br>');
}

function applyTextClasses(el) {
  const d = el.dataset;
  const keep = el.classList.contains('selected') ? ' selected' : '';
  el.className = 'layer l-text f-' + d.font + ' bg-' + d.bg + ' c-' + d.color +
    (d.bg !== 'none' ? ' has-bg' : '') + keep;
}

function renderLayerContent(el) {
  const d = el.dataset;
  const inner = el.querySelector('.inner');
  if (d.type === 'text') {
    applyTextClasses(el);
    inner.innerHTML = '<span class="strip">' + richText(d.text) + '</span>';
  } else if (d.type === 'stack') {
    inner.innerHTML =
      '<div class="script-line">' + escapeHtml(d.script || ' ') + '</div>' +
      '<div class="bar"><span class="fit">' + escapeHtml((d.bar || ' ').toUpperCase()) + '</span></div>';
    fitStack(el);
  } else if (d.type === 'swipe') {
    inner.innerHTML = '<span>' + richText(d.text) + '</span>' + SWIPE_ARROW;
  } else {
    inner.innerHTML = richText(d.text);
  }
}

/* Полоса: слово капсом растягивается на ширину рукописной строки (логика fit.js из скилла titry) */
function fitStack(el) {
  const script = el.querySelector('.script-line');
  const bar = el.querySelector('.bar');
  const fit = el.querySelector('.fit');
  if (!script || !bar || !fit) return;
  const inner = el.querySelector('.inner');
  inner.style.width = '';
  bar.style.fontSize = '';
  const width = script.offsetWidth;
  if (!width) return;
  inner.style.width = width + 'px';
  const cs = getComputedStyle(bar);
  const avail = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const cur = fit.offsetWidth;
  if (cur > 0 && avail > 0) {
    bar.style.fontSize = (parseFloat(cs.fontSize) * avail / cur) + 'px';
  }
}

function addLayer(kind) {
  const el = document.createElement('div');
  let size;
  if (SPECIAL[kind]) {
    const def = SPECIAL[kind];
    el.className = 'layer ' + def.cls;
    el.dataset.type = kind;
    el.dataset.text = def.text;
    if (kind === 'stack') { el.dataset.script = def.script; el.dataset.bar = def.bar; }
    size = def.size;
  } else {
    const p = PRESETS[state.mode][kind];
    el.dataset.type = 'text';
    el.dataset.text = p.text;
    el.dataset.font = p.font;
    el.dataset.bg = p.bg;
    el.dataset.color = p.color;
    size = p.size;
  }
  el.style.fontSize = size + 'px';
  el.innerHTML = '<div class="inner"></div>';

  const pos = defaultPos(kind);
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  stages[state.mode].appendChild(el);
  renderLayerContent(el);
  attachLayerEvents(el);

  if (state.mode === 'titry' && $('scrim-top').hidden && $('scrim-bottom').hidden) {
    setScrim('bottom', true); // первый титр — включаем нижнее затемнение
  }
  selectLayer(el);
  return el;
}

function defaultPos(kind) {
  if (state.mode === 'titry') {
    const tops = { headline: 1120, script: 1050, print: 1250, stack: 1100, marker: 1350, sticker: 990 };
    return { x: 80, y: tops[kind] || 1150 };
  }
  const [, H] = postSize();
  const k = H / 1080;
  const tops = { headline: 560, print: 660, script: 700, marker: 860, sticker: 80, swipe: 900 };
  const lefts = { sticker: 58, swipe: 640 };
  return { x: lefts[kind] || 58, y: Math.round((tops[kind] || 600) * k) };
}

/* ────────────────── выбор и редактор ────────────────── */

const editor = $('editor');
const editText = $('edit-text');
const editScript = $('edit-script');
const editBar = $('edit-bar');
const editSize = $('edit-size');
const variantsBox = $('variants');

function selectLayer(el) {
  if (state.selected) state.selected.classList.remove('selected');
  state.selected = el;
  if (!el) { editor.hidden = true; return; }
  el.classList.add('selected');
  const isStack = el.dataset.type === 'stack';
  $('row-text').hidden = isStack;
  $('row-stack').hidden = !isStack;
  if (isStack) {
    editScript.value = el.dataset.script || '';
    editBar.value = el.dataset.bar || '';
  } else {
    editText.value = el.dataset.text || '';
  }
  editSize.value = parseInt(el.style.fontSize, 10);
  buildVariants(el);
  editor.hidden = false;
}

function optionGroup(el, label, opts, key) {
  const wrap = document.createElement('div');
  wrap.className = 'vgroup';
  const lab = document.createElement('span');
  lab.className = 'vlabel';
  lab.textContent = label;
  wrap.appendChild(lab);
  opts.forEach(([val, name]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    if (el.dataset[key] === val) b.classList.add('on');
    b.addEventListener('click', () => {
      el.dataset[key] = val;
      renderLayerContent(el);
      buildVariants(el);
    });
    wrap.appendChild(b);
  });
  return wrap;
}

function buildVariants(el) {
  variantsBox.innerHTML = '';
  if (el.dataset.type === 'text') {
    variantsBox.appendChild(optionGroup(el, 'Шрифт', FONT_OPTS, 'font'));
    variantsBox.appendChild(optionGroup(el, 'Фон', BG_OPTS, 'bg'));
    variantsBox.appendChild(optionGroup(el, 'Цвет', COLOR_OPTS, 'color'));
    return;
  }
  const def = SPECIAL[el.dataset.type];
  if (!def || !def.variants) return;
  const wrap = document.createElement('div');
  wrap.className = 'vgroup';
  def.variants.forEach(([cls, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    const isOn = cls ? el.classList.contains(cls) : !def.variants.some(([c]) => c && el.classList.contains(c));
    if (isOn) b.classList.add('on');
    b.addEventListener('click', () => {
      def.variants.forEach(([c]) => { if (c) el.classList.remove(c); });
      if (cls) el.classList.add(cls);
      buildVariants(el);
    });
    wrap.appendChild(b);
  });
  variantsBox.appendChild(wrap);
}

editText.addEventListener('input', () => {
  if (!state.selected) return;
  state.selected.dataset.text = editText.value;
  renderLayerContent(state.selected);
});
editScript.addEventListener('input', () => {
  if (!state.selected) return;
  state.selected.dataset.script = editScript.value;
  renderLayerContent(state.selected);
});
editBar.addEventListener('input', () => {
  if (!state.selected) return;
  state.selected.dataset.bar = editBar.value;
  renderLayerContent(state.selected);
});
editSize.addEventListener('input', () => {
  if (!state.selected) return;
  state.selected.style.fontSize = editSize.value + 'px';
  if (state.selected.dataset.type === 'stack') fitStack(state.selected);
});
$('btn-del').addEventListener('click', () => {
  if (!state.selected) return;
  state.selected.remove();
  selectLayer(null);
});
$('btn-done').addEventListener('click', () => selectLayer(null));

/* ────────────────── перетаскивание слоёв ────────────────── */

function attachLayerEvents(el) {
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    selectLayer(el);
    const startX = e.clientX, startY = e.clientY;
    const baseL = parseFloat(el.style.left), baseT = parseFloat(el.style.top);
    const s = currentScale();
    const move = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      // палец реально тащит — прячем панель редактора, чтобы видеть весь холст
      if (Math.hypot(dx, dy) > 8) document.body.classList.add('dragging');
      el.style.left = (baseL + dx / s) + 'px';
      el.style.top = (baseT + dy / s) + 'px';
    };
    const up = () => {
      document.body.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

/* ────────────────── фото: загрузка, пан, пинч ────────────────── */

const MAX_PHOTO_SIDE = 2400;

$('toolbar-post').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.act === 'photo') fileInput.click();
  else if (btn.dataset.act === 'file') $('file-input-any').click(); // проводник: виден Telegram и любые папки
  else if (btn.dataset.add) addLayer(btn.dataset.add);
});
$('toolbar-titry').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || !btn.dataset.add) return;
  addLayer(btn.dataset.add);
});
$('toolbar-formats').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn && btn.dataset.fmt) setFormat(btn.dataset.fmt);
});

function setFormat(fmt) {
  state.format = fmt;
  document.querySelectorAll('#toolbar-formats [data-fmt]').forEach((b) =>
    b.classList.toggle('on', b.dataset.fmt === fmt));
  const [W, H] = postSize();
  stages.post.style.width = W + 'px';
  stages.post.style.height = H + 'px';
  if (state.photo) {
    const p = state.photo;
    p.minScale = Math.max(W / p.w, H / p.h);
    applyPhoto();
  }
  layout();
}

function handlePickedFile(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => loadPhoto(String(reader.result));
  reader.readAsDataURL(f);
  input.value = '';
}
fileInput.addEventListener('change', () => handlePickedFile(fileInput));
$('file-input-any').addEventListener('change', () => handlePickedFile($('file-input-any')));

function loadPhoto(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.width, img.height));
    const cnv = document.createElement('canvas');
    cnv.width = Math.round(img.width * k);
    cnv.height = Math.round(img.height * k);
    cnv.getContext('2d').drawImage(img, 0, 0, cnv.width, cnv.height);
    const url = cnv.toDataURL('image/jpeg', 0.92);
    const [W, H] = postSize();
    const minScale = Math.max(W / cnv.width, H / cnv.height);
    state.photo = {
      dataUrl: url, w: cnv.width, h: cnv.height,
      scale: minScale, minScale,
      tx: (W - cnv.width * minScale) / 2,
      ty: (H - cnv.height * minScale) / 2,
    };
    photoEl.src = url;
    photoEl.hidden = false;
    $('post-hint').hidden = true;
    applyPhoto();
  };
  img.src = dataUrl;
}

function applyPhoto() {
  const p = state.photo;
  if (!p) return;
  const [W, H] = postSize();
  p.scale = Math.max(p.scale, p.minScale);
  p.tx = Math.min(0, Math.max(W - p.w * p.scale, p.tx));
  p.ty = Math.min(0, Math.max(H - p.h * p.scale, p.ty));
  photoEl.style.left = '0px';
  photoEl.style.top = '0px';
  photoEl.style.width = p.w + 'px';
  photoEl.style.transform = `translate(${p.tx}px, ${p.ty}px) scale(${p.scale})`;
}

/* пан одним пальцем + пинч двумя — только по фону поста */
const touches = new Map();
stages.post.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.layer')) return;
  selectLayer(null);
  if (!state.photo) return;
  e.preventDefault();
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stages.post.setPointerCapture(e.pointerId);
});
stages.post.addEventListener('pointermove', (e) => {
  if (!touches.has(e.pointerId) || !state.photo) return;
  const p = state.photo;
  const s = currentScale();
  const prev = touches.get(e.pointerId);
  if (touches.size === 1) {
    p.tx += (e.clientX - prev.x) / s;
    p.ty += (e.clientY - prev.y) / s;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    applyPhoto();
  } else if (touches.size === 2) {
    const pts = [...touches.entries()];
    const other = pts.find(([id]) => id !== e.pointerId)[1];
    const dPrev = Math.hypot(prev.x - other.x, prev.y - other.y);
    const dNow = Math.hypot(e.clientX - other.x, e.clientY - other.y);
    if (dPrev > 0) {
      const k = dNow / dPrev;
      const midX = ((e.clientX + other.x) / 2), midY = ((e.clientY + other.y) / 2);
      const r = stages.post.getBoundingClientRect();
      const cx = (midX - r.left) / s, cy = (midY - r.top) / s;
      p.tx = cx - (cx - p.tx) * k;
      p.ty = cy - (cy - p.ty) * k;
      p.scale *= k;
      applyPhoto();
    }
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
});
const endTouch = (e) => touches.delete(e.pointerId);
stages.post.addEventListener('pointerup', endTouch);
stages.post.addEventListener('pointercancel', endTouch);
stages.titry.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.layer')) selectLayer(null);
});

/* ────────────────── титры: затемнения и зоны ────────────────── */

function setScrim(which, on) {
  $('scrim-' + which).hidden = !on;
  $('tgl-scrim-' + which).classList.toggle('on', on);
}
$('tgl-scrim-top').addEventListener('click', () =>
  setScrim('top', $('scrim-top').hidden));
$('tgl-scrim-bottom').addEventListener('click', () =>
  setScrim('bottom', $('scrim-bottom').hidden));
$('tgl-guides').addEventListener('click', () => {
  const g = $('guides');
  g.hidden = !g.hidden;
  $('tgl-guides').classList.toggle('on', !g.hidden);
});

/* ────────────────── режимы и масштаб сцены ────────────────── */

$('tab-post').addEventListener('click', () => setMode('post'));
$('tab-titry').addEventListener('click', () => setMode('titry'));

function setMode(mode) {
  state.mode = mode;
  selectLayer(null);
  $('tab-post').classList.toggle('active', mode === 'post');
  $('tab-titry').classList.toggle('active', mode === 'titry');
  holders.post.hidden = mode !== 'post';
  holders.titry.hidden = mode !== 'titry';
  $('toolbar-post').hidden = mode !== 'post';
  $('toolbar-formats').hidden = mode !== 'post';
  $('toolbar-titry').hidden = mode !== 'titry';
  layout();
}

let scales = { post: 1, titry: 1 };
const currentScale = () => scales[state.mode];

function layout() {
  const pad = 14;
  const vw = viewport.clientWidth - pad * 2;
  const vh = viewport.clientHeight - pad * 2;
  const [PW, PH] = postSize();
  [['post', PW, PH], ['titry', TITR_W, TITR_H]].forEach(([m, w, h]) => {
    const s = Math.min(vw / w, vh / h);
    scales[m] = s;
    const holder = holders[m];
    holder.style.width = w + 'px';
    holder.style.height = h + 'px';
    const x = (viewport.clientWidth - w * s) / 2;
    const y = (viewport.clientHeight - h * s) / 2;
    holder.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  });
}
window.addEventListener('resize', layout);

/* ────────────────── экспорт PNG ────────────────── */

let fontCssCache = null;

async function fontFaceCss() {
  if (fontCssCache) return fontCssCache;
  if (window.__FONT_B64) { // однофайловая сборка: шрифты уже зашиты внутрь
    fontCssCache =
      `@font-face{font-family:'Golos Text';src:url(${window.__FONT_B64.golos}) format('truetype');font-weight:400 900;}` +
      `@font-face{font-family:'Marck Script';src:url(${window.__FONT_B64.marck}) format('truetype');font-weight:400;}`;
    return fontCssCache;
  }
  const b64 = async (path) => {
    const blob = await (await fetch(path)).blob();
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  };
  const [golos, marck] = await Promise.all([b64('golos.ttf'), b64('marck.ttf')]);
  fontCssCache =
    `@font-face{font-family:'Golos Text';src:url(${golos}) format('truetype');font-weight:400 900;}` +
    `@font-face{font-family:'Marck Script';src:url(${marck}) format('truetype');font-weight:400;}`;
  return fontCssCache;
}

async function exportPng() {
  const isPost = state.mode === 'post';
  const [W, H] = isPost ? postSize() : [TITR_W, TITR_H];
  const stage = stages[state.mode];

  selectLayer(null);
  const clone = stage.cloneNode(true);
  clone.querySelectorAll('.noexport').forEach((n) => n.remove());
  clone.querySelectorAll('[hidden]').forEach((n) => n.remove());
  clone.style.width = W + 'px';
  clone.style.height = H + 'px';

  const css = (await fontFaceCss()) + document.getElementById('stage-css').textContent;
  const html = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px">` +
    `<style>${css}</style>${html}</div></foreignObject></svg>`;

  // Важно: именно data:-URL. SVG из blob:-URL с foreignObject «пачкает» canvas,
  // и toBlob падает с SecurityError.
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  await new Promise((r) => setTimeout(r, 120)); // дать шрифтам внутри SVG примениться
  const cnv = document.createElement('canvas');
  cnv.width = W;
  cnv.height = H;
  cnv.getContext('2d').drawImage(img, 0, 0, W, H);
  const blob = await new Promise((res) => cnv.toBlob(res, 'image/png'));
  if (!blob) throw new Error('toBlob failed');
  return { blob, dataUrl: cnv.toDataURL('image/png'), isPost };
}

function exportName(isPost) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return (isPost ? 'post-' : 'titr-') + stamp + '.png'; // имена — только латиницей
}

let lastExport = null;

$('btn-export').addEventListener('click', async () => {
  const btn = $('btn-export');
  btn.disabled = true;
  btn.textContent = '…';
  try {
    lastExport = await exportPng();
    $('modal-img').src = lastExport.dataUrl;
    const a = $('btn-download');
    a.href = URL.createObjectURL(lastExport.blob);
    a.download = exportName(lastExport.isPost);
    $('btn-share').hidden = !(navigator.canShare &&
      navigator.canShare({ files: [new File([lastExport.blob], 'x.png', { type: 'image/png' })] }));
    $('modal').hidden = false;
  } catch (err) {
    alert('Не получилось собрать PNG: ' + (err && err.message ? err.message : err));
  } finally {
    btn.disabled = false;
    btn.textContent = 'PNG';
  }
});

$('btn-share').addEventListener('click', async () => {
  if (!lastExport) return;
  const file = new File([lastExport.blob], exportName(lastExport.isPost), { type: 'image/png' });
  try {
    await navigator.share({ files: [file] });
  } catch (err) { /* пользователь закрыл шторку — это не ошибка */ }
});
$('btn-close').addEventListener('click', () => { $('modal').hidden = true; });

/* ────────────────── старт ────────────────── */

stages.titry.style.width = TITR_W + 'px';
stages.titry.style.height = TITR_H + 'px';

document.fonts.ready.then(() => {
  document.querySelectorAll('.l-stack').forEach(fitStack);
});
setFormat('1:1');
setMode('post');

/* фото, присланное через «Поделиться» из другого приложения */
if ('caches' in window && new URLSearchParams(location.search).has('shared')) {
  (async () => {
    try {
      const inbox = await caches.open('share-inbox');
      const resp = await inbox.match('shared-photo');
      if (resp) {
        const blob = await resp.blob();
        await inbox.delete('shared-photo');
        const reader = new FileReader();
        reader.onload = () => { setMode('post'); loadPhoto(String(reader.result)); };
        reader.readAsDataURL(blob);
      }
    } catch (err) { /* нет фото — обычный запуск */ }
    history.replaceState(null, '', location.pathname);
  })();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // при выходе обновления страница перезапускается — но НИКОГДА посреди работы:
  // если на холсте есть фото или слои, обновление подхватится при следующем запуске
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const hasWork = !!state.photo || document.querySelectorAll('.layer').length > 0;
    if (hadController && !hasWork) location.reload();
    hadController = true;
  });
}

/* хуки для автотестов */
window.__test = {
  addLayer,
  setMode,
  setFormat,
  loadPhoto,
  exportPng,
  renderLayerContent,
  selectLayer,
  state,
};
