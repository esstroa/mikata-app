// 日付は "YYYY-MM-DD" 文字列で扱い、計算は正午のローカル時刻で行う（夏時間などのずれ防止）
(function (root) {
  const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const addDays = (s, n) => { const dt = toDate(s); dt.setDate(dt.getDate() + n); return fmt(dt); };
  const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

  // ピルの種類（飲み方）は、シートごとに持つ。
  //   pack = { start: 'YYYY-MM-DD', active: 実薬の日数, placebo: 偽薬の日数, rest: 休薬の日数 }
  // 1シートの長さ = active + placebo + rest。種類が変わったら、変わった日を開始日として新しいシートを追加する。
  const PRESETS = [
    { key: '21+7p', label: '28錠タイプ（実薬21＋偽薬7）', active: 21, placebo: 7, rest: 0 },
    { key: '24+4p', label: '28錠タイプ（実薬24＋偽薬4）', active: 24, placebo: 4, rest: 0 },
    { key: '21+7r', label: '21錠タイプ（実薬21＋休薬7）', active: 21, placebo: 0, rest: 7 },
    { key: '28+0', label: '休薬なしで連続服用（28日ごとに区切る）', active: 28, placebo: 0, rest: 0 },
    { key: 'rest', label: '休薬期間（飲まない期間）', active: 0, placebo: 0, rest: 14 },
  ];

  const packLen = (p) => p.active + p.placebo + p.rest;
  const sortedPacks = (settings) => (settings.packs || []).slice().sort((a, b) => a.start.localeCompare(b.start));

  // その日が、どのシートの何日目か。開始日はいつでも自由に入れ直せる（過去も可）。
  // 最後に登録したシートは、同じ飲み方のまま続く。次のシートの開始日が来たら、その日から切り替わる。
  function pillInfo(settings, date) {
    const list = sortedPacks(settings);
    let p = null;
    list.forEach((x) => { if (x.start <= date) p = x; });
    if (!p) return null;
    const len = packLen(p);
    if (len < 1) return null;
    const d = diffDays(p.start, date);
    const k = Math.floor(d / len), di = d % len;
    const kind = di + 1 <= p.active ? 'active' : di + 1 <= p.active + p.placebo ? 'placebo' : 'rest';
    return { packStart: addDays(p.start, len * k), idx: di + 1, len, kind, pack: p };
  }

  const packDates = (packStart, len) => Array.from({ length: len }, (_, i) => addDays(packStart, i));

  // 次のシートの開始日。今のシートが終わる日と、次に登録された開始日の早いほう。
  function nextPackStart(settings, date) {
    const info = pillInfo(settings, date);
    if (!info) return null;
    const ends = addDays(info.packStart, info.len);
    const explicit = sortedPacks(settings).find((p) => p.start > date);
    return explicit && explicit.start < ends ? explicit.start : ends;
  }

  // 今日を含め、今のシートで飲む錠剤（実薬・偽薬）が残っている数
  function remaining(settings, date) {
    const end = nextPackStart(settings, date);
    if (!end) return null;
    let n = 0;
    for (let d = date; d < end; d = addDays(d, 1)) if (pillInfo(settings, d).kind !== 'rest') n++;
    return n;
  }

  const dayKind = (settings, date) => { const i = pillInfo(settings, date); return i ? i.kind : 'none'; };
  const describe = (p) => `実薬${p.active}${p.placebo ? '＋偽薬' + p.placebo : ''}${p.rest ? '＋休薬' + p.rest : ''}`;

  const api = { toDate, fmt, addDays, diffDays, PRESETS, packLen, sortedPacks, pillInfo, packDates, nextPackStart, remaining, dayKind, describe };
  if (typeof module !== 'undefined') module.exports = api; else root.CycleLogic = api;
})(this);
