(function () {
  const L = CycleLogic;
  const KEY = 'kiroku-v2';
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  // スタンプの画像は stamps/<番号>.webp（全画面用）と stamps/<番号>-s.webp（カレンダー用の小さい版）。増やしたらここに番号を足す
  const STAMPS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const KIND = { active: '実薬', placebo: '偽薬', rest: '休薬日' };
  const $ = (id) => document.getElementById(id);
  const todayStr = () => L.fmt(new Date());
  const md = (s) => { const [, m, d] = s.split('-'); return `${Number(m)}/${Number(d)}`; };
  const hm = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => { if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v); });
    kids.flat().forEach((c) => el.append(c));
    return el;
  }

  const defaults = () => ({
    days: {},
    settings: { packs: [], alarmTime: '21:00', alarm2: false, doctor: { name: '', phone: '', nextVisit: '' } },
  });

  const num = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 365 ? n : 0; };
  // packs を検証して取り込む。前のバージョン（packStarts と activeDays）の形式も読める。
  function cleanPacks(s) {
    const out = [];
    if (Array.isArray(s.packs)) {
      s.packs.forEach((p) => {
        if (p && DATE_RE.test(p.start)) {
          const q = { start: p.start, active: num(p.active), placebo: num(p.placebo), rest: num(p.rest) };
          if (L.packLen(q) >= 1) out.push(q);
        }
      });
    } else if (Array.isArray(s.packStarts)) {
      const a = num(s.activeDays) || 21;
      s.packStarts.filter((x) => DATE_RE.test(x)).forEach((start) => out.push({ start, active: a, placebo: 28 - a, rest: 0 }));
    }
    return out;
  }

  let state = load();
  let calMonth = todayStr().slice(0, 7);
  let sheetStart = null;

  function load() {
    const d = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return d;
      const s = JSON.parse(raw);
      d.days = s.days && typeof s.days === 'object' ? s.days : {};
      const st = s.settings || {};
      d.settings.packs = cleanPacks(st);
      if (/^\d{2}:\d{2}$/.test(st.alarmTime)) d.settings.alarmTime = st.alarmTime;
      d.settings.alarm2 = !!st.alarm2;
      Object.assign(d.settings.doctor, st.doctor || {});
      return d;
    } catch (e) { return d; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { alert('この端末に保存できませんでした。プライベートブラウズでないか確認してください。'); }
  }

  const day = (date) => state.days[date] || {};
  function setDay(date, patch) {
    const next = Object.assign({}, day(date), patch);
    ['taken', 'period', 'note', 't', 'stamp'].forEach((k) => { if (!next[k]) delete next[k]; });
    if (Object.keys(next).length) state.days[date] = next; else delete state.days[date];
  }
  const stampOf = (date) => { const s = day(date).stamp; return STAMPS.includes(s) ? s : ''; };
  // その日のスタンプ。まだ決まっていなければランダムに選ぶ（取り消して押し直しても同じ）
  const pickStamp = (date) => stampOf(date) || STAMPS[Math.floor(Math.random() * STAMPS.length)];
  function toggleTaken(date) {
    const was = !!day(date).taken;
    const stamp = pickStamp(date);
    if (was) setDay(date, { taken: false, t: '' });
    else setDay(date, { taken: true, t: date === todayStr() ? hm() : '', stamp });
    save(); render();
    if (!was) showStamp(stamp);
  }

  // 「飲んだ」を記録したとき、画面いっぱいにスタンプを出す
  function showStamp(id) {
    const old = document.querySelector('.stamp');
    if (old) old.remove();
    const el = h('div', { class: 'stamp', 'aria-hidden': 'true' }, h('img', { src: `stamps/${id}.webp`, alt: '' }));
    document.body.append(el);
    setTimeout(() => el.remove(), 1500);
  }

  // ---- 今日 ----
  function renderToday() {
    const el = $('today');
    el.replaceChildren();
    const t = todayStr(), S = state.settings;
    const info = L.pillInfo(S, t);
    if (!info) {
      el.append(h('p', { class: 'status' }, '下の「ピルの設定」で、開始日を入れてください。'));
      return;
    }
    const d = day(t);
    el.append(
      h('p', { class: 'status' }, `今日 ${md(t)}（${WEEK[L.toDate(t).getDay()]}）`),
      h('p', { class: 'pillbig' }, `${info.idx}日目（${KIND[info.kind]}）`),
    );
    if (info.kind === 'rest') {
      el.append(h('p', { class: 'status' }, '今日は飲まない日です'));
    } else {
      el.append(
        h('p', { class: 'status' }, d.taken ? `飲みました${d.t ? '（' + d.t + '）' : ''}` : 'まだ記録がありません'),
        h('div', { class: 'row' }, h('button', { class: d.taken ? '' : 'primary', onclick: () => toggleTaken(t) }, d.taken ? '取り消す' : '飲んだ')),
      );
    }
    const left = L.remaining(S, t), next = L.nextPackStart(S, t);
    el.append(h('p', { class: 'status' }, `このシートはあと${left}錠。次のシートは ${md(next)} から`));

    const y = L.addDays(t, -1), yi = L.pillInfo(S, y);
    if (yi && yi.kind !== 'rest' && !day(y).taken) {
      el.append(h('div', { class: 'banner' }, `昨日（${md(y)}）の記録がありません。飲んでいたら、記録できます。`,
        h('br'), h('button', { onclick: () => toggleTaken(y) }, '昨日を「飲んだ」にする')));
    }
    if (L.diffDays(t, next) <= 7) {
      const v = S.doctor.nextVisit;
      el.append(h('div', { class: 'banner' }, `もうすぐ次のシートです。${v && v >= t ? '次回の受診予定は ' + md(v) + ' です。' : '受診予定が未登録です。'}`));
    }
  }

  // ---- 錠剤シート ----
  function currentSheetStart() {
    const info = L.pillInfo(state.settings, todayStr());
    if (info) return info.packStart;
    const first = L.sortedPacks(state.settings)[0];
    return first ? first.start : null;
  }
  function renderSheet() {
    const S = state.settings, grid = $('sheet'), t = todayStr();
    grid.replaceChildren();
    if (!sheetStart) sheetStart = currentSheetStart();
    const head = sheetStart && L.pillInfo(S, sheetStart);
    if (!head) { $('sheetLabel').textContent = '錠剤シート'; return; }
    $('sheetLabel').textContent = `${md(sheetStart)} 開始のシート`;
    L.packDates(sheetStart, head.len).forEach((date, i) => {
      const info = L.pillInfo(S, date);
      const own = info && info.packStart === sheetStart;
      const cls = ['pill'];
      if (own && info.kind === 'placebo') cls.push('placebo');
      if (own && info.kind === 'rest') cls.push('rest');
      if (own && day(date).taken) cls.push('done');
      if (!own) cls.push('other');
      if (date === t) cls.push('today');
      const b = h('button', { class: cls.join(' '), 'aria-label': `${md(date)} ${i + 1}日目` }, String(i + 1), h('small', {}, md(date)));
      if (!own || info.kind === 'rest' || date > t) b.disabled = true;
      else b.addEventListener('click', () => toggleTaken(date));
      grid.append(b);
    });
  }
  function sheetNav(dir) {
    if (!sheetStart) return;
    const S = state.settings;
    if (dir < 0) {
      const prev = L.pillInfo(S, L.addDays(sheetStart, -1));
      if (prev) { sheetStart = prev.packStart; renderSheet(); }
    } else {
      const next = L.nextPackStart(S, sheetStart);
      if (next && next <= todayStr()) { sheetStart = next; renderSheet(); }
    }
  }

  // ---- カレンダー ----
  function renderCalendar() {
    const [y, m] = calMonth.split('-').map(Number);
    $('monthLabel').textContent = `${y}年${m}月`;
    const cal = $('cal'), t = todayStr();
    cal.replaceChildren();
    WEEK.forEach((w) => cal.append(h('div', { class: 'dow' }, w)));
    const first = new Date(y, m - 1, 1, 12);
    for (let i = 0; i < first.getDay(); i++) cal.append(h('div'));
    for (let d = 1, n = new Date(y, m, 0).getDate(); d <= n; d++) {
      const date = `${calMonth}-${String(d).padStart(2, '0')}`;
      const rec = day(date), kind = L.dayKind(state.settings, date);
      const cls = ['day'];
      if (date === t) cls.push('today');
      const icons = h('span', { class: 'icons' },
        kind === 'placebo' || kind === 'rest' ? h('span', { class: 'ic rest', 'aria-label': '休薬' }) : '',
        rec.taken ? h('span', { class: 'ic taken', 'aria-label': '服用した' }, h('img', { src: stampOf(date) ? `stamps/${stampOf(date)}-s.webp` : 'taken.png', alt: '' })) : '',
        '');
      const top = h('span', { class: 'top' }, h('span', { class: 'num' }, String(d)), rec.period ? h('span', { class: 'ic period', 'aria-label': '生理' }) : '');
      cal.append(h('button', { class: cls.join(' '), onclick: () => openDay(date) }, top, icons));
    }
  }
  function shiftMonth(n) {
    const [y, m] = calMonth.split('-').map(Number);
    calMonth = L.fmt(new Date(y, m - 1 + n, 1, 12)).slice(0, 7);
    renderCalendar();
  }

  // ---- 日ごとの編集 ----
  let editing = null;
  function openDay(date) {
    editing = date;
    const rec = day(date), info = L.pillInfo(state.settings, date);
    $('dayTitle').textContent = `${md(date)}（${WEEK[L.toDate(date).getDay()]}）`;
    $('dayPill').textContent = info ? `${info.idx}日目（${KIND[info.kind]}）` : 'ピルの設定の開始日より前です';
    $('dayTaken').checked = !!rec.taken;
    $('dayTaken').disabled = date > todayStr() || (info && info.kind === 'rest');
    $('dayPeriod').checked = !!rec.period;
    $('dayDlg').showModal();
  }
  $('dayDlg').addEventListener('close', () => {
    if ($('dayDlg').returnValue !== 'ok' || !editing) return;
    const was = !!day(editing).taken, now = $('dayTaken').checked;
    const stamp = now ? pickStamp(editing) : stampOf(editing);
    setDay(editing, {
      stamp,
      taken: now, t: now ? (was ? day(editing).t : (editing === todayStr() ? hm() : '')) : '',
      period: $('dayPeriod').checked,
    });
    save(); render();
    if (now && !was) showStamp(stamp);
  });

  // ---- 受診 ----
  function renderVisit() {
    const D = state.settings.doctor;
    $('nextVisit').value = D.nextVisit; $('docName').value = D.name; $('docPhone').value = D.phone;
  }
  ['nextVisit:nextVisit', 'docName:name', 'docPhone:phone'].forEach((pair) => {
    const [id, key] = pair.split(':');
    $(id).addEventListener('change', (e) => { state.settings.doctor[key] = e.target.value.trim(); save(); renderToday(); });
  });

  // ---- ピルの設定 ----
  function fillPreset(p) { $('nActive').value = p.active; $('nPlacebo').value = p.placebo; $('nRest').value = p.rest; }
  function renderSettings() {
    const S = state.settings, sel = $('preset');
    if (!sel.options.length) {
      L.PRESETS.forEach((p) => sel.append(h('option', { value: p.key }, p.label)));
      sel.append(h('option', { value: 'custom' }, '自由に入力する'));
      fillPreset(L.PRESETS[0]);
    }
    const ul = $('starts');
    ul.replaceChildren();
    L.sortedPacks(S).reverse().forEach((p) => {
      ul.append(h('li', {}, h('span', {}, `${p.start} 〜 ${L.describe(p)}`), h('button', {
        onclick: () => {
          if (!confirm(`${p.start} の開始日を削除しますか？（飲んだ記録は消えません）`)) return;
          S.packs = S.packs.filter((x) => x !== p); sheetStart = null; save(); render();
        },
      }, '削除')));
    });
    if (!S.packs.length) ul.append(h('li', { class: 'empty' }, 'まだ登録がありません'));
  }
  $('preset').addEventListener('change', (e) => {
    const p = L.PRESETS.find((x) => x.key === e.target.value);
    if (p) fillPreset(p);
  });
  ['nActive', 'nPlacebo', 'nRest'].forEach((id) => $(id).addEventListener('input', () => { $('preset').value = 'custom'; }));
  $('btnAddStart').addEventListener('click', () => {
    const start = $('packStart').value;
    if (!start) return alert('開始日を選んでください。');
    const p = { start, active: num($('nActive').value), placebo: num($('nPlacebo').value), rest: num($('nRest').value) };
    if (L.packLen(p) < 1) return alert('日数を1以上にしてください。');
    const S = state.settings;
    S.packs = S.packs.filter((x) => x.start !== start).concat(p);
    sheetStart = null; save(); render();
  });
  function download(name, type, text) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---- 書き出し・読み込み ----
  $('btnExport').addEventListener('click', () => download(`kiroku-${todayStr()}.json`, 'application/json', JSON.stringify(state, null, 2)));
  $('importFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    f.text().then((txt) => {
      const s = JSON.parse(txt);
      if (!s || typeof s.days !== 'object' || !s.settings) throw new Error('形式が違います');
      const d = defaults();
      Object.keys(s.days).forEach((k) => { if (DATE_RE.test(k) && s.days[k] && typeof s.days[k] === 'object') d.days[k] = s.days[k]; });
      d.settings.packs = cleanPacks(s.settings);
      if (/^\d{2}:\d{2}$/.test(s.settings.alarmTime)) d.settings.alarmTime = s.settings.alarmTime;
      d.settings.alarm2 = !!s.settings.alarm2;
      Object.assign(d.settings.doctor, s.settings.doctor || {});
      if (!confirm('今のデータを、読み込んだデータで置き換えますか？')) return;
      state = d; sheetStart = null; save(); render();
    }).catch(() => alert('読み込めませんでした。このアプリで書き出したファイルを選んでください。'));
  });

  $('prev').addEventListener('click', () => shiftMonth(-1));
  $('next').addEventListener('click', () => shiftMonth(1));
  $('sheetPrev').addEventListener('click', () => sheetNav(-1));
  $('sheetNext').addEventListener('click', () => sheetNav(1));

  function render() { renderToday(); renderSheet(); renderCalendar(); renderVisit(); renderSettings(); }

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
