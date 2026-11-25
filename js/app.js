// Sewing Workshop: Singer M1500 machine model, part disassembly and the sewing simulation.
// Units are meters; Y is up and the machine's front faces +Z. Pure data and math live in data.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TAU, WIN, NEEDLE_X, NEEDLE_Z, FOOT_BOTTOM, PXMM, FABRIC_W, FABRIC_D, SEAM, STITCHES, FABRICS, TYPE_DEF, PRINTS, FCOLORS, THREADS, NEEDLES, NTYPES,
  EXERCISES, stitchSpec, isStraight, cycleMeasure, needleDown, cycleEvents, guideNear, scoreGuide, gradeOf, tensionState, needleMatch, fmtIn } from './data.js';


// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd6d4);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.02, 30);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }; controls.screenSpacePanning = true;
renderer.domElement.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); }); controls.minDistance = 0.15; controls.maxDistance = 4; controls.maxPolarAngle = Math.PI * 0.6;
function resetView() { const k = camera.aspect < 0.8 ? 2.0 : camera.aspect < 1.3 ? 1.35 : 1; camera.position.set(-0.42 * k, 0.86 + 0.42 * k, 0.06 + 0.86 * k); controls.target.set(0.0, 0.86, 0.06); controls.update(); }
resetView();

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f8c, 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e2, 2.2);
sun.position.set(-1.2, 2.6, 1.6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.5, far: 6 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.004;
scene.add(sun);

// ---------- materials (units: meters, Y up, machine front faces +Z) ----------
const std = (color, roughness = 0.5, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const M = {
  white: std(0xf1f0eb, 0.42), gray: std(0xc9cfd3, 0.5), dark: std(0x2b2d31, 0.6), black: std(0x16171a, 0.7),
  steel: std(0xcdd0d4, 0.26, 1), red: std(0xb8322a, 0.5), thread: std(0xb5343c, 0.85), threadB: std(0x2f5d8a, 0.85),
  felt: std(0x9a3b3b, 1), wood: std(0xb98a5a, 0.6), woodDark: std(0x8a6340, 0.7), floor: std(0x8f8a80, 0.9),
  wall: std(0xe6e3da, 0.95), tray: std(0x2f4a4d, 0.95), clear: new THREE.MeshStandardMaterial({ color: 0xdfe9ee, roughness: 0.15, transparent: true, opacity: 0.55 }),
  led: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c8, emissiveIntensity: 0 }),
};
const sh = m => { m.castShadow = true; m.receiveShadow = true; return m; };
const put = (parent, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); parent.add(sh(mesh)); return mesh; };
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const rbox = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), m);
const cyl = (r, len, m, axis = 'y', seg = 32, rTop = r) => {
  const g = new THREE.CylinderGeometry(rTop, r, len, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2); if (axis === 'z') g.rotateX(Math.PI / 2);
  return new THREE.Mesh(g, m);
};
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// ---------- room and sewing table ----------
const TABLE_Y = 0.75;
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), M.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), M.wall); wall.position.set(0, 1.5, -0.62); wall.receiveShadow = true; scene.add(wall);
  put(scene, box(7, 0.09, 0.02, M.woodDark), 0, 0.045, -0.61);
  put(scene, rbox(1.9, 0.04, 0.95, 0.008, M.wood), 0, TABLE_Y - 0.02, 0);          // large sewing table top
  put(scene, box(1.74, 0.09, 0.02, M.woodDark), 0, TABLE_Y - 0.085, 0.4);
  put(scene, box(1.74, 0.09, 0.02, M.woodDark), 0, TABLE_Y - 0.085, -0.4);
  for (const x of [-0.87, 0.87]) { put(scene, box(0.02, 0.09, 0.8, M.woodDark), x, TABLE_Y - 0.085, 0);
    for (const z of [-0.4, 0.4]) put(scene, box(0.06, TABLE_Y - 0.04, 0.06, M.woodDark), x, (TABLE_Y - 0.04) / 2, z); }
  // cutting mat with a grid
  const c = document.createElement('canvas'); c.width = 900; c.height = 600; const g = c.getContext('2d');
  g.fillStyle = '#2f6b55'; g.fillRect(0, 0, 900, 600); g.strokeStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i <= 45; i++) { g.lineWidth = i % 5 ? 1 : 2.5; g.beginPath(); g.moveTo(i * 20, 0); g.lineTo(i * 20, 600); g.stroke(); }
  for (let j = 0; j <= 30; j++) { g.lineWidth = j % 5 ? 1 : 2.5; g.beginPath(); g.moveTo(0, j * 20); g.lineTo(900, j * 20); g.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = put(scene, box(0.45, 0.003, 0.3, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })), 0.62, TABLE_Y + 0.0015, 0.12);
  mat.castShadow = false;
}

// ---------- machine root: bottom center of the machine on the table ----------
const machine = grp(scene, 0.12, TABLE_Y, -0.05);
const TRAY_DX = -0.16;
const tray = put(machine, rbox(0.45, 0.003, 0.54, 0.001, M.tray), -0.425, 0.0015, 0.12); tray.castShadow = false; tray.position.x += TRAY_DX;
const TRAY_TOP = 0.0035;

// body: pillar + arm + head as one front-profile extrusion (overall 0.33 W x 0.29 H x 0.13 D, sizes assumed from proportions)
{
  const s = new THREE.Shape();
  s.moveTo(0.04, 0); s.lineTo(0.165, 0); s.lineTo(0.165, 0.24); s.quadraticCurveTo(0.165, 0.29, 0.115, 0.29);
  s.lineTo(-0.13, 0.285); s.quadraticCurveTo(-0.165, 0.285, -0.165, 0.25); s.lineTo(-0.165, 0.155);
  s.quadraticCurveTo(-0.165, 0.14, -0.15, 0.14); s.lineTo(-0.085, 0.14); s.quadraticCurveTo(-0.072, 0.14, -0.07, 0.155);
  s.lineTo(-0.066, 0.185); s.quadraticCurveTo(-0.063, 0.2, -0.045, 0.2); s.lineTo(0.0, 0.2); s.quadraticCurveTo(0.04, 0.2, 0.04, 0.16); s.lineTo(0.04, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.114, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelOffset: -0.008, bevelSegments: 5, curveSegments: 20 });
  g.translate(0, 0, -0.057);
  put(machine, new THREE.Mesh(g, M.white));
  put(machine, rbox(0.215, 0.012, 0.14, 0.004, M.gray), 0.0575, 0.006, 0);                 // sole
  put(machine, rbox(0.11, 0.055, 0.0875, 0.004, M.white), -0.015, 0.0575, -0.00125);       // free arm, solid half
  put(machine, box(0.085, 0.003, 0.0875, M.white), -0.1125, 0.0835, -0.00125);             // free arm shell around the hook
  put(machine, box(0.085, 0.003, 0.0875, M.white), -0.1125, 0.0315, -0.00125);
  put(machine, box(0.085, 0.055, 0.003, M.white), -0.1125, 0.0575, -0.0435);
  put(machine, box(0.003, 0.055, 0.0875, M.white), -0.1535, 0.0575, -0.00125);
  put(machine, box(0.08, 0.048, 0.002, M.dark), -0.1125, 0.0575, -0.041);
  put(machine, cyl(0.019, 0.02, M.dark, 'z'), -0.12, 0.056, 0.008);                        // hook race
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0015, 10, 40), M.steel); put(machine, ring, -0.12, 0.056, 0.018);
  put(machine, cyl(0.003, 0.012, M.steel, 'z'), -0.12, 0.056, 0.02);
  for (const dx of [-0.0055, 0.0055]) put(machine, box(0.0025, 0.004, 0.016, M.steel), -0.12 + dx, 0.0852, 0.012); // feed teeth
  put(machine, rbox(0.073, 0.14, 0.066, 0.008, M.gray), -0.1315, 0.213, 0.036);            // face plate
  put(machine, box(0.006, 0.105, 0.004, M.dark), -0.091, 0.2225, 0.0645);                  // take-up slot
  put(machine, box(0.004, 0.012, 0.003, M.dark), -0.169, 0.16, 0.03);                      // thread cutter
  put(machine, box(0.02, 0.002, 0.012, M.led), -0.105, 0.1395, 0.035);                     // LED lens
  put(machine, rbox(0.024, 0.052, 0.004, 0.0018, M.dark), 0.105, 0.13, 0.064);             // reverse lever recess
  put(machine, box(0.002, 0.006, 0.003, M.dark), -0.02, 0.276, 0.0655);                    // stitch indicator mark
  put(machine, box(0.002, 0.022, 0.014, M.dark), 0.166, 0.07, 0.015);                      // switch bezel
  put(machine, box(0.002, 0.016, 0.026, M.black), 0.166, 0.04, 0.015);                     // main plug socket
  for (let i = 0; i < 6; i++) put(machine, box(0.001, 0.002, 0.03, M.dark), 0.1655, 0.03 + i * 0.006, -0.035); // vents
  for (const x of [0.0, 0.04]) put(machine, cyl(0.0022, 0.075, M.steel), x, 0.326, -0.035);  // spool pins
  put(machine, cyl(0.0015, 0.014, M.steel), -0.1, 0.294, -0.03); put(machine, box(0.008, 0.002, 0.004, M.steel), -0.1, 0.301, -0.028); // upper thread guide
  put(machine, cyl(0.0015, 0.01, M.steel), -0.13, 0.291, 0.02); put(machine, cyl(0.006, 0.004, M.steel), -0.13, 0.296, 0.02);          // bobbin winding tension disc
  put(machine, cyl(0.008, 0.01, M.gray), 0.108, 0.294, 0.015);                             // bobbin winding stopper
}
const ledLight = new THREE.PointLight(0xfff0cc, 0, 0.6, 2); ledLight.position.set(-0.105, 0.13, 0.035); machine.add(ledLight);

// moving assemblies
const nb = grp(machine, -0.12, 0, 0.012);                                  // needle bar (driven by the handwheel)
put(nb, cyl(0.003, 0.075, M.steel), 0, 0.1655, 0); put(nb, box(0.009, 0.009, 0.008, M.steel), 0, 0.1265, 0);
const clampScrew = grp(nb, 0.0045, 0.1265, 0); put(clampScrew, cyl(0.0018, 0.008, M.steel, 'x'), 0.004, 0, 0); put(clampScrew, cyl(0.004, 0.003, M.steel, 'x', 12), 0.0095, 0, 0);
const pg = grp(machine, -0.12, 0, -0.008);                                 // presser bar (raised by the lifter)
put(pg, cyl(0.003, 0.09, M.steel), 0, 0.157, 0);
const takeUp = put(machine, box(0.004, 0.004, 0.012, M.steel), -0.091, 0.26, 0.069);

// ---------- part builders ----------
function buildNeedle() { const g = new THREE.Group();
  put(g, cyl(0.001, 0.012, M.steel), 0, -0.006, 0); put(g, cyl(0.00055, 0.022, M.steel), 0, -0.023, 0);
  put(g, cyl(0.00002, 0.004, M.steel, 'y', 12, 0.00055), 0, -0.036, 0); return g; }
function buildShank() { const g = new THREE.Group();
  put(g, box(0.009, 0.012, 0.009, M.steel), 0, 0.004, 0); put(g, cyl(0.0018, 0.008, M.steel, 'x'), -0.008, 0.004, 0); put(g, cyl(0.0035, 0.002, M.steel, 'x', 12), -0.012, 0.004, 0);
  put(g, box(0.006, 0.014, 0.004, M.steel), 0, -0.009, 0); put(g, box(0.008, 0.004, 0.014, M.steel), 0, -0.016, 0.009); return g; }
function footBase(g) { put(g, cyl(0.001, 0.009, M.steel, 'x', 12), 0, 0, 0); put(g, box(0.005, 0.005, 0.004, M.steel), 0, -0.003, -0.003); }
function buildFootAll() { const g = new THREE.Group(); footBase(g);
  put(g, box(0.014, 0.0015, 0.016, M.steel), 0, -0.00575, -0.006);
  for (const x of [-0.005, 0.005]) { put(g, box(0.004, 0.0015, 0.016, M.steel), x, -0.00575, 0.01); const t = put(g, box(0.004, 0.0015, 0.005, M.steel), x, -0.0049, 0.02); t.rotation.x = -0.4; }
  return g; }
function buildFootZip() { const g = new THREE.Group(); footBase(g);
  put(g, box(0.012, 0.0015, 0.008, M.steel), 0, -0.00575, -0.006); put(g, box(0.005, 0.0015, 0.03, M.steel), 0, -0.00575, 0.004);
  const t = put(g, box(0.005, 0.0015, 0.005, M.steel), 0, -0.0049, 0.021); t.rotation.x = -0.4; return g; }
function buildFootBH() { const g = new THREE.Group(); footBase(g);
  for (const x of [-0.006, 0.006]) put(g, box(0.002, 0.002, 0.052, M.white), x, -0.0055, 0.006);
  for (const z of [-0.02, 0.032]) put(g, box(0.014, 0.002, 0.003, M.white), 0, -0.0055, z);
  put(g, box(0.012, 0.0012, 0.01, M.clear), 0, -0.0052, -0.012); put(g, box(0.008, 0.0015, 0.006, M.steel), 0, -0.0055, -0.004); return g; }
function buildNeedlePlate() { const g = new THREE.Group();
  put(g, box(0.062, 0.0016, 0.07, M.steel), 0, 0.0008, 0);
  for (const dx of [-0.0055, 0.0055]) put(g, box(0.0034, 0.0003, 0.018, M.black), dx, 0.00165, 0.007);
  put(g, box(0.008, 0.0003, 0.003, M.black), 0, 0.00165, 0.007);
  for (const mm of [9.5, 12.7, 15.9, 19.1, 22.2]) put(g, box(mm === 15.9 ? 0.0008 : 0.0005, 0.0003, 0.035, M.dark), mm / 1000, 0.00165, 0.005);   // seam guides 3/8-7/8 in
  for (const z of [-0.026, 0.028]) { put(g, cyl(0.003, 0.0012, M.steel, 'y', 16), 0.023, 0.002, z); put(g, box(0.005, 0.0003, 0.0008, M.black), 0.023, 0.0027, z); }
  return g; }
function buildDarningPlate() { const g = new THREE.Group();
  put(g, rbox(0.05, 0.0014, 0.04, 0.0006, M.white), 0, 0.0007, 0); put(g, box(0.01, 0.0003, 0.004, M.black), 0, 0.00145, 0.007);
  put(g, box(0.02, 0.0008, 0.003, M.gray), 0, 0.0016, -0.014); return g; }
function buildBobbin(mat) { const g = new THREE.Group();
  put(g, cyl(0.008, 0.0072, mat, 'z'), 0, 0, 0);
  for (const z of [-0.004, 0.004]) put(g, cyl(0.0102, 0.0009, M.clear, 'z'), 0, 0, z);
  put(g, cyl(0.003, 0.0092, M.dark, 'z', 16), 0, 0, 0); return g; }
function buildBobbinCase() { const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.0122, 0.0122, 0.011, 32, 1, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcdd0d4, roughness: 0.26, metalness: 1, side: THREE.DoubleSide }));
  put(g, shell); put(g, cyl(0.0122, 0.0008, M.steel, 'z'), 0, 0, 0.0055);
  put(g, box(0.0045, 0.017, 0.0014, M.steel), 0, 0, 0.0066);      // hinged latch
  put(g, box(0.004, 0.007, 0.005, M.steel), 0, 0.0145, 0.001);    // positioning finger
  put(g, box(0.0012, 0.008, 0.007, M.steel), 0.0126, 0.002, 0);   // tension spring
  return g; }
function buildExtTable() { const g = new THREE.Group();
  put(g, rbox(0.205, 0.071, 0.045, 0.007, M.white), 0, 0.0355, 0.0225);
  put(g, box(0.01, 0.071, 0.0875, M.white), -0.0975, 0.0355, -0.04375);
  put(g, box(0.195, 0.014, 0.0875, M.white), 0.005, 0.007, -0.04375);
  put(g, box(0.15, 0.0008, 0.0008, M.gray), 0, 0.058, 0.0452); put(g, box(0.03, 0.004, 0.001, M.gray), 0, 0.064, 0.0452); return g; }
function buildSpool() { const g = new THREE.Group();
  put(g, cyl(0.006, 0.046, M.white), 0, 0.023, 0); put(g, cyl(0.0125, 0.038, M.thread, 'y', 40), 0, 0.023, 0);
  for (const y of [0.002, 0.044]) put(g, cyl(0.0135, 0.002, M.white), 0, y, 0); return g; }
function buildFelt() { const g = new THREE.Group(); put(g, cyl(0.012, 0.002, M.felt), 0, 0, 0); return g; }

// ---------- place parts ----------
const shank = buildShank(); shank.position.set(0, 0.112, 0); pg.add(shank);
const footAll = buildFootAll(); footAll.position.set(0, -0.019, 0.014); shank.add(footAll);
const footZip = buildFootZip(); footZip.position.copy(footAll.position); shank.add(footZip);
const footBH = buildFootBH(); footBH.position.copy(footAll.position); shank.add(footBH);
const needle = buildNeedle(); needle.position.set(0, 0.128, 0); nb.add(needle);
const needlePlate = buildNeedlePlate(); needlePlate.position.set(-0.12, 0.085, 0.005); machine.add(needlePlate);
const darning = buildDarningPlate(); darning.position.set(-0.12, 0.0867, 0.005); machine.add(darning);
const bobbinCase = buildBobbinCase(); bobbinCase.position.set(-0.12, 0.056, 0.0245); machine.add(bobbinCase);
const bobbin = buildBobbin(M.thread); bobbin.position.set(0, 0, -0.003); bobbinCase.add(bobbin);
const extTable = buildExtTable(); extTable.position.set(-0.0625, 0.014, 0.0425); machine.add(extTable);
const felt = buildFelt(); felt.position.set(0, 0.2905, -0.035); machine.add(felt);
const spool = buildSpool(); spool.position.set(0, 0.2915, -0.035); machine.add(spool);

const cover = grp(machine, -0.1125, 0.0305, 0.0415); put(cover, box(0.084, 0.054, 0.003, M.white), 0, 0.027, 0.0015); put(cover, box(0.02, 0.003, 0.001, M.gray), 0, 0.048, 0.0033);
const handwheel = grp(machine, 0.165, 0.215, 0); put(handwheel, cyl(0.045, 0.02, M.white, 'x', 48), 0.012, 0, 0); put(handwheel, cyl(0.03, 0.004, M.gray, 'x', 48), 0.0235, 0, 0); put(handwheel, box(0.014, 0.002, 0.005, M.red), 0.014, 0.0452, 0);
const dial = grp(machine, -0.02, 0.243, 0.065); put(dial, cyl(0.027, 0.018, M.gray, 'z', 28), 0, 0, 0.009); put(dial, cyl(0.02, 0.001, M.white, 'z', 40), 0, 0, 0.0185); put(dial, box(0.003, 0.012, 0.001, M.red), 0, 0.019, 0.0188);
const tension = grp(machine, -0.083, 0.247, 0.056); put(tension, cyl(0.016, 0.006, M.dark, 'x', 20), 0, 0, 0); put(tension, box(0.0062, 0.004, 0.002, M.white), 0, 0, 0.0155);
const reverse = grp(machine, 0.105, 0.15, 0.066); put(reverse, rbox(0.017, 0.024, 0.011, 0.003, M.gray), 0, -0.012, 0.004);
const lifter = grp(machine, -0.105, 0.17, -0.062); put(lifter, rbox(0.008, 0.008, 0.034, 0.002, M.gray), 0, 0, -0.017); put(lifter, cyl(0.004, 0.012, M.dark, 'x', 16), 0, 0, 0); lifter.rotation.x = 0.55;
const winder = grp(machine, 0.085, 0.289, 0.015); put(winder, cyl(0.006, 0.004, M.gray), 0, 0.002, 0); put(winder, cyl(0.002, 0.016, M.steel), 0, 0.012, 0);
const power = grp(machine, 0.167, 0.07, 0.015); put(power, box(0.005, 0.017, 0.01, M.red), 0.001, 0, 0); power.rotation.z = -0.18;
const handle = grp(machine, 0.01, 0.2895, 0.0); for (const x of [-0.06, 0.06]) put(handle, box(0.008, 0.005, 0.034, M.gray), x, 0, 0.017); put(handle, rbox(0.128, 0.006, 0.01, 0.002, M.gray), 0, 0, 0.034);
const pedal = grp(machine, 0.1, -TABLE_Y, 0.72); put(pedal, rbox(0.14, 0.018, 0.1, 0.006, M.black), 0, 0.009, 0);
const pedalTop = grp(pedal, 0, 0.02, -0.045); put(pedalTop, rbox(0.13, 0.008, 0.095, 0.003, M.dark), 0, 0.004, 0.0475); pedalTop.rotation.x = -0.22;
for (let i = 0; i < 9; i++) put(pedalTop, box(0.1, 0.0015, 0.003, M.black), 0, 0.0085, 0.012 + i * 0.009);
{ // foot control cord, plugged into the main socket
  put(machine, box(0.018, 0.014, 0.022, M.black), 0.176, 0.04, 0.015);
  const pts = [[0.185, 0.04, 0.015], [0.24, 0.012, 0.03], [0.3, 0.004, 0.2], [0.33, 0.004, 0.47], [0.33, -0.06, 0.515], [0.3, -0.6, 0.53], [0.22, -0.744, 0.6], [0.17, -0.744, 0.72]].map(p => new THREE.Vector3(...p));
  put(machine, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.0025, 8), M.black));
}
// loose accessories on the tray (manual p.5)
const acc = {};
{ const sd = acc.screwdriver = grp(machine, -0.56, TRAY_TOP + 0.002, -0.07); put(sd, box(0.004, 0.004, 0.06, M.steel), 0, 0, 0); put(sd, box(0.03, 0.004, 0.004, M.steel), 0.013, 0, -0.03);
  const sr = acc.ripper = grp(machine, -0.48, TRAY_TOP + 0.004, -0.07); put(sr, cyl(0.004, 0.05, M.white, 'z', 16), 0, 0, 0.01); put(sr, cyl(0.001, 0.03, M.steel, 'z', 8), 0, 0, -0.03); put(sr, box(0.008, 0.006, 0.012, M.dark), 0, 0, 0.041);
  const bs = acc.bobbins = grp(machine, -0.585, TRAY_TOP + 0.005, 0.3); [[0, 0, M.threadB], [0, 0.028, M.clear], [0, -0.028, M.clear]].forEach(([x, z, m]) => { const b = buildBobbin(m); b.rotation.x = Math.PI / 2; b.position.set(x, 0, z); bs.add(b); });
  const np = acc.needles = grp(machine, -0.265, TRAY_TOP + 0.002, 0.3); put(np, box(0.03, 0.003, 0.045, M.clear), 0, 0, 0); put(np, box(0.03, 0.0032, 0.012, M.red), 0, 0, 0.016); for (let i = -1; i <= 1; i++) put(np, cyl(0.0006, 0.03, M.steel, 'z', 8), i * 0.007, 0.0005, -0.004);
  const sf = acc.felt2 = grp(machine, -0.4, TRAY_TOP + 0.001, -0.08); put(sf, cyl(0.012, 0.002, M.felt), 0, 0, 0);
}
for (const g of Object.values(acc)) g.position.x += TRAY_DX;

// ---------- registry ----------
const P = {}; const order = [];
const S = { lifter: false, cover: false, power: false, winder: false, handle: false, stitch: 3, tension: 4, running: false, theta: 0 };
function reg(id, def) {
  const p = P[id] = { id, ...def }; order.push(id); p.meshes = [];
  p.obj.traverse(m => { if (m.isMesh && !m.userData.pid) { m.material = m.material.clone(); m.userData.pid = id; p.meshes.push(m); } });
  if (p.kind === 'remove') { p.parent = p.obj.parent; p.homePos = p.obj.position.clone(); p.homeQuat = p.obj.quaternion.clone(); p.state = 'in'; }
  return p;
}
const E = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const isIn = id => P[id].state === 'in';
const footIn = () => ['footAll', 'footZip', 'footBH'].find(isIn);
const footDef = (name, obj, rx, start, desc) => ({ group: 'Removable parts', name, obj, kind: 'remove', page: 'p. 20', pull: V(0, -0.004, 0.028), rest: [rx, 0.06, E()], startOut: start, desc,
  canRemove: () => fabBlock(), canInstall: () => fabBlock() || (isIn('shank') ? null : 'Attach the presser foot shank first.') });

// children are registered before their parents so each mesh keeps its own part id
reg('bobbin', { group: 'Removable parts', name: 'Bobbin (Class 15)', obj: bobbin, kind: 'remove', page: 'p. 7', pull: V(0, 0.03, 0), rest: [-0.29, 0.15, E(Math.PI / 2)],
  desc: 'Drops into the bobbin case so the thread runs clockwise; the thread goes through the slit and under the finger with about a 6 inch tail.',
  canRemove: () => isIn('bobbinCase') ? 'Take the bobbin case out of the machine first.' : null, canInstall: () => isIn('bobbinCase') ? 'Take the bobbin case out first, then load the bobbin into it.' : null });
reg('footAll', footDef('All purpose foot', footAll, -0.56, false, 'Snap-on foot for most sewing. Push it to release it from the cut-out in the holder; to attach, seat its pin in the cut-out.'));
reg('footZip', footDef('Zipper foot', footZip, -0.5, true, 'Narrow foot that can attach on its right or left side so you can stitch close to zipper teeth or piping.'));
reg('footBH', footDef('Buttonhole foot', footBH, -0.44, true, 'Sliding foot for the four-step buttonhole. Its markings line up with the buttonhole start mark on the fabric.'));
reg('shank', { group: 'Removable parts', name: 'Presser foot shank', obj: shank, kind: 'remove', page: 'p. 20', pull: V(-0.03, 0, 0), rest: [-0.37, 0.06, E()],
  desc: 'Holder that screws to the presser bar and carries the snap-on feet. Raise the presser bar with the lifter before removing or attaching it.',
  canRemove: () => fabBlock() || (footIn() ? 'Take the presser foot off the shank first.' : null), canInstall: () => fabBlock() });
reg('needle', { group: 'Removable parts', name: 'Needle', obj: needle, kind: 'remove', page: 'p. 23', pull: V(0, -0.003, 0.03), rest: [-0.3, 0.06, E(0, 0, Math.PI / 2)],
  desc: 'Loosen the needle clamp screw, push the needle up as far as it goes with the flat side of the shaft toward the back, then tighten. Power off first.', canRemove: () => null, canInstall: () => null });
reg('darning', { group: 'Removable parts', name: 'Darning plate', obj: darning, kind: 'remove', page: 'p. 22', pull: V(0, 0.012, 0.07), rest: [-0.44, 0.15, E()], startOut: true,
  desc: 'Covers the feed teeth for free-motion darning, embroidery and sewing on buttons. Remove it for normal sewing.',
  canRemove: () => fabBlock(), canInstall: () => fabBlock() || (isIn('needlePlate') ? null : 'The darning plate sits on the needle plate. Put the needle plate back first.') });
reg('needlePlate', { group: 'Removable parts', name: 'Needle plate', obj: needlePlate, kind: 'remove', page: 'p. 24', pull: V(0, 0.035, 0), rest: [-0.55, 0.15, E()],
  desc: 'Steel plate with seam guide lines. For cleaning: raise the needle, open the hinged cover, undo the two screws with the L-screwdriver and lift it off to brush out the feed teeth.',
  canRemove: () => fabBlock() || (!S.cover ? 'Open the hinged cover first (remove the extension table to reach it).' : footIn() ? 'Take the presser foot off first so the plate can lift clear.' : isIn('darning') ? 'Remove the darning plate first.' : null), canInstall: () => fabBlock() });
reg('bobbinCase', { group: 'Removable parts', name: 'Bobbin case', obj: bobbinCase, kind: 'remove', page: 'p. 7', pull: V(0, 0, 0.06), rest: [-0.36, 0.15, E(Math.PI / 2)],
  desc: 'Pull the hinged latch to draw the case out of the shuttle. Hold it by the latch to put it back. The needle must be fully raised and the power off.',
  canRemove: () => S.cover ? null : 'Open the hinged cover first (remove the extension table to reach it).', canInstall: () => S.cover ? null : 'Open the hinged cover first.' });
reg('extTable', { group: 'Removable parts', name: 'Extension table / accessory storage', obj: extTable, kind: 'remove', page: 'p. 19', pull: V(-0.2, 0, 0), rest: [-0.42, 0.33, E()],
  desc: 'Pull it to the left to remove it and expose the free arm and hinged cover. To install, hold it level and push it back to the right. The inside is the accessory box.',
  canRemove: () => fabBlock(), canInstall: () => fabBlock() || (S.cover ? 'Close the hinged cover before sliding the table back on.' : null) });
reg('felt', { group: 'Removable parts', name: 'Spool pin felt', obj: felt, kind: 'remove', page: 'p. 6', pull: V(0, 0.085, 0), rest: [-0.33, -0.07, E()],
  desc: 'Felt disc that sits on the spool pin under the thread spool.', canRemove: () => isIn('spool') ? 'Lift the thread spool off first.' : null, canInstall: () => isIn('spool') ? 'Lift the thread spool off first.' : null });
reg('spool', { group: 'Removable parts', name: 'Thread spool', obj: spool, kind: 'remove', page: 'p. 6, 8', pull: V(0, 0.09, 0), rest: [-0.27, -0.07, E()],
  desc: 'Goes on the spool pin on top of the felt. From here the thread runs through the upper thread guide.', canRemove: () => null, canInstall: () => null });

const tog = (id, name, obj, page, desc, run, status) => reg(id, { group: 'Controls', name, obj, kind: 'toggle', page, desc, run, status });
tog('cover', 'Hinged cover', cover, 'p. 7', 'Front cover over the shuttle. Open it to reach the bobbin case and the needle plate screws.', async () => {
  if (!S.cover && isIn('extTable')) return toast('Remove the extension table to reach the hinged cover.');
  S.cover = !S.cover; const a = cover.rotation.x, b = S.cover ? 1.7 : 0; await tween(0.5, k => cover.rotation.x = a + (b - a) * k); }, () => S.cover ? 'Open' : 'Closed');
tog('lifter', 'Presser foot lifter', lifter, 'p. 4', 'Raises and lowers the presser foot. It has a second, higher position for thick fabric. Raising the foot also releases the tension discs for threading.', () => setLifter(!S.lifter), () => S.lifter ? 'Raised' : 'Lowered');
tog('handwheel', 'Handwheel', handwheel, 'p. 8, 9', 'Always turn it toward you (counterclockwise). The needle is at its highest when the mark on the wheel points straight up.', async () => {
  if (S.winder) return toast('In bobbin winding position the handwheel will not turn. Push the spindle back to the left.');
  if (S.pressure > 0.05) return toast('The machine is running. Release the pedal first.');
  const a = S.theta, b = a + Math.PI / 2; await tween(0.5, k => { S.theta = a + (b - a) * k; }); }, () => Math.abs(Math.cos(S.theta) - 1) < 0.01 ? 'Needle up' : 'Turned');
tog('dial', 'Pattern selector dial', dial, 'p. 11', 'Turn in either direction to pick a stitch. Make sure the needle is raised before turning it.', () => setStitch((S.stitch + 1) % 12), () => STITCHES[S.stitch]);
tog('tension', 'Thread tension dial', tension, 'p. 10', 'Basic setting is 4. Higher numbers tighten the upper thread, lower numbers loosen it. Most sewing falls between 3 and 5.', () => setTension((S.tension + 1) % 10), () => 'Setting ' + S.tension);
tog('reverse', 'Reverse sewing lever', reverse, 'p. 13', 'Hold it down to sew a few reverse stitches that lock the start and end of a seam. Release it to sew forward again.', async () => {
  S.revHeld = true; toast('Reverse sewing while the lever is held (or hold R).'); await tween(1.2, () => {}); S.revHeld = false; }, () => S.revHeld ? 'Held' : 'Press');
tog('winder', 'Bobbin winder spindle', winder, 'p. 6', 'Push it right toward the stopper to wind a bobbin. In that position the machine will not sew and the handwheel will not turn.', async () => {
  S.winder = !S.winder; S.running = false; S.pedalHeld = false; const a = winder.position.x, b = S.winder ? 0.093 : 0.085; await tween(0.25, k => winder.position.x = a + (b - a) * k); }, () => S.winder ? 'Winding' : 'Sewing');
tog('power', 'Power and light switch', power, 'p. 3', 'Press to "I" for power and the sewing light. Switch to "O" before threading, changing the needle, presser foot or bobbin.', async () => {
  S.power = !S.power; if (!S.power) { S.running = false; S.pedalHeld = false; } power.rotation.z = S.power ? 0.18 : -0.18; applyLights(); }, () => S.power ? 'On' : 'Off');
tog('pedal', 'Foot speed control', pedal, 'p. 3', 'Press to run the machine; the harder you press the faster it sews. Hold Space (or the Sew button) to press it; clicking it here latches it on or off.', async () => {
  if (!S.running) { const why = runBlock(); if (why) return toast(why); ensureAudio(); }
  S.running = !S.running; }, () => S.running || S.pedalHeld ? 'Running' : 'Stopped');
tog('handle', 'Handle', handle, 'p. 2', 'Carrying handle on top of the machine.', async () => { S.handle = !S.handle; const a = handle.rotation.x, b = S.handle ? -Math.PI / 2 : 0; await tween(0.3, k => handle.rotation.x = a + (b - a) * k); }, () => S.handle ? 'Up' : 'Down');
const info = (id, name, obj, page, desc) => reg(id, { group: 'Accessories', name, obj, kind: 'info', page, desc });
info('screwdriver', 'L-screwdriver', acc.screwdriver, 'p. 5, 24', 'For the needle plate screws and the needle clamp screw.');
info('ripper', 'Seam ripper / brush', acc.ripper, 'p. 5, 15, 24', 'Cuts buttonholes open from both ends toward the middle; the brush end cleans lint from the feed teeth and hook.');
info('bobbins', 'Spare Class 15 bobbins', acc.bobbins, 'p. 5', 'The machine ships with four Class 15 bobbins.');
info('needles', 'Pack of needles', acc.needles, 'p. 5, 21', 'Match needle size to thread and fabric weight: 9-11 for light fabric, 14 for medium, 16-18 for heavy.');
info('felt2', 'Spare spool pin felt', acc.felt2, 'p. 5', 'Second felt for the other spool pin.');

// rest poses on the tray
machine.updateMatrixWorld(true);
for (const id of order) { const p = P[id]; if (p.kind !== 'remove') continue;
  p.restQuat = p.rest[2]; machine.attach(p.obj); p.obj.quaternion.copy(p.restQuat); p.obj.position.set(p.rest[0] + TRAY_DX, 0, p.rest[1]); p.obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(p.obj); p.restPos = V(p.rest[0] + TRAY_DX, TABLE_Y + TRAY_TOP + 0.0005 - b.min.y, p.rest[1]);
  if (p.startOut) { p.obj.position.copy(p.restPos); p.state = 'out'; } else { p.parent.add(p.obj); p.obj.position.copy(p.homePos); p.obj.quaternion.copy(p.homeQuat); } }

// ---------- animation helpers ----------
const tweens = []; let speed = 1, busy = false;
const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const tween = (d, fn) => new Promise(res => tweens.push({ t: 0, d, fn, res }));
async function setLifter(up) { if (S.lifter === up) return; S.lifter = up; const a = S.liftY, b = up ? 0.008 : 0, ra = lifter.rotation.x, rb = up ? -0.25 : 0.55;
  await tween(0.3, k => { S.liftY = a + (b - a) * k; lifter.rotation.x = ra + (rb - ra) * k; }); }
async function needleUp() { S.running = false; S.pedalHeld = false; S.pressure = 0;
  // Just past the top the needle is still above the fabric: ease back to the top rather than sewing one more stitch.
  const a = S.theta, ph = a - Math.floor(a / (2 * Math.PI)) * 2 * Math.PI, b = ph < WIN ? a - ph : Math.ceil(a / (2 * Math.PI) - 1e-6) * 2 * Math.PI;
  if (Math.abs(b - a) > 0.01) await tween(0.35, k => S.theta = a + (b - a) * k); }
function homeInRoot(p) { machine.updateMatrixWorld(true); const pos = machine.worldToLocal(p.parent.localToWorld(p.homePos.clone())); const q = p.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(p.homeQuat); return { pos, q }; }
async function prep(p) { await needleUp(); if (['footAll', 'footZip', 'footBH', 'shank', 'darning', 'needlePlate'].includes(p.id)) await setLifter(true);
  if (p.id === 'needle') await tween(0.3, k => clampScrew.rotation.x = k * 4); }
async function doRemove(p) { handling++; try { return await _doRemove(p); } finally { handling--; } }
async function doInstall(p) { handling++; try { return await _doInstall(p); } finally { handling--; } }
async function _doRemove(p) { const why = p.canRemove(); if (why) { toast(why); return false; } await prep(p);
  machine.attach(p.obj); const p0 = p.obj.position.clone(), q0 = p.obj.quaternion.clone(), p1 = p0.clone().add(p.pull);
  await tween(0.4, k => p.obj.position.lerpVectors(p0, p1, k));
  await tween(0.75, k => { p.obj.position.lerpVectors(p1, p.restPos, k); p.obj.position.y += Math.sin(Math.PI * k) * 0.05; p.obj.quaternion.slerpQuaternions(q0, p.restQuat, k); });
  p.state = 'out'; partOut(p.id); return true; }
async function _doInstall(p) { const why = p.canInstall(); if (why) { toast(why); return false; }
  if (p.id === 'needle' && S.needleBroken) { restoreNeedle(); toast('Fitting a new needle from the pack.'); }
  if (p.id.startsWith('foot')) { const other = footIn(); if (other) await doRemove(P[other]); }
  await prep(p);
  machine.attach(p.obj); const h = homeInRoot(p), p0 = p.obj.position.clone(), q0 = p.obj.quaternion.clone(), p1 = h.pos.clone().add(p.pull);
  await tween(0.75, k => { p.obj.position.lerpVectors(p0, p1, k); p.obj.position.y += Math.sin(Math.PI * k) * 0.05; p.obj.quaternion.slerpQuaternions(q0, h.q, k); });
  await tween(0.4, k => p.obj.position.lerpVectors(p1, h.pos, k));
  p.parent.add(p.obj); p.obj.position.copy(p.homePos); p.obj.quaternion.copy(p.homeQuat); p.state = 'in';
  if (p.id === 'needle') await tween(0.3, k => clampScrew.rotation.x = (1 - k) * 4);
  return true; }
async function act(id) { const p = P[id]; select(p); if (busy || p.kind === 'info') return;
  if (p.kind === 'remove' && S.pressure > 0.05) { toast('Stop sewing first.'); return; } busy = true;
  try { if (p.kind === 'toggle') await p.run(); else if (p.state === 'in') await doRemove(p); else await doInstall(p); } finally { busy = false; refresh(); } }
async function bulk(apart) { if (busy || S.pressure > 0.05) return; sheetAway(); busy = true; speed = 2.2; if (GT.active) gtExit(false);
  try { if (S.fab) await removeWorkInner(); await needleUp();
    if (apart) { for (const id of ['spool', 'felt', 'extTable']) if (isIn(id)) await doRemove(P[id]);
      if (!S.cover) await P.cover.run();
      for (const id of ['bobbinCase', 'bobbin', 'footAll', 'footZip', 'footBH', 'shank', 'needle', 'darning', 'needlePlate']) if (isIn(id)) await doRemove(P[id]);
    } else { if (isIn('darning')) await doRemove(P.darning);
      for (const id of ['needlePlate', 'needle', 'shank']) if (!isIn(id)) await doInstall(P[id]);
      if (!isIn('footAll')) await doInstall(P.footAll);
      if (!isIn('bobbin')) { if (isIn('bobbinCase')) { if (!S.cover) { if (isIn('extTable')) await doRemove(P.extTable); await P.cover.run(); } await doRemove(P.bobbinCase); } await doInstall(P.bobbin); }
      if (!isIn('bobbinCase')) { if (!S.cover) { if (isIn('extTable')) await doRemove(P.extTable); await P.cover.run(); } await doInstall(P.bobbinCase); }
      if (S.cover) await P.cover.run();
      for (const id of ['extTable', 'felt', 'spool']) if (!isIn(id)) { if (id === 'felt' && isIn('spool')) await doRemove(P.spool); await doInstall(P[id]); }
      await setLifter(false); }
  } finally { speed = 1; busy = false; refresh(); } }

// ---------- UI ----------
const $ = id => document.getElementById(id);
let toastT; function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
const statusOf = p => p.kind === 'remove' ? (p.state === 'in' ? 'Installed' : 'On tray') : p.kind === 'toggle' ? p.status() : 'Info';
const hintOf = p => p.kind === 'remove' ? (p.state === 'in' ? 'click to remove' : 'click to install') : p.kind === 'toggle' ? 'click to operate' : '';
const rows = {};
{ const list = $('list'); let g = '';
  for (const id of order) { const p = P[id]; if (p.group !== g) { g = p.group; const h = document.createElement('h2'); h.textContent = g; list.append(h); }
    const r = document.createElement('div'); r.className = 'row'; r.innerHTML = '<span></span><span class="chip"></span>'; r.firstChild.textContent = p.name;
    r.onclick = () => { sheetAway(); act(id); }; r.onmouseenter = () => setHover(p); r.onmouseleave = () => setHover(null); list.append(r); rows[id] = r; } }
function refresh() { if (typeof refreshSew === 'function' && UI.chk) refreshSew(); for (const id of order) { const p = P[id], c = rows[id].lastChild; c.textContent = statusOf(p);
  c.className = 'chip' + (p.kind === 'remove' && p.state === 'out' ? ' out' : p.kind === 'toggle' && ['Open', 'Raised', 'On', 'Running', 'Winding', 'Up'].includes(p.status()) ? ' act' : ''); } }
let selected = null, hovered = null;
function paint(p, v) { if (p) for (const m of p.meshes) { m.material.emissive.setHex(v ? 0x2aa39a : 0); m.material.emissiveIntensity = v; } }
function setHover(p) { if (hovered === p) return; if (hovered) { paint(hovered, hovered === selected ? 0.12 : 0); rows[hovered.id].classList.remove('hover'); }
  hovered = p; if (p) { paint(p, 0.45); rows[p.id].classList.add('hover'); } renderer.domElement.style.cursor = p ? 'pointer' : 'grab'; }
function select(p) { if (selected) { rows[selected.id].classList.remove('sel'); if (selected !== hovered) paint(selected, 0); } selected = p; rows[p.id].classList.add('sel'); if (p !== hovered) paint(p, 0.12);
  if (!GT.active) setInfo(p.name, 'Manual ' + p.page, p.desc); }
$('bDis').onclick = () => bulk(true); $('bAsm').onclick = () => bulk(false); $('bView').onclick = resetView;

// principal-part labels (manual p. 1-2)
const LABELS = [['Thread tension dial', -0.083, 0.247, 0.075], ['Thread take-up lever', -0.091, 0.27, 0.07], ['Thread cutter', -0.172, 0.16, 0.03], ['Presser foot', -0.12, 0.095, 0.03], ['Needle plate', -0.1, 0.087, 0.035],
  ['Extension table', -0.02, 0.085, 0.07], ['Pattern selector dial', -0.02, 0.243, 0.085], ['Bobbin winding stopper', 0.108, 0.3, 0.015], ['Reverse sewing lever', 0.105, 0.135, 0.075], ['Thread guide', -0.1, 0.302, -0.03],
  ['Bobbin winder spindle', 0.085, 0.31, 0.015], ['Spool pins', 0.04, 0.365, -0.035], ['Handwheel', 0.19, 0.215, 0], ['Power and light switch', 0.172, 0.07, 0.015], ['Main plug socket', 0.186, 0.04, 0.015],
  ['Bobbin thread guide', -0.13, 0.3, 0.02], ['Handle', 0.01, 0.295, 0.034], ['Face plate', -0.14, 0.2, 0.07], ['Presser foot lifter', -0.105, 0.165, -0.09]]
  .map(([t, x, y, z]) => { const el = document.createElement('div'); el.className = 'lbl'; el.textContent = t; $('labels').append(el); return { el, v: V(x, y, z) }; });
let showLabels = false; $('bLbl').onclick = e => { showLabels = !showLabels; e.target.classList.toggle('on', showLabels); for (const l of LABELS) l.el.style.display = showLabels ? 'block' : 'none'; };

// picking
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
function pick(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObjects(scene.children, true)) { let o = h.object, vis = true; while (o) { if (!o.visible) vis = false; o = o.parent; } if (!vis) continue;
    const u = h.object.userData; if (u.pid) return { part: P[u.pid] }; if (u.fabric) return { fab: u.fabric }; return null; }
  return null; }
const cv = renderer.domElement;
cv.addEventListener('pointermove', e => { if (e.buttons) return; const r = pick(e); setHover(r && r.part || null); const tip = $('tip');
  if (r) { if (r.fab) cv.style.cursor = 'pointer'; const s = document.createElement('small');
    s.textContent = r.part ? hintOf(r.part) : r.fab === S.fab ? 'click for the exercise' : 'click for results';
    tip.replaceChildren(r.part ? r.part.name : r.fab === S.fab ? 'Fabric under the foot' : 'Sewn sample', s); tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px'; tip.style.opacity = 1; } else tip.style.opacity = 0; });
cv.addEventListener('pointerleave', () => { setHover(null); $('tip').style.opacity = 0; });
const ptrs = new Set();
cv.addEventListener('pointerdown', e => { ptrs.add(e.pointerId); down = e.button === 0 && ptrs.size === 1 ? [e.clientX, e.clientY] : null; });
for (const ev of ['pointercancel', 'lostpointercapture']) cv.addEventListener(ev, e => { ptrs.delete(e.pointerId); if (ev === 'pointercancel') down = null; });
cv.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > (e.pointerType === 'touch' ? 12 : 5)) return; down = null; const r = pick(e); if (!r) return;
  if (r.part) act(r.part.id); else { showThumbs(r.fab); if (r.fab === S.fab) showExercise(r.fab); else showReport(r.fab); } });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ================= SEWING SIMULATION =================
// Units: meters, machine-local frame (needle at x = -0.12, z = 0.012). Fabric feeds toward -Z (away from the sewer).
Object.assign(S, { liftY: 0, pressure: 0, pedalHeld: false, revHeld: false, level: 0, stitchIdx: 0, winG0: -WIN, swingFrom: 0, swingTo: 0, spec: null,
  nsize: 14, ntype: 'u2020', needleBroken: false, rate: 18, topColor: '#b5343c', bobColor: '#b5343c', contrast: false, sound: true, fab: null, viewFab: null, samples: [], cutUntil: 0 });
let handling = 0;

const FO = { type: 'cotton', print: 'logo', color: '#2b2d31', ex: 'straight' };


S.spec = stitchSpec(S.stitch, 0); S.swingFrom = S.swingTo = S.spec.dx;

// ---------- helpers ----------
const G = cycleMeasure;
const isNeedleDown = () => needleDown(S.theta);
const bobbinOk = () => isIn('bobbin') && isIn('bobbinCase');
const footOn = () => !!footIn() && isIn('shank');
const fabBlock = () => S.fab ? 'Take the fabric out first (Sew tab → Remove the work).' : null;
const bedTop = () => isIn('darning') ? 0.0882 : 0.0868;
const fabTop = f => bedTop() + f.f.thick;
const feedActive = () => isIn('needlePlate') && !isIn('darning') && footOn() && S.liftY < 0.001;
const lastToast = {};
function tthrottle(key, msg, ms = 2600) { const n = performance.now(); if ((lastToast[key] || 0) + ms < n) { lastToast[key] = n; toast(msg); } }
function once(f, key, msg) { if (f.flags[key]) return; f.flags[key] = true; toast(msg); }
function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shade(hex, f) { const c = new THREE.Color(hex); if (f > 0) c.lerp(new THREE.Color(1, 1, 1), f); else c.multiplyScalar(1 + f); return '#' + c.getHexString(); }
const lum = hex => new THREE.Color(hex).getHSL({}).l;
function supportH(top, mx, mz) {
  const ext = isIn('extTable');
  const x0 = ext ? -0.168 : -0.156, x1 = ext ? 0.17 : 0.04, z0 = ext ? -0.066 : -0.046, z1 = ext ? 0.088 : 0.043;
  const d = Math.hypot(Math.max(x0 - mx, 0, mx - x1), Math.max(z0 - mz, 0, mz - z1));
  return d === 0 ? top : Math.max(0.0012, top - (0.9 * d + 7 * d * d));
}
function footRide() {
  let top = isIn('darning') ? 0.0881 : 0.0866; const f = S.fab;
  if (f && f.mode === 'machine') { const [lx, lz] = f.toLocal(NEEDLE_X, NEEDLE_Z); if (f.inside(lx, lz)) top = fabTop(f); }
  return Math.max(0, top - FOOT_BOTTOM);
}

// ---------- fabric painting ----------
// The owner's logo: an alpha mask (ink where the logo is black), tinted to the chosen color and tiled.
const LOGO = new Image(); LOGO.src = new URL('../assets/logo.png', import.meta.url).href;
function tintedLogo(col, lh) {
  const w = Math.round(lh * LOGO.naturalWidth / LOGO.naturalHeight), c = document.createElement('canvas'); c.width = w; c.height = Math.round(lh);
  const x = c.getContext('2d'); x.drawImage(LOGO, 0, 0, w, c.height); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, w, c.height); return c;
}
function paintFabric(ctx, w, h, o, f, back) {
  const m = PXMM, col = o.color, R = rng(o.seed), fill = c => { ctx.fillStyle = c; ctx.fillRect(0, 0, w, h); };
  switch (o.print) {
    case 'logo': { fill('#f4f1e9'); if (!LOGO.complete || !LOGO.naturalWidth) break;
      const t = tintedLogo(col, 30 * m), sx = 46 * m, sy = 44 * m; let row = 0; // 30 mm tall logos in a staggered repeat
      for (let y = -sy / 2; y < h + sy; y += sy, row++) for (let x = (row % 2 ? sx / 2 : 0) - sx / 2; x < w + sx; x += sx) ctx.drawImage(t, x - t.width / 2, y - t.height / 2);
      break; }
    case 'gingham': { fill('#f4f1e9'); const p = 12 * m, b = 6 * m; ctx.globalAlpha = 0.55; ctx.fillStyle = col; for (let x = 0; x < w; x += p) ctx.fillRect(x, 0, b, h); for (let y = 0; y < h; y += p) ctx.fillRect(0, y, w, b); ctx.globalAlpha = 1; break; }
    case 'dots': { fill(col); ctx.fillStyle = '#f6f2e8'; const s = 10 * m; let row = 0; for (let y = s / 2; y < h + s; y += s * 0.866, row++) for (let x = row % 2 ? s / 2 : 0; x < w + s; x += s) { ctx.beginPath(); ctx.arc(x, y, 2.2 * m, 0, TAU); ctx.fill(); } break; }
    case 'stripes': { fill('#f4f1e9'); ctx.fillStyle = col; for (let x = 0; x < w; x += 10 * m) ctx.fillRect(x, 0, 4.5 * m, h); break; }
    case 'plaid': { fill(col); ctx.fillStyle = 'rgba(0,0,0,.28)'; const p = 40 * m; for (let x = 0; x < w; x += p) ctx.fillRect(x, 0, 14 * m, h); for (let y = 0; y < h; y += p) ctx.fillRect(0, y, w, 14 * m);
      ctx.fillStyle = 'rgba(255,250,235,.55)'; for (let x = 24 * m; x < w; x += p) ctx.fillRect(x, 0, 1.2 * m, h); for (let y = 24 * m; y < h; y += p) ctx.fillRect(0, y, w, 1.2 * m); break; }
    case 'floral': { fill(col); const light = shade(col, 0.55), dark = shade(col, -0.35);
      for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, s = (3 + R() * 4) * m, a = R() * TAU;
        ctx.fillStyle = '#5b8a4e'; for (let k = 0; k < 2; k++) { ctx.save(); ctx.translate(x, y); ctx.rotate(a + k * 2.4); ctx.beginPath(); ctx.ellipse(s * 1.6, 0, s * 0.9, s * 0.38, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = i % 3 ? light : '#f6efe2'; for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(x, y); ctx.rotate(a + k * TAU / 5); ctx.beginPath(); ctx.ellipse(s * 0.75, 0, s * 0.7, s * 0.45, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = '#e3b23c'; ctx.beginPath(); ctx.arc(x, y, s * 0.32, 0, TAU); ctx.fill(); }
      ctx.fillStyle = dark; for (let i = 0; i < 260; i++) { ctx.beginPath(); ctx.arc(R() * w, R() * h, 0.6 * m, 0, TAU); ctx.fill(); } break; }
    default: fill(col);
  }
  // weave
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  ctx.lineWidth = 1;
  if (f.weave === 'twill') { ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1.5; for (let k = -h; k < w; k += m) line(k, 0, k + h, h); }
  else if (f.weave === 'canvas') { ctx.strokeStyle = 'rgba(0,0,0,.09)'; ctx.lineWidth = 1.6; for (let x = 0; x < w; x += m) line(x, 0, x, h); for (let y = 0; y < h; y += m) line(0, y, w, y); }
  else if (f.weave === 'knit') { ctx.strokeStyle = 'rgba(0,0,0,.07)'; for (let x = 0; x < w; x += m) line(x, 0, x, h); ctx.strokeStyle = 'rgba(255,255,255,.05)'; for (let y = 0; y < h; y += m * 0.8) line(0, y, w, y); }
  else { ctx.strokeStyle = 'rgba(0,0,0,.035)'; for (let x = 0; x < w; x += m / 2) line(x, 0, x, h); for (let y = 0; y < h; y += m / 2) line(0, y, w, y); }
  const img = ctx.getImageData(0, 0, w, h), d = img.data, amp = f.weave === 'fuzzy' ? 16 : 7;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  if (back) { const wash = f.weave === 'twill' ? 0.45 : ['dots', 'floral', 'stripes', 'logo'].includes(o.print) ? 0.38 : 0.08; ctx.fillStyle = `rgba(245,242,235,${wash})`; ctx.fillRect(0, 0, w, h); }
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2);
}
const dot = (ctx, x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const seg = (ctx, a, b, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
function drawNest(ctx, x, y, tc, bc) { const R = Math.random; ctx.lineWidth = 0.3 * PXMM;
  for (let i = 0; i < 6; i++) { ctx.strokeStyle = i % 3 ? tc : bc; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) ctx.quadraticCurveTo(x + (R() - 0.5) * 14 * PXMM, y + (R() - 0.5) * 14 * PXMM, x + (R() - 0.5) * 8 * PXMM, y + (R() - 0.5) * 8 * PXMM); ctx.stroke(); } }

// ---------- fabric piece ----------
class Fabric {
  constructor(o) {
    this.o = o; this.f = FABRICS[o.type]; this.W = FABRIC_W; this.D = FABRIC_D; this.ex = o.ex;
    this.cw = Math.round(this.W * 1000 * PXMM); this.ch = Math.round(this.D * 1000 * PXMM);
    this.top = this.mk(false); this.bot = this.mk(true);
    const ex = EXERCISES[o.ex]; this.guide = ex.path ? ex.path(this.W, this.D) : null; if (this.guide) this.drawGuide();
    this.geo = new THREE.PlaneGeometry(this.W, this.D, 48, 60).rotateX(-Math.PI / 2); this.base = this.geo.attributes.position.array.slice();
    const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
    this.topTex = tex(this.top.canvas); this.botTex = tex(this.bot.canvas);
    const rough = this.f.weight === 'heavy' ? 0.95 : 0.88;
    this.group = new THREE.Group(); machine.add(this.group);
    this.front = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ map: this.topTex, roughness: rough, side: THREE.FrontSide }));
    this.back = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ map: this.botTex, roughness: rough, side: THREE.BackSide }));
    this.front.castShadow = true; this.front.receiveShadow = this.back.receiveShadow = true;
    this.front.userData.fabric = this.back.userData.fabric = this; this.group.add(this.front, this.back);
    this.x = 0; this.z = 0; this.r = 0; this.y = 0; this.mode = 'machine';
    this.holes = []; this.prev = null; this.flags = {}; this.report = null; this.dirty = false;
  }
  mk(back) { const canvas = document.createElement('canvas'); canvas.width = this.cw; canvas.height = this.ch; const ctx = canvas.getContext('2d', { willReadFrequently: true }); paintFabric(ctx, this.cw, this.ch, this.o, this.f, back); return { canvas, ctx }; }
  toLocal(mx, mz) { const dx = mx - this.x, dz = mz - this.z, c = Math.cos(this.r), s = Math.sin(this.r); return [dx * c - dz * s, dx * s + dz * c]; }
  toMachine(lx, lz) { const c = Math.cos(this.r), s = Math.sin(this.r); return [this.x + lx * c + lz * s, this.z - lx * s + lz * c]; }
  inside(lx, lz) { return Math.abs(lx) <= this.W / 2 && Math.abs(lz) <= this.D / 2; }
  cp(lx, lz) { return [(lx / this.W + 0.5) * this.cw, (lz / this.D + 0.5) * this.ch]; }
  drawGuide() {
    const ctx = this.top.ctx, o = this.o, m = PXMM, lightBase = ['gingham', 'stripes', 'logo'].includes(o.print) || lum(o.color) > 0.55;
    const blueish = new THREE.Color(o.color).getHSL({}).h > 0.5 && new THREE.Color(o.color).getHSL({}).h < 0.72;
    const chalk = lightBase ? (blueish ? 'rgba(200,40,90,.85)' : 'rgba(40,80,190,.85)') : 'rgba(255,255,255,.92)';
    const pts = this.guide.map(p => this.cp(p[0], p[1]));
    ctx.save(); ctx.strokeStyle = chalk; ctx.lineWidth = 0.8 * m; ctx.setLineDash([3 * m, 2 * m]); ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.stroke(); ctx.restore();
    dot(ctx, ...pts[0], 2 * m, chalk);
    if (this.ex === 'corners') for (const p of pts.slice(1, -1)) { ctx.strokeStyle = chalk; ctx.lineWidth = 0.6 * m; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5 * m, 0, TAU); ctx.stroke(); }
    const e = pts[pts.length - 1]; ctx.strokeStyle = chalk; ctx.lineWidth = 0.8 * m; ctx.beginPath(); ctx.moveTo(e[0] - 2 * m, e[1] - 2 * m); ctx.lineTo(e[0] + 2 * m, e[1] + 2 * m); ctx.moveTo(e[0] + 2 * m, e[1] - 2 * m); ctx.lineTo(e[0] - 2 * m, e[1] + 2 * m); ctx.stroke();
  }
  update() {
    this.group.position.set(this.x, this.y, this.z); this.group.rotation.y = this.r;
    const pos = this.geo.attributes.position.array, b = this.base, top = fabTop(this), c = Math.cos(this.r), s = Math.sin(this.r), onM = this.mode === 'machine';
    for (let i = 0; i < pos.length; i += 3) { const lx = b[i], lz = b[i + 2]; pos[i + 1] = onM ? supportH(top, this.x + lx * c + lz * s, this.z - lx * s + lz * c) : 0; }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals(); this.geo.computeBoundingSphere();
  }
  collides(x, z, r) {
    const c = Math.cos(r), s = Math.sin(r), W = this.W / 2, D = this.D / 2;
    for (let t = -1; t <= 1.001; t += 0.1) for (const [lx, lz] of [[t * W, -D], [t * W, D], [-W, t * D], [W, t * D]]) {
      const mx = x + lx * c + lz * s, mz = z - lx * s + lz * c; if (mx > 0.036 && mz > -0.075 && mz < 0.078) return true; }
    return false;
  }
  addHole(h) {
    this.holes.push(h); const [hx, hz] = this.cp(h.lx, h.lz), hr = 0.2 * PXMM * S.nsize / 14;
    for (const ctx of [this.top.ctx, this.bot.ctx]) dot(ctx, hx, hz, hr, 'rgba(0,0,0,.4)');
    if (h.nest) drawNest(this.bot.ctx, hx, hz, S.topColor, S.bobColor);
    this.dirty = true;
    if (!h.lock) { this.prev = null; return; }
    if (h.skip) return;
    if (this.prev) this.stitch(this.prev, h);
    this.prev = h;
  }
  stitch(a, b) {
    const A = this.cp(a.lx, a.lz), B = this.cp(b.lx, b.lz), T = this.top.ctx, U = this.bot.ctx, tc = S.topColor, bc = S.bobColor, ten = S.tension;
    seg(T, A, B, 'rgba(0,0,0,.3)', 0.75 * PXMM); seg(T, A, B, tc, 0.42 * PXMM);
    if (ten >= 7) dot(T, B[0], B[1], 0.5 * PXMM, bc);
    seg(U, A, B, 'rgba(0,0,0,.3)', 0.75 * PXMM); seg(U, A, B, bc, 0.42 * PXMM);
    if (ten <= 2) { U.strokeStyle = tc; U.lineWidth = 0.3 * PXMM; for (let k = 0; k < 2; k++) { U.beginPath(); U.ellipse(B[0] + (Math.random() - 0.5) * PXMM, B[1] + (Math.random() - 0.5) * PXMM, 1.4 * PXMM, 0.9 * PXMM, Math.random() * 3, 0, TAU); U.stroke(); } }
    else if (!isStraight(S.stitch) && ten <= 4) dot(U, B[0], B[1], 0.35 * PXMM, tc);
  }
  cut() {
    const h = this.prev || [...this.holes].reverse().find(q => q.lock); this.prev = null; if (!h) return;
    const c = Math.cos(this.r), s = Math.sin(this.r), dir = [s * 0.8 - c * 0.3, -c * 0.8 - s * 0.3], L = 0.035;
    const A = this.cp(h.lx, h.lz), B = this.cp(h.lx + dir[0] * L, h.lz + dir[1] * L), M = this.cp(h.lx + dir[0] * L * 0.5 + dir[1] * 0.004, h.lz + dir[1] * L * 0.5 - dir[0] * 0.004);
    for (const [ctx, col] of [[this.top.ctx, S.topColor], [this.bot.ctx, S.bobColor]]) { ctx.strokeStyle = col; ctx.lineWidth = 0.42 * PXMM; ctx.beginPath(); ctx.moveTo(...A); ctx.quadraticCurveTo(...M, ...B); ctx.stroke(); }
    this.dirty = true;
  }
  dispose() { machine.remove(this.group); this.geo.dispose(); this.topTex.dispose(); this.botTex.dispose(); this.front.material.dispose(); this.back.material.dispose(); }
}
function tryMove(f, nx, nz, nr, isFeed) {
  nx = Math.max(-0.75, Math.min(0.3, nx)); nz = Math.max(-0.4, Math.min(0.55, nz));
  if (f.collides(nx, nz, nr) && !f.collides(f.x, f.z, f.r)) { tthrottle('arm', isFeed ? 'The fabric is jammed against the machine arm. Raise the foot and reposition it.' : 'The fabric is up against the machine arm.'); return false; }
  f.x = nx; f.z = nz; f.r = nr; return true;
}

// ---------- machine cycle: feed, needle swing and stitch formation ----------
function feed(m) {
  const f = S.fab; if (m <= 0 || !f || f.mode !== 'machine' || !feedActive()) return;
  const d = S.spec.feed / 1000 * (m / (2 * WIN)) * (S.revHeld ? -1 : 1);
  if (d) tryMove(f, f.x, f.z - d, f.r, true);
}
function stitchOut(t) { S.winG0 = G(t); S.swingFrom = S.swingTo; S.stitchIdx++; S.spec = stitchSpec(S.stitch, S.stitchIdx); S.swingTo = S.spec.dx; }
function stitchIn() {
  const f = S.fab; if (!f || f.mode !== 'machine' || !isIn('needle') || S.needleBroken) return;
  const [lx, lz] = f.toLocal(nb.position.x, NEEDLE_Z); if (!f.inside(lx, lz)) return;
  const [clx, clz] = f.toLocal(NEEDLE_X, NEEDLE_Z), fb = f.f, ni = NEEDLES.indexOf(S.nsize), short = NEEDLES.indexOf(fb.rec[0]) - ni;
  if (short > 0) once(f, 'fine', `A size ${S.nsize} needle is too fine for ${fb.name.toLowerCase()}; it can bend or break. Use size ${fb.rec[0]}–${fb.rec[1]} (manual p.21).`);
  if (S.nsize > fb.rec[1]) once(f, 'big', `A size ${S.nsize} needle is heavier than ${fb.name.toLowerCase()} needs; it leaves large holes and can pucker the seam.`);
  if (S.ntype === 'l2032' && !f.flags.leather) once(f, 'leather', 'Leather needles cut the fibres. Use them only on leather and vinyl (manual p.21).');
  if (Math.random() < (short >= 2 ? 0.05 : short === 1 ? 0.006 : 0)) { breakNeedle(`The size ${S.nsize} needle broke going through the ${fb.name.toLowerCase()}.`); return; }
  const lock = S.level >= 4 && bobbinOk(), h = { lx, lz, clx, clz, rev: S.revHeld && feedActive(), lock, ten: S.tension, pat: S.stitch };
  h.skip = lock && fb.knit && S.ntype !== 'b2045' && Math.random() < 0.12;
  h.nest = lock && !(footOn() && S.liftY < 0.001);
  if (S.level < 4) once(f, 'noThread', 'The needle is punching holes but there is no thread in it. Thread the machine first (Sew tab).');
  else if (!bobbinOk()) once(f, 'noBobbin', 'No bobbin: the upper thread has nothing to lock with, so no stitches form.');
  if (h.nest) once(f, 'nest', 'The presser foot is up! Thread is bunching under the fabric (a "bird\'s nest"). Lower the foot (F) before sewing.');
  if (h.skip) once(f, 'skip', 'Skipped stitches: a sharp needle pierces knit loops. Switch to a ball point needle (Singer 2045) for jersey.');
  f.addHole(h);
}
function advance(a, b) {
  for (const s of cycleEvents(a, b)) { feed(s.m); if (s.ev === 'in') stitchIn(); else if (s.ev === 'out') stitchOut(s.t); }
}
const needleShaft = needle.children[1], needleTip = needle.children[2];
function breakNeedle(msg) {
  S.needleBroken = true; needleShaft.scale.y = 0.45; needleShaft.position.y = -0.01695; needleTip.visible = false;
  S.level = Math.min(S.level, 3); S.pedalHeld = false; S.running = false; S.pressure = 0; if (S.fab) S.fab.flags.broke = true;
  toast(msg + ' Replace it: Parts tab → Needle (take it off, then put a new one on).'); refresh();
}
function restoreNeedle() { S.needleBroken = false; needleShaft.scale.y = 1; needleShaft.position.y = -0.023; needleTip.visible = true; }
function runBlock() {
  if (!S.power) return 'Switch the power on first (power switch on the right side of the machine).';
  if (S.winder) return 'The bobbin winder spindle is in winding position. Push it to the left to sew (manual p.6).';
  if (!isIn('needlePlate')) return 'Put the needle plate back on before sewing.';
  if (handling) return 'Wait for the current step to finish.';
  return null;
}
function partOut(id) { if (id === 'needle') S.level = Math.min(S.level, 3); if (id === 'bobbin' || id === 'bobbinCase') S.level = Math.min(S.level, 4); if (id === 'spool') S.level = 0; }

// ---------- steering / guiding the fabric ----------
const keys = {};
function steer(dt) {
  const f = S.fab; if (!f || f.mode !== 'machine' || handling) return;
  const k = c => !!keys[c], L = k('ArrowLeft') || k('KeyA'), R = k('ArrowRight') || k('KeyD'), U = k('ArrowUp') || k('KeyW'), Dn = k('ArrowDown') || k('KeyS'), Q = k('KeyQ'), E = k('KeyE');
  if (!(L || R || U || Dn || Q || E)) return;
  const footDown = footOn() && S.liftY < 0.001, sewing = S.pressure > 0.05, px = nb.position.x, pz = NEEDLE_Z;
  const nDown = isNeedleDown() && f.inside(...f.toLocal(px, pz));
  let dx = 0, dz = 0, rot = 0;
  if (footDown && isIn('darning')) { dx = (R - L) * 0.035 * dt; dz = (Dn - U) * 0.035 * dt; rot = (Q - E) * 0.8 * dt; }
  else if (footDown) {
    if (!sewing) { tthrottle('fd', 'The presser foot is holding the fabric. Raise it (F) to slide or pivot the fabric.'); return; }
    rot = ((L || Q) - (R || E)) * 0.45 * dt;
    if (U || Dn) { tthrottle('push', "Don't push or pull the fabric while stitching; let the feed dogs move it. Pulling can deflect the needle and break it."); if (nDown && Math.random() < 0.5 * dt) breakNeedle('The fabric was pulled and the needle struck the needle plate.'); }
  } else if (nDown) { rot = ((L || Q) - (R || E)) * 1.2 * dt; if (U || Dn) tthrottle('nd', 'The needle is in the fabric, so you can only pivot. Raise the needle (N) to slide the fabric.'); }
  else { dx = (R - L) * 0.06 * dt; dz = (Dn - U) * 0.06 * dt; rot = (Q - E) * 1.2 * dt; }
  let nx = f.x + dx, nz = f.z + dz, nr = f.r;
  if (rot) { const rx = nx - px, rz = nz - pz, c = Math.cos(rot), s = Math.sin(rot); nx = px + rx * c + rz * s; nz = pz - rx * s + rz * c; nr += rot; }
  tryMove(f, nx, nz, nr);
}

// ---------- thread drawing ----------
const threadMat = new THREE.MeshStandardMaterial({ color: S.topColor, roughness: 0.8 }), bobThreadMat = new THREE.MeshStandardMaterial({ color: S.bobColor, roughness: 0.8 });
let threadMesh = null, threadSig = '';
const bobTail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.12, 0.0869, 0.012), V(-0.117, 0.0874, -0.01), V(-0.111, 0.0874, -0.045)]), 20, 0.00035, 5), bobThreadMat);
bobTail.raycast = () => {}; bobTail.visible = false; machine.add(bobTail);
function threadPoints(now) {
  const L = S.level; if (L <= 0 || !isIn('spool')) return null;
  const nx = nb.position.x, ny = nb.position.y, ty = takeUp.position.y, p = [[-0.0125, 0.318, -0.033], [-0.1, 0.302, -0.028]];
  if (L === 1) p.push([-0.11, 0.294, -0.018], [-0.116, 0.275, -0.008]);
  if (L >= 2) p.push([-0.104, 0.297, 0.0], [-0.088, 0.29, 0.06], [-0.085, 0.27, 0.068], [-0.085, 0.17, 0.068], [-0.088, 0.16, 0.068], [-0.094, 0.16, 0.068], [-0.097, 0.17, 0.068], [-0.097, ty - 0.012, 0.069]);
  if (L === 2) p.push([-0.099, ty + 0.01, 0.07], [-0.102, ty + 0.02, 0.074]);
  if (L >= 3) p.push([-0.091, ty + 0.001, 0.075], [-0.095, ty - 0.01, 0.071], [-0.1, 0.15, 0.064]);
  if (L === 3) p.push([-0.104, 0.13, 0.06], [-0.106, 0.115, 0.058]);
  if (L >= 4 && isIn('needle')) {
    const ey = ny + 0.0925; p.push([nx, ny + 0.121, 0.0178], [nx, ey, 0.0136], [nx, ey, 0.0104]);
    const f = S.fab;
    if (now < S.cutUntil) p.push([-0.14, 0.12, 0.02], [-0.17, 0.158, 0.03]);
    else if (f && f.mode === 'machine' && f.prev) { const [mx, mz] = f.toMachine(f.prev.lx, f.prev.lz); p.push([mx, fabTop(f) + 0.0003, mz]); }
    else p.push([nx - 0.001, Math.max(0.0895, ey - 0.006), 0.006], [nx + 0.004, 0.0885, -0.03], [nx + 0.008, 0.0882, -0.05]);
  }
  return p.map(q => V(...q));
}
function updateThread(now) {
  const pts = threadPoints(now), sig = pts ? pts.map(q => `${q.x.toFixed(4)},${q.y.toFixed(4)},${q.z.toFixed(4)}`).join(';') : '';
  if (sig !== threadSig) { threadSig = sig; if (threadMesh) { machine.remove(threadMesh); threadMesh.geometry.dispose(); threadMesh = null; }
    if (pts) { threadMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), pts.length * 10, 0.00035, 5), threadMat); threadMesh.raycast = () => {}; machine.add(threadMesh); } }
  bobTail.visible = S.level >= 5 && !S.fab && isIn('needlePlate') && !isIn('darning') && bobbinOk();
}
function applyThreadColors() {
  S.bobColor = S.contrast ? (S.topColor === '#c9962b' ? '#26365e' : '#c9962b') : S.topColor;
  threadMat.color.set(S.topColor); bobThreadMat.color.set(S.bobColor); spool.children[1].material.color.set(S.topColor); bobbin.children[0].material.color.set(S.bobColor);
}
applyThreadColors();

// ---------- threading guide (manual p.8–9) ----------
const marker = new THREE.Mesh(new THREE.SphereGeometry(0.004, 16, 12), new THREE.MeshBasicMaterial({ color: 0x19b3a6, transparent: true, opacity: 0.85, depthTest: false }));
marker.renderOrder = 10; marker.raycast = () => {}; marker.visible = false; machine.add(marker);
const GT = { active: false, i: 0 };
const TSTEPS = [
  { t: 'Raise the needle and the presser foot', p: 'Turn the handwheel toward you until its mark points straight up, so the needle is at its highest. Raise the presser foot to open the tension discs. Switch the power off while you thread.', at: [0.192, 0.262, 0], lv: 0,
    run: async () => { await needleUp(); await setLifter(true); if (S.power) await P.power.run(); } },
  { t: 'Spool felt and thread spool', p: 'Put the felt on the spool pin, then the spool of thread on top of it.', at: [0, 0.345, -0.035], lv: 0,
    run: async () => { if (!isIn('felt')) { if (isIn('spool')) await doRemove(P.spool); await doInstall(P.felt); } if (!isIn('spool')) await doInstall(P.spool); } },
  { t: 'Upper thread guide', p: 'Draw the thread from the spool through the upper thread guide on top of the machine.', at: [-0.1, 0.305, -0.028], lv: 1 },
  { t: 'Tension module', p: 'Lead the thread down the right channel, around the bottom and up the left channel. It helps to hold the thread between the spool and the guide while you do this.', at: [-0.09, 0.16, 0.072], lv: 2 },
  { t: 'Take-up lever', p: 'At the top, pass the thread from right to left through the slotted eye of the take-up lever, then down again.', at: 'takeup', lv: 3 },
  { t: 'Thread the needle', p: 'Pass the thread behind the thin wire guide on the needle clamp, then thread the needle from front to back. Pull 6–8 in of thread to the back and trim it with the thread cutter.', at: 'needle', lv: 4,
    need: () => !isIn('needle') || S.needleBroken ? 'Install a needle first (Parts tab).' : null },
  { t: 'Raise the bobbin thread', p: 'Hold the upper thread, turn the handwheel toward you one full turn, then pull the upper thread to bring the bobbin thread up through the needle plate. Lay both threads to the back under the presser foot.', at: [-0.12, 0.09, 0.012], lv: 5,
    need: () => !bobbinOk() ? 'Load the bobbin and bobbin case first (Parts tab).' : null, run: async () => { const a = S.theta; await tween(0.9, k => S.theta = a + TAU * k); } },
];
async function gtEnter(i) {
  const st = TSTEPS[i], why = st.need && st.need(); if (why) { toast(why); return; }
  busy = true; handling++; try { if (st.run) await st.run(); } finally { handling--; busy = false; }
  S.level = Math.max(Math.min(S.level, st.lv), st.lv); GT.i = i; GT.active = true; showGT(); refresh();
}
function showGT() {
  const st = TSTEPS[GT.i], last = GT.i === TSTEPS.length - 1;
  setInfo(st.t, `Threading · manual p.${last ? 9 : 8} · step ${GT.i + 1} of ${TSTEPS.length}`, st.p,
    [['Back', gtBack], [last ? 'Finish' : 'Next', gtNext, 'primary'], ['Exit', () => gtExit(false)]], true);
  marker.visible = true;
}
async function gtNext() { if (busy) return; if (GT.i === TSTEPS.length - 1) return gtExit(true); await gtEnter(GT.i + 1); }
function gtBack() { if (busy || GT.i === 0) return; GT.i--; S.level = TSTEPS[GT.i].lv; showGT(); refresh(); }
function gtExit(done) { GT.active = false; marker.visible = false;
  setInfo(done ? 'Machine threaded' : 'Threading paused', '', done ? 'Upper and bobbin threads are ready. Switch the power back on, choose a fabric in the Sew tab and click Place fabric.' : 'Start Guided threading again from the Sew tab whenever you are ready.', null, true); }
async function startThreading() {
  if (busy || S.pressure > 0.05) return; sheetAway(); if (S.fab) { toast('Take the fabric out first (Remove the work).'); return; }
  S.level = 0; await gtEnter(0);
}
async function threadNow() {
  if (busy || S.pressure > 0.05) return; sheetAway(); busy = true; handling++;
  try {
    if (GT.active) gtExit(false); await needleUp();
    if (!isIn('felt')) { if (isIn('spool')) await doRemove(P.spool); await doInstall(P.felt); }
    if (!isIn('spool')) await doInstall(P.spool);
    if (!isIn('needle') || S.needleBroken) { S.level = 3; toast('Threaded down to the take-up lever. Install a needle to finish.'); }
    else if (!bobbinOk()) { S.level = 4; toast('Upper thread is done. Load a bobbin (Parts tab) before sewing.'); }
    else { S.level = 5; toast('Machine threaded: upper thread and bobbin thread.'); }
  } finally { handling--; busy = false; refresh(); }
}

// ---------- dials ----------
async function setStitch(n) {
  if (n === S.stitch) return;
  if (S.fab && isNeedleDown()) { toast('Raise the needle before turning the pattern dial (manual p.15).'); refresh(); return; }
  S.stitch = n; const a = dial.rotation.z, b = -n * Math.PI / 6; await tween(0.3, k => dial.rotation.z = a + (b - a) * k);
  tthrottle('st', 'Stitch: ' + STITCHES[n], 400); refresh();
}
async function setTension(t) { t = Math.max(0, Math.min(9, t)); S.tension = t; const a = tension.rotation.x, b = t * Math.PI / 5; refresh(); await tween(0.2, k => tension.rotation.x = a + (b - a) * k); }
tension.rotation.x = S.tension * Math.PI / 5; dial.rotation.z = -S.stitch * Math.PI / 6;

// ---------- fabric in / out ----------
const camTo = (pos, tgt, d = 0.8) => { const p0 = camera.position.clone(), t0 = controls.target.clone(); return tween(d, k => { camera.position.lerpVectors(p0, pos, k); controls.target.lerpVectors(t0, tgt, k); }); };
function sewingView() { const n = machine.localToWorld(V(NEEDLE_X, 0.087, NEEDLE_Z)); camTo(n.clone().add(V(-0.035, 0.17, 0.3).multiplyScalar(camera.aspect < 0.8 ? 1.8 : camera.aspect < 1.3 ? 1.3 : 1)), n.clone().add(V(0.01, 0, 0.012))); }
async function placeFabric() {
  if (busy || S.pressure > 0.05) return; sheetAway(); busy = true; handling++;
  try {
    if (S.fab) await removeWorkInner();
    if (GT.active) gtExit(false);
    await needleUp(); await setLifter(true);
    const f = new Fabric({ ...FO, seed: Math.floor(Math.random() * 1e9) }); S.fab = f;
    const g = f.guide ? f.guide[0] : [f.W / 2 - SEAM, -f.D / 2 + 0.015], tx = NEEDLE_X - g[0], tz = NEEDLE_Z - g[1];
    f.x = tx; f.z = tz + 0.2; f.update(); sewingView();
    await tween(0.8, k => { f.z = tz + 0.2 * (1 - k); });
    S.stitchIdx = 0; S.spec = stitchSpec(S.stitch, 0); S.swingFrom = S.swingTo = S.spec.dx;
    showThumbs(f); showExercise(f);
  } finally { handling--; busy = false; refresh(); }
}
function showExercise(f) {
  const ex = EXERCISES[f.ex], div = document.createElement('div');
  div.append(ex.text, document.createElement('br'), document.createElement('br'), 'When the needle is lined up, lower the presser foot (F) and hold Space to sew.');
  setInfo(ex.name, `${f.f.name} · ${PRINTS[f.o.print]} · manual p.12–13`, div, [['Sewing view', sewingView], ['Remove the work', removeWork]], true);
}
async function removeWorkInner() {
  const f = S.fab; if (!f) return; handling++;
  try {
    await needleUp(); await setLifter(true);
    const x0 = f.x, z0 = f.z; await tween(0.6, k => { f.x = x0 - 0.04 * k; f.z = z0 - 0.07 * k; });
    S.cutUntil = performance.now() + 700; await tween(0.7, () => {});
    f.cut(); f.report = evaluate(f);
    S.fab = null; f.mode = 'flat'; S.samples.push(f); if (S.samples.length > 3) S.samples.shift().dispose();
    const slot = i => [0.47 + 0.035 * i, 0.15 + 0.015 * i, 0.0036 + 0.0008 * i];
    S.samples.forEach((s, i) => { if (s !== f) { [s.x, s.z, s.y] = slot(i); s.update(); } });
    const [tx, tz, ty] = slot(S.samples.length - 1), sx = f.x, sz = f.z, sr = f.r, sy = 0.089, tr = Math.round(sr / TAU) * TAU;
    await tween(0.9, k => { f.x = sx + (tx - sx) * k; f.z = sz + (tz - sz) * k; f.r = sr + (tr - sr) * k; f.y = sy + (ty - sy) * k + Math.sin(Math.PI * k) * 0.36; f.update(); });
    showReport(f); showThumbs(f);
  } finally { handling--; refresh(); }
}
async function removeWork() { if (busy || !S.fab) return; busy = true; try { await removeWorkInner(); } finally { busy = false; } }
async function needleToggle() {
  if (busy || S.pressure > 0.05) return; busy = true;
  try { const a = S.theta; let b; if (isNeedleDown()) b = Math.ceil(a / TAU) * TAU; else { b = Math.floor(a / TAU + 0.5) * TAU + Math.PI; if (b <= a) b += TAU; }
    await tween(0.45, k => S.theta = a + (b - a) * k); } finally { busy = false; }
}

// ---------- evaluation ----------
function evaluate(f) {
  const hs = f.holes, lk = hs.filter(h => h.lock), rows = [], tips = []; let grade = null;
  rows.push(['Stitches', String(lk.length) + (hs.length > lk.length ? ` (+${hs.length - lk.length} empty holes)` : '')]);
  const rev = lk.filter(h => h.rev).length; if (rev) rows.push(['Reverse stitches', String(rev)]);
  if (f.guide) {
    const sc = scoreGuide(f.guide, lk.map(h => [h.clx, h.clz]));
    rows.push(['Chalk line covered', Math.round(sc.coverage * 100) + '%']);
    if (sc.avgMm !== null) { rows.push(['Average distance from line', sc.avgMm.toFixed(1) + ' mm']); rows.push(['Stitches within 2 mm', Math.round(sc.within2 * 100) + '%']); }
    grade = gradeOf(sc);
    if (sc.avgMm !== null && sc.avgMm > 3) tips.push('Watch the fabric edge against the seam guide lines on the needle plate, not the needle itself.');
    if (sc.coverage < 0.85) tips.push('Sew the whole chalk line, from the start dot to the X.');
  }
  if (f.ex !== 'free' && lk.length > 6) {
    const a = lk.slice(0, 12).some(h => h.rev), b = lk.slice(-12).some(h => h.rev);
    rows.push(['Backstitch at start', a ? '✓' : '✗']); rows.push(['Backstitch at end', b ? '✓' : '✗']);
    if (!a || !b) tips.push('Lock both ends: sew 3–4 stitches, hold Reverse for 3–4 stitches, then continue (manual p.13).');
  }
  if (lk.length) {
    const loose = lk.filter(h => tensionState(h.ten, h.pat) === 'loose').length / lk.length, tight = lk.filter(h => tensionState(h.ten, h.pat) === 'tight').length / lk.length;
    rows.push(['Thread tension', loose > 0.2 ? 'Too loose' : tight > 0.2 ? 'Too tight' : 'Balanced']);
    if (loose > 0.2) tips.push('Tension too loose: upper thread loops show on the underside. Turn the tension dial to a higher number.');
    if (tight > 0.2) tips.push('Tension too tight: the bobbin thread is pulled up to the top and the seam can pucker. Turn the dial lower; 3–5 covers 90% of sewing.');
  }
  const fb = f.f, nOk = S.nsize >= fb.rec[0] && S.nsize <= fb.rec[1];
  rows.push(['Needle', `Size ${S.nsize}${nOk ? ' ✓' : ' ✗'}`]);
  if (f.ex === 'edge' && lk.length && !lk.some(h => h.pat >= 6 && h.pat <= 8)) tips.push('Edge finishing needs a zigzag stitch. Turn the pattern dial to the wide zigzag.');
  if (f.flags.nest) tips.push('Thread nest under the fabric: the presser foot was up while sewing. Lower the foot before pressing the pedal.');
  if (f.flags.skip) tips.push('Skipped stitches: use a ball point needle (Singer 2045) on knits.');
  if (f.flags.broke) tips.push('A needle broke. Match the needle size to the fabric, and never pull the fabric while stitching.');
  if (f.flags.noThread || f.flags.noBobbin) tips.push('Some holes have no stitches. Thread the machine and load the bobbin before sewing.');
  if (!tips.length && lk.length) tips.push('Nice work. Try another exercise or a different fabric.');
  return { grade, rows, tips };
}
function showReport(f) {
  const r = f.report || evaluate(f), div = document.createElement('div');
  if (r.grade) { const g = document.createElement('span'); g.className = 'grade'; g.textContent = r.grade; div.append(g); }
  const tb = document.createElement('table'); for (const [a, b] of r.rows) { const tr = tb.insertRow(); tr.insertCell().textContent = a; tr.insertCell().textContent = b; } div.append(tb);
  const ul = document.createElement('ul'); for (const t of r.tips) { const li = document.createElement('li'); li.textContent = t; ul.append(li); } div.append(ul);
  setInfo('Results: ' + EXERCISES[f.ex].name, `${f.f.name} · ${PRINTS[f.o.print]}`, div, [['Sew another', placeFabric, 'primary']], true);
}

// ---------- motor sound ----------
let audio = null;
function ensureAudio() {
  if (audio || !S.sound) return;
  try { const C = new (window.AudioContext || window.webkitAudioContext)(), o = C.createOscillator(), o2 = C.createOscillator(), fl = C.createBiquadFilter(), g = C.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; fl.type = 'lowpass'; fl.frequency.value = 520; g.gain.value = 0; o.connect(fl); o2.connect(fl); fl.connect(g).connect(C.destination); o.start(); o2.start(); audio = { o, o2, g }; } catch (e) { audio = null; }
}
function pedalDown() { ensureAudio(); const why = runBlock(); if (why) { tthrottle('rb', why); return; } S.pedalHeld = true; }
function pedalUp() { S.pedalHeld = false; }

// ---------- sewing UI ----------
function setInfo(title, ref, body, buttons, open) {
  if (open && document.body.classList.contains('ic')) { document.body.classList.remove('ic'); syncUIButtons(); }
  $('iT').textContent = title; $('iR').textContent = ref || ''; const iP = $('iP'); iP.replaceChildren(body);
  const iB = $('iB'); iB.replaceChildren(); for (const [label, fn, cls] of buttons || []) { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; iB.append(b); }
  iB.style.display = buttons && buttons.length ? 'flex' : 'none';
}
function showThumbs(f) {
  S.viewFab = f; const t = $('thumbs'); t.hidden = !f; if (!f) return;
  const mk = (c, cls, cap) => { const d = document.createElement('div'); d.className = 'th ' + cls; const s = document.createElement('span'); s.textContent = cap; d.append(c, s); return d; };
  t.replaceChildren(mk(f.top.canvas, 'top', 'Top'), mk(f.bot.canvas, 'bot', 'Underside'));
}
$('thumbs').onclick = () => $('thumbs').classList.toggle('big');
const mkEl = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v); } e.append(...kids); return e; };
const mkSel = (opts, val, onch) => { const s = mkEl('select'); for (const [v, t] of opts) s.append(mkEl('option', { value: v }, t)); s.value = val; s.onchange = () => onch(s.value); return s; };
const fld = (label, ctl) => mkEl('label', { class: 'fld' }, mkEl('span', {}, label), ctl);
const UI = {};
function swatches(list, cur, on) { const d = mkEl('div', { class: 'sw' }); for (const [name, hex] of list) { const b = mkEl('button', { title: name, 'aria-label': name }); b.style.background = hex; b.dataset.v = hex; b.onclick = () => { on(hex); for (const c of d.children) c.classList.toggle('on', c.dataset.v === hex); }; if (hex === cur) b.classList.add('on'); d.append(b); } return d; }
{
  const t = $('sewTab');
  UI.chk = mkEl('div', { class: 'chk' });
  UI.stitch = mkSel(STITCHES.map((s, i) => [i, s]), S.stitch, v => setStitch(+v));
  UI.tval = mkEl('b', {}, String(S.tension));
  const tens = mkEl('span', { class: 'step' }, mkEl('button', { onclick: () => setTension(S.tension - 1), 'aria-label': 'Lower tension' }, '−'), UI.tval, mkEl('button', { onclick: () => setTension(S.tension + 1), 'aria-label': 'Higher tension' }, '+'));
  UI.contrast = mkEl('input', { type: 'checkbox' }); UI.contrast.onchange = () => { S.contrast = UI.contrast.checked; applyThreadColors(); };
  UI.ftype = mkSel(Object.entries(FABRICS).map(([k, v]) => [k, v.name]), FO.type, v => { FO.type = v; [FO.print, FO.color] = TYPE_DEF[v]; UI.print.value = FO.print; for (const c of UI.fsw.children) c.classList.toggle('on', c.dataset.v === FO.color); needleHint(); });
  UI.print = mkSel(Object.entries(PRINTS), FO.print, v => FO.print = v);
  UI.fsw = swatches(FCOLORS.map(c => [c, c]), FO.color, c => FO.color = c);
  UI.nsize = mkSel(NEEDLES.map(n => [n, `Size ${n} (${[70, 80, 90, 100, 110][NEEDLES.indexOf(n)]})`]), S.nsize, v => { S.nsize = +v; needleHint(); if (isIn('needle')) tthrottle('ns', `Fitted a size ${v} needle.`); });
  UI.ntype = mkSel(Object.entries(NTYPES), S.ntype, v => { S.ntype = v; needleHint(); });
  UI.nhint = mkEl('div', { class: 'hint' });
  UI.ex = mkSel(Object.entries(EXERCISES).map(([k, v]) => [k, v.name]), FO.ex, v => { FO.ex = v; UI.exhint.textContent = EXERCISES[v].text; });
  UI.exhint = mkEl('div', { class: 'hint' }, EXERCISES[FO.ex].text);
  UI.place = mkEl('button', { class: 'primary', onclick: placeFabric }, 'Place fabric');
  UI.remove = mkEl('button', { onclick: removeWork }, 'Remove the work');
  t.append(
    mkEl('h2', {}, 'Ready to sew'), UI.chk,
    mkEl('h2', {}, 'Thread'), mkEl('div', { class: 'two' }, mkEl('button', { onclick: startThreading }, 'Guided threading'), mkEl('button', { onclick: threadNow }, 'Thread instantly')),
    swatches(THREADS, S.topColor, c => { S.topColor = c; applyThreadColors(); }),
    mkEl('label', { class: 'ck' }, UI.contrast, ' Contrasting bobbin thread (makes tension problems easy to see)'),
    mkEl('h2', {}, 'Stitch'), fld('Pattern', UI.stitch), fld('Upper tension', tens),
    mkEl('h2', {}, 'Fabric'), fld('Fabric', UI.ftype), fld('Print', UI.print), UI.fsw,
    fld('Needle size', UI.nsize), fld('Needle type', UI.ntype), UI.nhint,
    fld('Exercise', UI.ex), UI.exhint, mkEl('div', { class: 'two' }, UI.place, UI.remove),
    mkEl('h2', {}, 'Controls'),
    mkEl("div", { class: "keys" }));
  t.lastChild.innerHTML = '<kbd>Space</kbd> hold: foot pedal<br><kbd>R</kbd> hold: reverse<br><kbd>F</kbd> presser foot up / down<br><kbd>N</kbd> needle down / up (handwheel)<br><kbd>←</kbd> <kbd>→</kbd> while sewing: guide the fabric<br>Foot up: arrows slide the fabric, <kbd>Q</kbd> <kbd>E</kbd> pivot (needle down pivots on the needle)<br>Darning plate on: arrows move the fabric freely<br><kbd>V</kbd> sewing view · <kbd>Esc</kbd> stop';
  needleHint();
}
function needleHint() {
  const f = FABRICS[FO.type], { size: okS, type: okT } = needleMatch(FO.type, S.nsize, S.ntype);
  UI.nhint.textContent = `For ${f.name.toLowerCase()}: size ${f.rec[0]}–${f.rec[1]}, ${f.knit ? 'ball point (2045)' : 'universal (2020)'}. ` + (okS && okT ? '✓ Good match.' : '⚠ Not the recommended needle.');
  UI.nhint.classList.toggle('warn', !(okS && okT));
}
const CHECKS = [['Power on', () => S.power], ['Sewing position', () => !S.winder], ['Needle in', () => isIn('needle') && !S.needleBroken], ['Presser foot on', footOn],
  ['Needle plate on', () => isIn('needlePlate')], ['Bobbin loaded', bobbinOk], ['Upper thread', () => S.level >= 4], ['Bobbin thread up', () => S.level >= 5],
  ['Fabric placed', () => !!S.fab], ['Foot lowered', () => S.liftY < 0.001]];
let chkSig = '';
function refreshSew() {
  const sig = CHECKS.map(c => c[1]() ? 1 : 0).join('');
  if (sig !== chkSig) { chkSig = sig; UI.chk.replaceChildren(...CHECKS.map(([n], i) => mkEl('span', { class: sig[i] === '1' ? 'ok' : 'no' }, n))); }
  UI.stitch.value = S.stitch; UI.tval.textContent = S.tension; UI.remove.disabled = !S.fab;
}
function edgeDist(f) {
  const [lx, lz] = f.toLocal(nb.position.x, NEEDLE_Z); if (!f.inside(lx, lz)) return null;
  const dx = Math.cos(f.r), dz = Math.sin(f.r); let t = 1e9;
  if (dx > 1e-6) t = Math.min(t, (f.W / 2 - lx) / dx); if (dx < -1e-6) t = Math.min(t, (-f.W / 2 - lx) / dx);
  if (dz > 1e-6) t = Math.min(t, (f.D / 2 - lz) / dz); if (dz < -1e-6) t = Math.min(t, (-f.D / 2 - lz) / dz);
  return t;
}
let hudSig = '';
function hudUpdate() {
  const f = S.fab, rows = [['Stitch', STITCHES[S.stitch]], ['Tension', String(S.tension)], ['Needle', `${S.nsize} ${S.ntype === 'b2045' ? 'ball point' : S.ntype === 'l2032' ? 'leather' : 'universal'}${S.needleBroken ? ' (broken)' : isIn('needle') ? '' : ' (removed)'}`],
    ['Speed', Math.round(S.pressure * S.rate / TAU * 60) + ' stitches/min'], ['Presser foot', S.liftY > 0.001 ? 'Up' : 'Down'], ['Needle', isNeedleDown() ? 'Down' : 'Up']];
  if (f) { rows.push(['Stitches sewn', String(f.holes.filter(h => h.lock).length)]);
    const e = edgeDist(f); if (e !== null) rows.push(['Needle → right edge', `${(e * 1000).toFixed(1)} mm (${fmtIn(e * 1000)})`]);
    if (f.guide) { const [lx, lz] = f.toLocal(NEEDLE_X, NEEDLE_Z), d = guideNear(f.guide, lx, lz)[0]; rows.push(['Off the chalk line', d > 0.03 ? '—' : (d * 1000).toFixed(1) + ' mm']); } }
  const sig = rows.join('|'); if (sig === hudSig) return; hudSig = sig;
  $('hudRows').replaceChildren(...rows.map(([a, b]) => mkEl('div', {}, mkEl('span', {}, a), mkEl('b', {}, b))));
}
// sewing bar
$('sbSew').addEventListener('pointerdown', e => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} pedalDown(); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) { $('sbSew').addEventListener(ev, pedalUp); $('sbRev').addEventListener(ev, () => S.revHeld = false); }
$('sbRev').addEventListener('pointerdown', e => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} S.revHeld = true; });
$('sbFoot').onclick = () => { if (!busy) setLifter(!S.lifter).then(refresh); };
$('sbNeedle').onclick = needleToggle; $('sbView').onclick = sewingView;
$('sbSound').onclick = e => { S.sound = !S.sound; e.currentTarget.textContent = S.sound ? 'Sound on' : 'Sound off'; if (S.sound) ensureAudio(); };
$('sbSpeed').oninput = e => S.rate = +e.target.value;
for (const b of document.querySelectorAll('#sewbar [data-key]')) {
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} keys[b.dataset.key] = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => keys[b.dataset.key] = false);
}
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,select,textarea')) return;
  if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  const c = e.code;
  if (c === 'Space') { e.preventDefault(); if (!e.repeat) pedalDown(); return; }
  if (c.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) { keys[c] = true; return; }
  if (c === 'KeyR') S.revHeld = true;
  else if (c === 'KeyF') { if (!busy) setLifter(!S.lifter).then(refresh); }
  else if (c === 'KeyN') needleToggle();
  else if (c === 'KeyV') sewingView();
  else if (c === 'Escape') { S.pedalHeld = false; S.running = false; }
  keys[c] = true;
});
addEventListener('keyup', e => { if (e.code === 'Space') { e.preventDefault(); pedalUp(); } if (e.code === 'KeyR') S.revHeld = false; keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; S.pedalHeld = false; S.revHeld = false; });
for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => { for (const x of document.querySelectorAll('.tabs button')) x.classList.toggle('on', x === b); $('partsTab').hidden = b.id !== 'tabParts'; $('sewTab').hidden = b.id !== 'tabSew'; };


// ---------- lighting ----------
const LIGHT = { room: 0.65, lamp: 0.4 };
try { const v = JSON.parse(localStorage.getItem('m1500-light') || 'null'); if (v) Object.assign(LIGHT, v); } catch (_) {}
function applyLights() {
  hemi.intensity = 0.7 * LIGHT.room; sun.intensity = 2.2 * LIGHT.room; scene.environmentIntensity = 0.55 * LIGHT.room;
  ledLight.intensity = S.power ? 0.008 * LIGHT.lamp : 0; M.led.emissiveIntensity = S.power ? 0.4 + 2.6 * LIGHT.lamp : 0;
  for (const el of document.querySelectorAll('[data-light]')) { const k = el.dataset.light; if (+el.value !== Math.round(LIGHT[k] * 100)) el.value = Math.round(LIGHT[k] * 100); }
  for (const el of document.querySelectorAll('[data-lightval]')) el.textContent = Math.round(LIGHT[el.dataset.lightval] * 100) + '%';
}
function lightSlider(k, max) { const r = mkEl('input', { type: 'range', min: '0', max: String(max), value: String(Math.round(LIGHT[k] * 100)), 'data-light': k, 'aria-label': k === 'room' ? 'Room light' : 'Sewing lamp' });
  r.oninput = () => { LIGHT[k] = r.value / 100; applyLights(); try { localStorage.setItem('m1500-light', JSON.stringify(LIGHT)); } catch (_) {} }; return r; }
{ const t = $('sewTab'), h = [...t.querySelectorAll('h2')].find(x => x.textContent === 'Controls');
  const row = (label, k, max) => mkEl('label', { class: 'fld' }, mkEl('span', {}, label), mkEl('span', { class: 'step' }, lightSlider(k, max), mkEl('b', { 'data-lightval': k })));
  t.insertBefore(mkEl('h2', {}, 'Lighting'), h);
  t.insertBefore(row('Room light', 'room', 150), h);
  t.insertBefore(row('Sewing lamp', 'lamp', 100), h);
  t.insertBefore(mkEl('div', { class: 'hint' }, 'The sewing lamp is the LED under the machine head; it lights up when the power switch is on.'), h);
  const sb = mkEl('label', { class: 'x', title: 'Room light' }, '☀', lightSlider('room', 150)); $('sbSound').before(sb); }
applyLights();

// ---------- responsive / touch layout ----------
const mqPhone = matchMedia('(max-width:760px)'), coarse = matchMedia('(pointer:coarse)').matches, BC = document.body.classList;
const isPhone = () => mqPhone.matches;
function syncUIButtons() {
  $('bInfo').textContent = BC.contains('ic') ? '▴' : '▾'; $('bInfo').setAttribute('aria-label', BC.contains('ic') ? 'Expand info' : 'Collapse info');
  $('hudHead').lastChild.textContent = BC.contains('hc') ? '▸' : '▾';
  $('sbMore').classList.toggle('on', !BC.contains('sc')); $('sbMore').setAttribute('aria-label', BC.contains('sc') ? 'More controls' : 'Fewer controls');
  $('bPanelClose').textContent = isPhone() ? '✕' : '›';
  const clean = BC.contains('clean'); $('bClean').classList.toggle('on', clean); $('bClean').setAttribute('aria-label', clean ? 'Show panels' : 'Hide all panels'); $('bClean').title = clean ? 'Show panels' : 'Hide all panels';
}
function setUI(cls, on) { BC.toggle(cls, on); syncUIButtons(); }
function sheetAway() { if (isPhone()) setUI('pc', true); }
$('bPanelClose').onclick = () => setUI('pc', true);
$('panelTab').onclick = () => { BC.remove('clean'); setUI('pc', false); };
$('iHead').onclick = () => setUI('ic', !BC.contains('ic'));
$('hudHead').onclick = () => setUI('hc', !BC.contains('hc'));
$('sbMore').onclick = () => setUI('sc', !BC.contains('sc'));
$('bClean').onclick = () => setUI('clean', !BC.contains('clean'));
$('sewbar').addEventListener('contextmenu', e => e.preventDefault());
if (coarse) $('panel').querySelector('header p').textContent = 'Sew tab: thread the machine, choose a fabric and practice. Parts tab: take the user parts on and off. One finger orbits, two fingers pan and pinch to zoom, tap a part to use it.';
if (isPhone()) BC.add('pc', 'hc', 'sc');
mqPhone.addEventListener('change', () => { if (isPhone()) BC.add('pc', 'sc'); syncUIButtons(); });
syncUIButtons();

// ---------- loop ----------
const timer = new THREE.Timer(); const tmp = new THREE.Vector3();
let lastTheta = 0, hudT = 0;
function frame(now) { timer.update(now); const dt = Math.min(timer.getDelta(), 0.05);
  for (let i = tweens.length - 1; i >= 0; i--) { const t = tweens[i]; t.t += dt * speed; const k = Math.min(1, t.t / t.d); t.fn(ease(k)); if (k >= 1) { tweens.splice(i, 1); t.res(); } }
  let want = S.pedalHeld ? 1 : S.running ? 0.7 : 0;
  if (want > 0) { const why = runBlock(); if (why) { tthrottle('rb', why); want = 0; S.pedalHeld = false; S.running = false; } }
  S.pressure += (want - S.pressure) * Math.min(1, dt * (want > S.pressure ? 4 : 9)); if (!want && S.pressure < 0.02) S.pressure = 0;
  S.theta += S.pressure * S.rate * dt;
  if (S.theta < lastTheta) { S.winG0 -= G(lastTheta) - G(S.theta); lastTheta = S.theta; }
  if (S.theta > lastTheta) { advance(lastTheta, S.theta); lastTheta = S.theta; }
  steer(dt);
  const pr = Math.max(0, Math.min(1, (G(S.theta) - S.winG0) / (2 * WIN))), sm = pr * pr * (3 - 2 * pr);
  handwheel.rotation.x = S.theta; nb.position.y = -0.014 * (1 - Math.cos(S.theta)); nb.position.x = NEEDLE_X + (S.swingFrom + (S.swingTo - S.swingFrom) * sm) / 1000;
  takeUp.position.y = 0.228 + 0.035 * Math.cos(S.theta + 1.1); pg.position.y = S.liftY + footRide();
  reverse.rotation.x += ((S.revHeld ? 0.45 : 0) - reverse.rotation.x) * Math.min(1, dt * 14); pedalTop.rotation.x = -0.22 + 0.16 * S.pressure;
  if (S.fab && S.fab.mode === 'machine') S.fab.update();
  for (const f of [S.fab, ...S.samples]) if (f && f.dirty) { f.topTex.needsUpdate = f.botTex.needsUpdate = true; f.dirty = false; }
  updateThread(now);
  if (marker.visible) { const st = TSTEPS[GT.i]; if (st.at === 'takeup') marker.position.set(-0.091, takeUp.position.y, 0.077); else if (st.at === 'needle') marker.position.set(nb.position.x, nb.position.y + 0.093, 0.016); else marker.position.set(...st.at); marker.scale.setScalar(1 + 0.25 * Math.sin(now / 160)); }
  if (audio) { const sp = S.pressure * S.rate; audio.o.frequency.value = 55 + sp * 7; audio.o2.frequency.value = sp / TAU * 2 + 1; audio.g.gain.value = S.sound ? Math.min(0.045, S.pressure * 0.05) : 0; }
  if (now - hudT > 150) { hudT = now; hudUpdate(); refreshSew(); }
  controls.update(); renderer.render(scene, camera);
  if (showLabels) for (const l of LABELS) { tmp.copy(l.v); machine.localToWorld(tmp).project(camera); l.el.style.left = (tmp.x + 1) / 2 * innerWidth + 'px'; l.el.style.top = (1 - tmp.y) / 2 * innerHeight + 'px'; l.el.style.visibility = tmp.z < 1 ? 'visible' : 'hidden'; }
  requestAnimationFrame(frame); }
refresh(); requestAnimationFrame(frame);
