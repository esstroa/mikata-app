const L = typeof require !== 'undefined' ? require('./logic.js') : CycleLogic;
const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); };
eq(L.addDays('2026-10-31', 1), '2026-11-01');
eq(L.addDays('2026-03-01', -1), '2026-02-28');
eq(L.diffDays('2026-10-01', '2026-10-29'), 28);

const P = (start, active, placebo, rest) => ({ start, active, placebo, rest });
const a = { packs: [P('2026-10-01', 21, 7, 0)] };
eq(L.pillInfo(a, '2026-09-30'), null);
eq(L.pillInfo(a, '2026-10-01').idx, 1);
eq(L.pillInfo(a, '2026-10-21').kind, 'active');
eq(L.pillInfo(a, '2026-10-22').kind, 'placebo');   // 22日目から偽薬
eq(L.pillInfo(a, '2026-10-28').idx, 28);
eq(L.pillInfo(a, '2026-10-29').packStart, '2026-10-29'); // 同じ飲み方で自動的に続く
eq(L.pillInfo(a, '2026-12-24').packStart, '2026-12-24');

// 24錠タイプ
const b = { packs: [P('2026-10-01', 24, 4, 0)] };
eq([L.dayKind(b, '2026-10-24'), L.dayKind(b, '2026-10-25')], ['active', 'placebo']);

// 21錠＋休薬7：休薬日は rest
const c = { packs: [P('2026-10-01', 21, 0, 7)] };
eq([L.dayKind(c, '2026-10-21'), L.dayKind(c, '2026-10-22'), L.dayKind(c, '2026-10-28'), L.dayKind(c, '2026-10-29')], ['active', 'rest', 'rest', 'active']);

// ピルの種類が途中で変わった：変わった日から新しい飲み方、それ以前は変わらない
const d = { packs: [P('2026-10-01', 21, 7, 0), P('2026-12-02', 24, 4, 0)] };
eq(L.pillInfo(d, '2026-11-26').packStart, '2026-11-26');    // 2つ目の自動で続いたシート
eq(L.pillInfo(d, '2026-11-26').pack.active, 21);
eq(L.pillInfo(d, '2026-12-02'), { packStart: '2026-12-02', idx: 1, len: 28, kind: 'active', pack: P('2026-12-02', 24, 4, 0) });
eq(L.dayKind(d, '2026-12-25'), 'active');  // 24日目
eq(L.dayKind(d, '2026-12-26'), 'placebo');
eq(L.nextPackStart(d, '2026-11-30'), '2026-12-02');   // 28日前に次の種類が始まる

// 途中でシートの開始日を入れ直した（シートを短く打ち切って新しく始める）
const e = { packs: [P('2026-10-01', 21, 7, 0), P('2026-10-20', 21, 7, 0)] };
eq(L.pillInfo(e, '2026-10-19').idx, 19);
eq(L.pillInfo(e, '2026-10-20').idx, 1);
eq(L.nextPackStart(e, '2026-10-10'), '2026-10-20');

// 休薬期間エントリー → 再開
const f = { packs: [P('2026-10-01', 21, 7, 0), P('2026-10-29', 0, 0, 14), P('2026-11-12', 21, 7, 0)] };
eq(L.dayKind(f, '2026-11-05'), 'rest');
eq(L.dayKind(f, '2026-11-12'), 'active');

// 次のシート／残り錠数
eq(L.nextPackStart(a, '2026-10-19'), '2026-10-29');
eq(L.remaining(a, '2026-10-19'), 10);
eq(L.remaining(a, '2026-10-28'), 1);
eq(L.remaining(c, '2026-10-19'), 3);    // 21錠タイプ：残りは実薬19..21日目の3錠
eq(L.remaining(c, '2026-10-25'), 0);
// 長い連続服用（84＋7）
const g = { packs: [P('2026-10-01', 84, 7, 0)] };
eq(L.packLen(g.packs[0]), 91);
eq(L.dayKind(g, '2026-12-23'), 'active');  // 84日目
eq(L.dayKind(g, '2026-12-24'), 'placebo');
eq(L.describe(P('x', 21, 7, 0)), '実薬21＋偽薬7');
print('ok');
