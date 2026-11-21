// Headless check of the practice exercises and grading: every chalk guide fits on the fabric and can be
// placed under the needle without hitting the machine arm, a seam sewn on the line grades Excellent, and an
// off-line or unfinished seam does not. Also checks the needle chart, the tension rule and inch formatting.
import { TAU, WIN, NEEDLE_X, FABRIC_W as W, FABRIC_D as D, SEAM, EXERCISES, FABRICS, NEEDLES, stitchSpec, cycleEvents,
  guideNear, scoreGuide, gradeOf, tensionState, needleMatch, fmtIn } from '../js/data.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL', msg); } };
const PILLAR_X = 0.036; // the machine's pillar starts here, in machine coordinates

// 1. Guides fit on the piece, and the starting placement clears the pillar
for (const [key, ex] of Object.entries(EXERCISES)) {
  if (!ex.path) continue;
  const g = ex.path(W, D);
  for (const [x, z] of g) check(Math.abs(x) <= W / 2 - 0.002 && Math.abs(z) <= D / 2 - 0.005, `${key}: guide point (${x.toFixed(3)}, ${z.toFixed(3)}) is on the fabric`);
  const rightEdgeX = NEEDLE_X + (W / 2 - g[0][0]);
  check(rightEdgeX < PILLAR_X, `${key}: fabric placed at the start clears the machine arm (${rightEdgeX.toFixed(3)})`);
  check(guideNear(g, ...g[0])[0] < 1e-12, `${key}: needle starts on the line`);
}
check(Math.abs((W / 2 - EXERCISES.straight.path(W, D)[0][0]) * 1000 - 15.9) < 0.05, 'straight seam is 5/8 in (15.9 mm) from the edge');
check(fmtIn(SEAM * 1000) === '5/8 in', 'SEAM is 5/8 in');

// 2. Sewing a straight seam with the real cycle: medium stitch, needle on the line the whole way
{
  const g = EXERCISES.straight.path(W, D), pts = []; let idx = 0, spec = stitchSpec(4, 0), z = g[0][1], t = 0;
  while (z < g[1][1]) {
    for (const s of cycleEvents(t, t + 0.5)) { z += spec.feed / 1000 * s.m / (2 * WIN); if (s.ev === 'in') pts.push([g[0][0], z]); if (s.ev === 'out') spec = stitchSpec(4, ++idx); }
    t += 0.5;
  }
  const sc = scoreGuide(g, pts);
  check(sc.coverage > 0.97 && sc.avgMm < 0.01 && sc.within2 === 1, `perfect straight seam scores full marks (${JSON.stringify(sc)})`);
  check(gradeOf(sc) === 'Excellent', 'perfect straight seam is Excellent');
  check(pts.length > 100 && pts.length < 120, `a 27 cm seam at 2.5 mm per stitch is about 108 stitches (${pts.length})`);
}

// 3. Every guide sewn exactly gets Excellent; 2.5 mm off is Good; 4 mm off or half finished is not
for (const [key, ex] of Object.entries(EXERCISES)) {
  if (!ex.path) continue;
  const g = ex.path(W, D), L = guideNear(g, 0, 0)[2], along = [];
  for (let i = 1; i < g.length; i++) { const [a, b] = [g[i - 1], g[i]], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s < l; s += 0.0025) along.push([a[0] + (b[0] - a[0]) * s / l, a[1] + (b[1] - a[1]) * s / l, (b[1] - a[1]) / l, -(b[0] - a[0]) / l]); }
  along.push([...g[g.length - 1], along[along.length - 1][2], along[along.length - 1][3]]);
  const off = mm => along.map(([x, z, nx, nz]) => [x + nx * mm / 1000, z + nz * mm / 1000]);
  check(gradeOf(scoreGuide(g, off(0))) === 'Excellent', `${key}: on the line is Excellent`);
  check(gradeOf(scoreGuide(g, off(2.5))) === 'Good', `${key}: 2.5 mm off is Good (${scoreGuide(g, off(2.5)).avgMm?.toFixed(2)} mm)`);
  check(gradeOf(scoreGuide(g, off(4))) === 'Keep practicing', `${key}: 4 mm off is Keep practicing`);
  const half = scoreGuide(g, off(0).slice(0, Math.floor(along.length / 2)));
  check(half.coverage > 0.4 && half.coverage < 0.6 && gradeOf(half) === 'Keep practicing', `${key}: half the line is ${Math.round(half.coverage * 100)}% covered, not passing`);
  check(scoreGuide(g, off(20)).n === 0, `${key}: stitches 20 mm away are not counted`);
  check(L > 0.2, `${key}: guide is ${Math.round(L * 1000)} mm long`);
}

// 4. Needle chart (manual p.21), tension rule (p.10) and inch formatting
for (const [k, f] of Object.entries(FABRICS)) {
  check(NEEDLES.includes(f.rec[0]) && NEEDLES.includes(f.rec[1]) && f.rec[0] <= f.rec[1], `${k}: recommended sizes are on the chart`);
  check(needleMatch(k, f.rec[0], f.knit ? 'b2045' : 'u2020').size && needleMatch(k, f.rec[0], f.knit ? 'b2045' : 'u2020').type, `${k}: its own recommendation matches`);
}
check(!needleMatch('denim', 11, 'u2020').size, 'size 11 is too fine for denim');
check(!needleMatch('jersey', 14, 'u2020').type && needleMatch('jersey', 14, 'b2045').type, 'knits need a ball point needle');
check(tensionState(4, 4) === 'ok' && tensionState(2, 4) === 'loose' && tensionState(7, 4) === 'tight', 'straight stitch: 3–5 is balanced');
check(tensionState(2, 8) === 'ok' && tensionState(5, 8) === 'tight', 'zigzag wants lower tension than straight stitch');
for (const [mm, s] of [[0, '0 in'], [6.35, '1/4 in'], [9.5, '3/8 in'], [12.7, '1/2 in'], [15.9, '5/8 in'], [19.1, '3/4 in'], [25.4, '1 in'], [28.6, '1 1/8 in']])
  check(fmtIn(mm) === s, `fmtIn(${mm}) = "${fmtIn(mm)}", expected "${s}"`);

console.log(fails ? `${fails} failure(s)` : 'exercises: all checks passed');
process.exit(fails ? 1 : 0);
