/* Regression tests for the drawing, transform and quantization logic in
   asset-editor.tpl.html.  Run:  node test/editor.test.js  */
const a = require("./harness.js");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log("  FAIL: " + name + (extra !== undefined ? "  -> " + extra : "")); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got) + " != " + JSON.stringify(want)); }

const RGB = [255, 128, 0];
function fresh(w, h) { a.alloc(w, h); a.sel = null; return a.pix; }
const at = (x, y) => { const i = (y * a.W + x) * 4; return [a.pix[i], a.pix[i + 1], a.pix[i + 2], a.pix[i + 3]]; };
const opaqueCount = () => { let n = 0; for (let i = 3; i < a.pix.length; i += 4) if (a.pix[i]) n++; return n; };

/* ---------- color helpers ---------- */
eq("hex2rgb", a.hex2rgb("#ff8000"), [255, 128, 0]);
eq("hex2rgb no hash", a.hex2rgb("ff8000"), [255, 128, 0]);
eq("hex2rgb garbage is black", a.hex2rgb("nope"), [0, 0, 0]);
eq("rgb2hex", a.rgb2hex([255, 128, 0]), "#ff8000");
ok("isValidHex accepts", a.isValidHex("#0aF3b2"));
ok("isValidHex rejects short", !a.isValidHex("#fff"));
eq("q5 endpoints", [a.q5(0), a.q5(255)], [0, 255]);
eq("q4 endpoints", [a.q4(0), a.q4(255)], [0, 255]);
ok("q5 is 5-bit", new Set(Array.from({ length: 256 }, (_, i) => a.q5(i))).size === 32);
ok("q4 is 4-bit", new Set(Array.from({ length: 256 }, (_, i) => a.q4(i))).size === 16);
eq("nearestIn picks closest", a.nearestIn([[0, 0, 0], [255, 255, 255]], 200, 200, 200), [255, 255, 255]);

/* ---------- pen strokes are continuous ---------- */
fresh(64, 48);
a.lineTo(2, 3, 40, 25, false, RGB);
const pts = [];
for (let y = 0; y < a.H; y++) for (let x = 0; x < a.W; x++) if (at(x, y)[3]) pts.push([x, y]);
ok("line touches both ends", at(2, 3)[3] === 255 && at(40, 25)[3] === 255);
let gapped = false;
pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
for (let i = 1; i < pts.length; i++) {
  const d = Math.max(Math.abs(pts[i][0] - pts[i - 1][0]), Math.abs(pts[i][1] - pts[i - 1][1]));
  if (d > 1) gapped = true;
}
ok("line has no gaps (fast drags stay connected)", !gapped);
eq("line color is what was asked for", at(2, 3), [255, 128, 0, 255]);

/* brush size stamps a block */
fresh(20, 20); a.brush = 3; a.stamp(10, 10, false, RGB);
eq("brush 3 covers 9 px", opaqueCount(), 9);
a.brush = 1; fresh(20, 20); a.stamp(10, 10, false, RGB);
eq("brush 1 covers 1 px", opaqueCount(), 1);

/* out-of-bounds writes are ignored, not wrapped */
fresh(8, 8); a.brush = 1;
a.setPx(-1, 0, false, RGB); a.setPx(0, -1, false, RGB);
a.setPx(8, 0, false, RGB); a.setPx(0, 8, false, RGB);
eq("off-canvas draws are dropped", opaqueCount(), 0);

/* ---------- flood fill ---------- */
fresh(16, 16);
a.floodFill(0, 0, false, RGB, false);
eq("fill covers an empty canvas", opaqueCount(), 256);

fresh(16, 16);
a.drawRect(4, 4, 11, 11, false, [0, 0, 255], false);   /* a closed outline */
const before = opaqueCount();
a.floodFill(8, 8, false, RGB, false);
eq("fill respects a closed border", opaqueCount() - before, 36);   /* the 6x6 interior */
eq("fill did not leak outside", at(0, 0)[3], 0);

/* transparent pixels with stale RGB still count as one region */
fresh(8, 8);
for (let i = 0; i < a.pix.length; i += 4) { a.pix[i] = i % 251; a.pix[i + 1] = 9; a.pix[i + 2] = 3; a.pix[i + 3] = 0; }
a.floodFill(0, 0, false, RGB, false);
eq("fill treats all transparent pixels alike", opaqueCount(), 64);

/* global replace */
fresh(10, 10);
a.setPx(0, 0, false, [10, 20, 30]); a.setPx(9, 9, false, [10, 20, 30]);
a.floodFill(0, 0, false, RGB, true);
ok("shift+fill replaces that color everywhere", at(9, 9)[0] === 255 && at(0, 0)[0] === 255);

eq("keyAt: transparent is a single key", (fresh(2, 2), a.keyAt(0)), -1);

/* fill onto its own color is a no-op (and must not hang) */
fresh(8, 8); a.floodFill(0, 0, true, RGB, false);
eq("erasing empty space does nothing", opaqueCount(), 0);

/* ---------- shapes ---------- */
fresh(16, 16); a.drawRect(2, 2, 6, 6, false, RGB, true);
eq("filled rect area", opaqueCount(), 25);
fresh(16, 16); a.drawRect(2, 2, 6, 6, false, RGB, false);
eq("rect outline area", opaqueCount(), 16);
fresh(16, 16); a.drawEllipse(0, 0, 10, 10, false, RGB, true);
const ell = opaqueCount();
ok("filled ellipse is round-ish", ell > 70 && ell < 110, ell);
eq("ellipse leaves its corners empty", at(0, 0)[3], 0);

/* ---------- selection, clipboard, transforms ---------- */
fresh(8, 8);
a.setPx(1, 1, false, [1, 2, 3]);
const buf = a.extract({ x: 0, y: 0, w: 4, h: 4 });
eq("extract size", [buf.w, buf.h], [4, 4]);
a.clearRegion({ x: 0, y: 0, w: 4, h: 4 });
eq("clearRegion empties it", opaqueCount(), 0);
a.blit(buf, 4, 4, true);
eq("blit lands at the offset", at(5, 5), [1, 2, 3, 255]);
eq("blit with skipTransparent leaves the rest alone", at(4, 4)[3], 0);

/* blit clips instead of wrapping */
fresh(8, 8);
a.blit({ w: 4, h: 4, data: new Uint8ClampedArray(64).fill(255) }, 6, 6, false);
eq("blit clips at the edge", opaqueCount(), 4);

fresh(4, 4);
a.setPx(0, 0, false, [9, 9, 9]);
a.sel = null;
a.transformRegion("flipH");
eq("flipH moves the pixel to the far side", at(3, 0), [9, 9, 9, 255]);
a.transformRegion("flipV");
eq("flipV moves it down", at(3, 3), [9, 9, 9, 255]);
a.transformRegion("rot180");
eq("rot180 brings it home", at(0, 0), [9, 9, 9, 255]);

/* transforms honour a selection */
fresh(8, 8);
a.setPx(0, 0, false, [5, 5, 5]); a.setPx(7, 7, false, [6, 6, 6]);
a.sel = { x: 0, y: 0, w: 4, h: 4 };
a.transformRegion("flipH");
eq("flip inside the selection", at(3, 0), [5, 5, 5, 255]);
eq("flip left the outside alone", at(7, 7), [6, 6, 6, 255]);
a.sel = null;

/* rot90 */
fresh(4, 2);
a.setPx(0, 0, false, [7, 7, 7]);
a.rot90();
eq("rot90 swaps the canvas dims", [a.W, a.H], [2, 4]);
eq("rot90 maps the top-left to the top-right", at(1, 0), [7, 7, 7, 255]);

/* nudge wraps with no selection */
fresh(4, 4);
a.setPx(3, 0, false, [4, 4, 4]);
a.nudge(1, 0);
eq("nudge wraps around for seamless tiles", at(0, 0), [4, 4, 4, 255]);
/* nudge with a selection does not wrap */
fresh(4, 4);
a.setPx(0, 0, false, [4, 4, 4]);
a.sel = { x: 0, y: 0, w: 2, h: 2 };
a.nudge(1, 0);
eq("selection nudge moves the block", at(1, 0), [4, 4, 4, 255]);
eq("selection nudge clears the source", at(0, 0)[3], 0);
a.sel = null;

/* ---------- resize / crop / trim ---------- */
fresh(8, 8);
a.setPx(0, 0, false, [1, 1, 1]); a.setPx(7, 7, false, [2, 2, 2]);
a.resizeTo(4, 4, "tl");
eq("shrink keeps the top-left anchor", at(0, 0), [1, 1, 1, 255]);
eq("shrink drops what falls outside", opaqueCount(), 1);
a.resizeTo(8, 8, "br");
eq("grow with a bottom-right anchor", at(4, 4), [1, 1, 1, 255]);
a.resizeTo(8, 8, "tl");   /* no-op path */
eq("resize to the same size is a no-op", [a.W, a.H], [8, 8]);

fresh(16, 16);
a.drawRect(4, 5, 9, 11, false, RGB, true);
eq("opaqueBounds finds the content", a.opaqueBounds(), { x: 4, y: 5, w: 6, h: 7 });
a.cropTo(a.opaqueBounds());
eq("trim crops to the content", [a.W, a.H], [6, 7]);
eq("trim keeps every opaque pixel", opaqueCount(), 42);

fresh(4, 4);
eq("opaqueBounds on an empty canvas", a.opaqueBounds(), null);

/* ---------- quantization ---------- */
const many = Array.from({ length: 200 }, (_, i) => [i, (i * 7) % 256, (i * 13) % 256]);
eq("medianCut hits the target count", a.medianCut(many, 16).length, 16);
eq("medianCut passes small sets through", a.medianCut([[1, 2, 3], [4, 5, 6]], 16).length, 2);
eq("medianCut can go down to 15", a.medianCut(many, 15).length, 15);

/* CI4: a noisy image must come back within the palette budget */
fresh(32, 32);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++)
  a.setPx(x, y, false, [(x * 8) & 255, (y * 8) & 255, ((x + y) * 4) & 255]);
let info = a.analyze();
ok("test image really is over budget", info.colors.length > 16, info.colors.length);
let baked = a.bakeCompute("ci4", true);
let uniq = new Set();
for (let i = 0; i < baked.length; i += 4) if (baked[i + 3]) uniq.add((baked[i] << 16) | (baked[i + 1] << 8) | baked[i + 2]);
ok("CI4 bake fits 16 entries", uniq.size <= 16, uniq.size);
ok("CI4 bake is 5-bit per channel", [...uniq].every(k => {
  const r = k >> 16 & 255, g = k >> 8 & 255, b = k & 255;
  return a.q5(r) === r && a.q5(g) === g && a.q5(b) === b;
}));

/* with transparency present, one palette entry is reserved */
fresh(32, 32);
for (let y = 0; y < 32; y++) for (let x = 0; x < 31; x++)
  a.setPx(x, y, false, [(x * 8) & 255, (y * 8) & 255, ((x + y) * 4) & 255]);
baked = a.bakeCompute("ci4", true);
uniq = new Set();
for (let i = 0; i < baked.length; i += 4) if (baked[i + 3]) uniq.add((baked[i] << 16) | (baked[i + 1] << 8) | baked[i + 2]);
ok("CI4 with transparency fits 15 entries", uniq.size <= 15, uniq.size);
let keptTransparent = true;
for (let y = 0; y < 32; y++) if (baked[(y * 32 + 31) * 4 + 3] !== 0) keptTransparent = false;
ok("CI4 bake keeps transparent pixels transparent", keptTransparent);

/* an in-budget image must survive a bake untouched */
fresh(16, 16);
const few = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]].map(c => [a.q5(c[0]), a.q5(c[1]), a.q5(c[2])]);
for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) a.setPx(x, y, false, few[(x + y) % 4]);
baked = a.bakeCompute("ci4", true);
let same = true;
for (let i = 0; i < baked.length; i++) if (baked[i] !== a.pix[i]) same = false;
ok("a 4-color image bakes to itself", same);

/* IA8 */
fresh(8, 8);
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) a.setPx(x, y, false, [x * 30, y * 30, 120]);
a.pix[3] = 128;                                   /* one half-transparent pixel */
baked = a.bakeCompute("ia8", false);
let gray = true, alphaQ = true;
for (let i = 0; i < baked.length; i += 4) {
  if (baked[i + 3] === 0) continue;
  if (baked[i] !== baked[i + 1] || baked[i + 1] !== baked[i + 2]) gray = false;
  if (a.q4(baked[i + 3]) !== baked[i + 3]) alphaQ = false;
}
ok("IA8 output is grayscale", gray);
ok("IA8 keeps 4-bit alpha", alphaQ);

/* RGBA32 is lossless */
fresh(8, 8);
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) a.setPx(x, y, false, [x * 31, y * 17, 200]);
baked = a.bakeCompute("rgba32", true);
same = true;
for (let i = 0; i < baked.length; i++) if (baked[i] !== a.pix[i]) same = false;
ok("RGBA32 changes nothing, even with dither on", same);

/* dither on/off actually differs on a gradient */
fresh(32, 32);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) a.setPx(x, y, false, [x * 8, x * 8, x * 8]);
const d1 = a.bakeCompute("ci4", true), d0 = a.bakeCompute("ci4", false);
ok("dither changes the result", d1.some((v, i) => v !== d0[i]));

/* empty canvas bakes without throwing */
fresh(8, 8);
ok("empty canvas bakes cleanly", a.bakeCompute("ci4", true).every(v => v === 0));
eq("analyze on an empty canvas", a.analyze().colors.length, 0);

/* ---------- zoom fit ---------- */
/* the fit must use the space the viewport allows, not the canvas element's
   default 300x150, or every asset opens at 3x */
a.alloc(64, 48); a.zoomFit();
ok("64x48 fits at a usable zoom", a.ZOOM >= 12 && a.ZOOM <= 14, a.ZOOM);
a.alloc(128, 24); a.zoomFit();
ok("a wide asset fits on width", a.ZOOM >= 6 && a.ZOOM <= 7, a.ZOOM);
a.alloc(1, 1); a.zoomFit();
eq("tiny canvases stop at the zoom cap", a.ZOOM, 48);
a.alloc(512, 512); a.zoomFit();
ok("huge canvases never go below 1x", a.ZOOM >= 1, a.ZOOM);

/* ---------- animation frame detection ---------- */
eq("anim: base<n>_<f>", a.frameSet("arcadescr0_1", "shared").frames.map(f => f.name),
   ["arcadescr0_0", "arcadescr0_1", "arcadescr0_2", "arcadescr0_3"]);
eq("anim: prefix keeps the anim index", a.frameSet("arcadescr0_1", "shared").prefix, "arcadescr0_");
eq("anim: a different anim is a different set", a.frameSet("arcadescr1_0", "shared").frames.length, 2);
eq("anim: trailing digits", a.frameSet("tvstatic2", "shared").frames.map(f => f.n), [1, 2, 3]);
ok("anim: a lone asset has no sequence", a.frameSet("title", "shared") === null);
ok("anim: does not cross groups", a.frameSet("cover01", "shared") === null);
eq("anim: finds siblings in its own group", a.frameSet("cover01", "s0").frames.length, 2);
ok("anim: an all-digits name is not a sequence", a.frameSet("1", "shared") === null);
eq("anim: frames sort numerically not lexically",
   a.frameSet("tvstatic2", "shared").frames.map(f => f.n), [1, 2, 3]);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
