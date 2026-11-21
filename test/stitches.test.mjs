// Headless check of the stitch mechanics: every dial pattern, the handwheel cycle (feed only while the
// needle is out of the fabric, one stitch per turn) and the spacing of stitches a real turn would sew.
import { TAU, WIN, STITCHES, stitchSpec, isStraight, cycleMeasure, cycleEvents, needleDown } from '../js/data.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL', msg); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// 1. Patterns: needle swing stays inside the 5 mm zigzag width (6 mm for the blind hem bight)
for (let p = 0; p < STITCHES.length; p++) {
  for (let i = 0; i < 48; i++) {
    const s = stitchSpec(p, i);
    check(Number.isFinite(s.dx) && Number.isFinite(s.feed), `${STITCHES[p]} #${i} has numbers`);
    check(Math.abs(s.dx) <= (p === 10 ? 3.0 : 2.6) + 1e-9, `${STITCHES[p]} #${i} swing ${s.dx} mm`);
    check(Math.abs(s.feed) <= 3.5 + 1e-9, `${STITCHES[p]} #${i} feed ${s.feed} mm`);
    if (isStraight(p)) check(s.dx === 0, `${STITCHES[p]} has no swing`);
  }
}
check(stitchSpec(3, 0).feed < stitchSpec(4, 0).feed && stitchSpec(4, 0).feed < stitchSpec(5, 0).feed, 'straight stitch lengths short < medium < long');
for (const p of [6, 7, 8]) check(Math.sign(stitchSpec(p, 0).dx) === -Math.sign(stitchSpec(p, 1).dx), `${STITCHES[p]} alternates sides`);
check(stitchSpec(0, 0).feed > 0 && stitchSpec(1, 0).feed === 0 && stitchSpec(2, 0).feed < 0, 'buttonhole: step 1 forward, bar tack in place, step 3 in reverse');
check(Math.max(...[0, 1, 2, 3].map(i => stitchSpec(0, i).dx)) < 0 && Math.min(...[0, 1, 2, 3].map(i => stitchSpec(2, i).dx)) > 0, 'buttonhole columns sit left (step 1) and right (step 3)');

// 2. The handwheel cycle
check(!needleDown(0) && needleDown(Math.PI) && !needleDown(TAU), 'needle up at the top of the turn, down halfway');
check(!needleDown(WIN - 1e-6) && needleDown(WIN + 1e-6), 'needle enters the fabric at WIN');
check(near(cycleMeasure(TAU) - cycleMeasure(0), 2 * WIN), 'one turn feeds through exactly one window');
let prev = -1; for (let t = 0; t < 4 * TAU; t += 0.01) { const m = cycleMeasure(t); check(m >= prev - 1e-12, 'cycleMeasure never runs backward'); prev = m; }
// any way the turn is sliced (slow hand turns or fast frames) gives the same events and the same feed
for (const step of [0.013, 0.3, 1.7, 5.9]) {
  let t = 0, ins = 0, outs = 0, m = 0;
  while (t < 10 * TAU) { const b = Math.min(10 * TAU, t + step * (0.5 + Math.random())); for (const s of cycleEvents(t, b)) { m += s.m; if (s.ev === 'in') ins++; if (s.ev === 'out') outs++; } t = b; }
  check(ins === 10 && outs === 10, `step ${step}: 10 turns give 10 stitches (got ${ins} in, ${outs} out)`);
  check(near(m, 20 * WIN, 1e-9), `step ${step}: feed window total ${m}`);
}
// events alternate out, in, out, in... and feed is zero while the needle is down
{ let last = 'out'; for (const s of cycleEvents(0.0001, 6 * TAU)) if (s.ev) { check(s.ev !== last, 'events alternate'); last = s.ev; } }
for (const s of cycleEvents(WIN + 0.01, TAU - WIN - 0.01)) check(s.m === 0, 'no feed while the needle is in the fabric');

// 3. Sew 40 stitches of every pattern the way the app does, and measure where the needle lands
for (let p = 0; p < STITCHES.length; p++) {
  let idx = 0, spec = stitchSpec(p, 0), fed = 0, t = 0; const holes = [];
  while (holes.length < 41) {
    const b = t + 0.37;
    for (const s of cycleEvents(t, b)) {
      fed += spec.feed * s.m / (2 * WIN);
      if (s.ev === 'in') holes.push({ along: fed, dx: spec.dx, i: idx, feed: spec.feed });
      if (s.ev === 'out') { idx++; spec = stitchSpec(p, idx); }
    }
    t = b;
  }
  for (let k = 1; k < holes.length; k++) {
    const h = holes[k];
    check(near(h.along - holes[k - 1].along, h.feed, 1e-9), `${STITCHES[p]} stitch ${k}: spacing ${(h.along - holes[k - 1].along).toFixed(4)} mm, expected ${h.feed}`);
    check(near(h.dx, stitchSpec(p, h.i).dx), `${STITCHES[p]} stitch ${k}: swing matches the pattern`);
  }
}

console.log(fails ? `${fails} failure(s)` : 'stitches: all checks passed');
process.exit(fails ? 1 : 0);
