// Pure data and math for the Sewing Workshop: no Three.js and no DOM, so the tests can import it.
// Units: meters, in the machine's own frame (needle at x = -0.12, z = 0.012; fabric feeds toward -Z).

export const TAU = Math.PI * 2;
// Half-width (radians of handwheel turn) of the window around needle-top where the needle is out of
// the fabric. Feed and needle swing happen only inside it; the needle enters the fabric at +WIN.
export const WIN = 0.7;
export const NEEDLE_X = -0.12, NEEDLE_Z = 0.012, FOOT_BOTTOM = 0.0865;
export const PXMM = 4;                        // fabric texture resolution, pixels per millimeter
export const FABRIC_W = 0.24, FABRIC_D = 0.30; // practice piece, 24 x 30 cm
export const SEAM = 0.0159;                    // 5/8 in seam allowance

// Pattern selector dial positions (manual p.11, 15)
export const STITCHES = ['Buttonhole step 1', 'Buttonhole steps 2 / 4', 'Buttonhole step 3', 'Straight stitch (short)', 'Straight stitch (medium)', 'Straight stitch (long)',
  'Zigzag (narrow)', 'Zigzag (medium)', 'Zigzag (wide)', 'Multi-step zigzag', 'Blind hem', 'Scallop'];

// Fabric types with the needle sizes the manual's chart (p.21) recommends
export const FABRICS = {
  cotton: { name: 'Quilting cotton', thick: 0.0007, rec: [11, 14], weave: 'plain', weight: 'medium' },
  voile: { name: 'Voile / lawn', thick: 0.0004, rec: [9, 11], weave: 'fine', weight: 'light' },
  flannel: { name: 'Flannel', thick: 0.0009, rec: [11, 14], weave: 'fuzzy', weight: 'medium' },
  jersey: { name: 'Jersey knit', thick: 0.0007, rec: [11, 14], weave: 'knit', weight: 'light', knit: true },
  denim: { name: 'Denim', thick: 0.0012, rec: [14, 16], weave: 'twill', weight: 'heavy' },
  canvas: { name: 'Canvas / duck', thick: 0.0014, rec: [16, 18], weave: 'canvas', weight: 'heavy' },
};
export const TYPE_DEF = { cotton: ['logo', '#2b2d31'], voile: ['dots', '#d97a95'], flannel: ['plaid', '#c8423b'], jersey: ['stripes', '#26365e'], denim: ['solid', '#2f5d8a'], canvas: ['solid', '#c9b48a'] };
export const PRINTS = { logo: 'My logo', solid: 'Solid', gingham: 'Gingham', dots: 'Polka dots', stripes: 'Stripes', plaid: 'Plaid', floral: 'Floral' };
export const FCOLORS = ['#c8423b', '#2f5d8a', '#3f7a52', '#e3b23c', '#e9e4d8', '#7a4f8f', '#d97a95', '#c9b48a', '#26365e', '#2b2d31'];
export const THREADS = [['Red', '#b5343c'], ['Navy', '#26365e'], ['Black', '#1b1b1e'], ['White', '#f4f2ec'], ['Gold', '#c9962b'], ['Green', '#3c7a4a'], ['Pink', '#d9708f']];
export const NEEDLES = [9, 11, 14, 16, 18];
export const NTYPES = { u2020: 'Universal sharp (Singer 2020)', b2045: 'Ball point (Singer 2045)', l2032: 'Leather (Singer 2032)' };

/** Is this needle size and type the one the manual recommends for the fabric? */
export function needleMatch(fabricKey, size, type) {
  const f = FABRICS[fabricKey];
  return { size: size >= f.rec[0] && size <= f.rec[1], type: f.knit ? type === 'b2045' : type === 'u2020' };
}

// Practice exercises. path(W, D) gives the chalk guide in fabric-local meters: x to the right,
// z toward the sewer. The needle starts on the first point.
export const EXERCISES = {
  free: { name: 'Free sewing', text: 'Sew anywhere you like. Line the fabric edge up with a seam guide line on the needle plate, lower the presser foot, then hold Space (or the Sew button) to run the machine.' },
  straight: { name: 'Straight seam, 5/8 in allowance', path: (W, D) => [[W / 2 - SEAM, -D / 2 + 0.015], [W / 2 - SEAM, D / 2 - 0.015]],
    text: 'Follow the chalk line 5/8 in (15.9 mm) from the edge. Keep the raw edge on the 5/8 line of the needle plate, not on the needle. Lock the start: sew 3–4 stitches, hold Reverse (R) for 3–4 stitches, then sew forward. Backstitch again at the end.' },
  curve: { name: 'Curved seam', path: (W, D) => { const x0 = W / 2 - SEAM, pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([x0 - 0.035 * Math.sin(Math.PI * u) ** 2, -D / 2 + 0.015 + u * (D - 0.03)]); } return pts; },
    text: 'Sew slowly and steer with ← / → while the machine runs so the needle stays on the chalk curve. Guide the fabric; never push or pull it.' },
  corners: { name: 'Square corners (pivoting)', path: (W, D) => { const x0 = W / 2 - SEAM, z0 = -D / 2 + 0.02; return [[x0, z0], [x0, z0 + 0.17], [x0 - 0.12, z0 + 0.17], [x0 - 0.12, z0], [x0 - 0.02, z0]]; },
    text: 'Sew to each corner dot and stop with the needle down (N). Raise the foot (F), pivot the fabric 90° (Q / E), lower the foot and keep going.' },
  edge: { name: 'Zigzag edge finish', path: (W, D) => [[W / 2 - 0.0028, -D / 2 + 0.015], [W / 2 - 0.0028, D / 2 - 0.015]],
    text: 'Turn the pattern dial to the wide zigzag. Keep the chalk line under the needle center so the right swing lands just at the raw edge; this wraps the edge and stops fraying. Tension a little lower (3) gives a flatter zigzag.' },
};

/** Needle swing dx (mm, + = right) and feed (mm, + = forward) for stitch i of dial pattern p. */
export function stitchSpec(p, i) {
  const alt = i % 2 ? 1 : -1, t6 = i % 6;
  switch (p) {
    case 0: return { dx: i % 2 ? -0.6 : -2.6, feed: 0.35 };
    case 1: return { dx: 2.6 * alt, feed: 0 };
    case 2: return { dx: i % 2 ? 0.6 : 2.6, feed: -0.35 };
    case 3: return { dx: 0, feed: 1.5 };
    case 4: return { dx: 0, feed: 2.5 };
    case 5: return { dx: 0, feed: 3.5 };
    case 6: return { dx: 1.0 * alt, feed: 1.0 };
    case 7: return { dx: 1.75 * alt, feed: 1.2 };
    case 8: return { dx: 2.5 * alt, feed: 1.4 };
    case 9: return { dx: [-2.5, -0.8, 0.8, 2.5, 0.8, -0.8][t6], feed: 0.7 };
    case 10: return { dx: t6 === 4 ? -3 : 0, feed: t6 >= 4 ? 0.4 : 1.6 };
    default: return { dx: i % 2 ? 2.5 : 2.5 - 5 * Math.sin(Math.PI * (i % 24) / 24), feed: 0.35 };
  }
}
export const isStraight = p => p >= 3 && p <= 5;

/** Cumulative "needle out of the fabric" angle from handwheel angle 0 to th (feed happens only then). */
export function cycleMeasure(th) {
  const k = Math.floor(th / TAU), ph = th - k * TAU;
  return k * 2 * WIN + Math.min(ph, WIN) + Math.max(0, ph - (TAU - WIN));
}
/** Is the needle in the fabric at handwheel angle th (0 = needle at the top)? */
export function needleDown(th) { const ph = ((th % TAU) + TAU) % TAU; return ph > WIN && ph < TAU - WIN; }

/**
 * Split a handwheel turn from angle a to b (b > a) into ordered steps:
 * each step feeds m radians' worth of the feed window, then fires its event:
 * 'in' = needle enters the fabric (a stitch forms), 'out' = needle leaves it (next stitch begins).
 */
export function cycleEvents(a, b) {
  const ev = [];
  for (let k = Math.floor((a - WIN) / TAU) + 1; TAU * k + WIN <= b; k++) ev.push([TAU * k + WIN, 'in']);
  for (let k = Math.floor((a + WIN) / TAU) + 1; TAU * k - WIN <= b; k++) ev.push([TAU * k - WIN, 'out']);
  ev.sort((p, q) => p[0] - q[0]);
  const out = []; let t0 = a;
  for (const [t, kind] of ev) { out.push({ m: cycleMeasure(t) - cycleMeasure(t0), t, ev: kind }); t0 = t; }
  out.push({ m: cycleMeasure(b) - cycleMeasure(t0), t: b, ev: null });
  return out;
}

/** Distance from (x, z) to a guide polyline, the arc length of the nearest point, and the total length. */
export function guideNear(g, x, z) {
  let best = [1e9, 0], s0 = 0;
  for (let i = 1; i < g.length; i++) { const a = g[i - 1], b = g[i], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez);
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (l * l))), d = Math.hypot(x - a[0] - t * ex, z - a[1] - t * ez);
    if (d < best[0]) best = [d, s0 + t * l]; s0 += l; }
  return [best[0], best[1], s0];
}

/**
 * Score stitch center points against a chalk guide. Points more than 12 mm off the line are ignored.
 * Returns coverage (0–1 of the line sewn), avgMm (mean distance, null if nothing was near), within2 (0–1) and n.
 */
export function scoreGuide(guide, pts) {
  const NB = 120, bins = new Uint8Array(NB); let sum = 0, within = 0, n = 0, prevS = null, L = guideNear(guide, 0, 0)[2];
  for (const [x, z] of pts) {
    const [d, s] = guideNear(guide, x, z); if (d > 0.012) { prevS = null; continue; }
    n++; sum += d; if (d <= 0.002) within++;
    const joined = prevS !== null && Math.abs(s - prevS) < 0.012, lo = joined ? Math.min(s, prevS) : s, hi = joined ? Math.max(s, prevS) : s;
    for (let k = Math.floor(lo / L * NB); k <= Math.min(NB - 1, Math.floor(hi / L * NB)); k++) bins[k] = 1;
    prevS = s;
  }
  return { coverage: bins.reduce((a, b) => a + b, 0) / NB, avgMm: n ? sum / n * 1000 : null, within2: n ? within / n : 0, n };
}
export function gradeOf(sc) { return sc.avgMm === null ? 'Keep practicing' : sc.coverage > 0.85 && sc.avgMm < 1.5 ? 'Excellent' : sc.coverage > 0.6 && sc.avgMm < 3 ? 'Good' : 'Keep practicing'; }

/** Tension verdict for one stitch: 3–5 is right for straight stitch, 2–4 for zigzag and decorative (manual p.10). */
export function tensionState(ten, pattern) {
  const [lo, hi] = isStraight(pattern) ? [3, 5] : [2, 4];
  return ten < lo ? 'loose' : ten > hi ? 'tight' : 'ok';
}

/** Millimeters to the nearest 1/8 inch, e.g. 15.9 -> "5/8 in". */
export function fmtIn(mm) {
  const e = Math.round(mm / 25.4 * 8), w = Math.floor(e / 8), r = e % 8, g = r % 4 === 0 ? 4 : r % 2 === 0 ? 2 : 1;
  return (w ? w + (r ? ' ' : '') : '') + (r ? `${r / g}/${8 / g}` : w ? '' : '0') + ' in';
}
