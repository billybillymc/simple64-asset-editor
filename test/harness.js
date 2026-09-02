/* Just enough of a DOM for the editor's IIFE to boot under node, so the pixel
   logic in asset-editor.tpl.html can be tested without a browser.
   Booting at all is itself a test: a typo'd element id or a bad reference in
   the wiring throws here. The internals are then re-exported as __api. */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(process.env.TPL || path.join(__dirname, "..", "asset-editor.tpl.html"), "utf8");
const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const html = src.split("<script>")[0];

/* ---- element stub ---- */
class Cls {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(c) { this.set.add(c); } remove(c) { this.set.delete(c); }
  toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
class El {
  constructor(tag, id) {
    this.tagName = (tag || "div").toUpperCase();
    this.id = id || "";
    this.children = [];
    this.style = { setProperty() {} };
    this.dataset = {};
    this.classList = new Cls(this);
    this.value = ""; this.checked = false; this.disabled = false;
    this.textContent = ""; this.innerHTML = ""; this.title = "";
    this.options = []; this.files = [];
    this._listeners = {};
    this.width = 0; this.height = 0;
    this.complete = true; this.naturalWidth = 0; this.naturalHeight = 0;
  }
  appendChild(c) { this.children.push(c); if (this.tagName === "SELECT") this.options.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); }
  addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); }
  removeEventListener() {}
  closest() { return null; }
  querySelectorAll() { return []; }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  getContext() { return ctxStub; }
  toDataURL() { return "data:image/png;base64,AAAA"; }
  toBlob(cb) { cb({ size: 4, type: "image/png" }); }
  click() {}
  get clientWidth() { return 900; }
  get clientHeight() { return 600; }
  text() { return Promise.resolve(""); }
}
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === "canvas") return new El("canvas");
    if (k === "getImageData") return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return () => {};
  },
  set: () => true
});

/* build the element table from the markup's id="" attributes */
const registry = new Map();
for (const m of html.matchAll(/<(\w+)([^>]*\bid="([^"]+)"[^>]*)>/g)) {
  const el = new El(m[1], m[3]);
  const val = /\bvalue="([^"]*)"/.exec(m[2]);
  if (val) el.value = val[1];
  if (/\bchecked\b/.test(m[2])) el.checked = true;
  const dt = /\bdata-tool="([^"]+)"/.exec(m[2]);
  if (dt) el.dataset.tool = dt[1];
  registry.set(m[3], el);
}
/* tool buttons live inside #tools */
const toolsEl = registry.get("tools");
for (const m of html.matchAll(/data-tool="(\w+)"/g)) {
  const b = new El("button"); b.dataset.tool = m[1];
  if (m[1] === "pen") b.classList.add("on");
  toolsEl.appendChild(b);
}

global.window = {
  addEventListener() {}, removeEventListener() {},
  showDirectoryPicker: undefined, indexedDB: undefined
};
global.document = {
  getElementById: id => registry.get(id) || null,
  createElement: t => new El(t),
  createDocumentFragment: () => new El("fragment"),
  createTextNode: t => ({ nodeValue: t }),
  addEventListener() {},
  documentElement: new El("html")
};
global.navigator = { clipboard: { writeText: () => Promise.resolve(), write: () => Promise.resolve() } };
global.localStorage = {
  _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }
};
global.indexedDB = { open() { throw new Error("no idb in node"); } };
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
global.Image = class { constructor() { this.width = 0; this.height = 0; this.complete = false; } set src(v) { this._s = v; } get src() { return this._s; } };
global.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
global.Blob = class { constructor(p) { this.parts = p; } };
global.ClipboardItem = class {};
global.getComputedStyle = () => ({ maxWidth: "900px", maxHeight: "600px" });
global.confirm = () => true;
global.alert = () => {};

/* expose internals for testing */
let code = scripts[scripts.length - 1];
const marker = "})();";
const idx = code.lastIndexOf(marker);
code = code.slice(0, idx) + `
globalThis.__api = {
  get W(){return W}, get H(){return H},
  get pix(){return pix}, set pix(v){pix=v},
  get sel(){return sel}, set sel(v){sel=v},
  get PALETTE(){return PALETTE}, set PALETTE(v){PALETTE=v},
  alloc, setPx, stamp, lineTo, drawRect, drawEllipse, floodFill, keyAt,
  extract, clearRegion, blit, transformRegion, rot90, nudge, resizeTo,
  opaqueBounds, cropTo, medianCut, analyze, bakeCompute, frameSet,
  nearestIn, hex2rgb, rgb2hex, isValidHex, q5, q4, region,
  set brush(v){brush=v}, get brush(){return brush},
  setTool, get tool(){return tool}, repaint,
  zoomFit, get ZOOM(){return ZOOM},
};
` + code.slice(idx);

/* ASSETS/BUILD_INFO block */
const head = scripts[0]
  .replace("const ASSETS =", "globalThis.ASSETS =")
  .replace("const BUILD_INFO =", "globalThis.BUILD_INFO =")
  .replace("/*__ASSETS__*/", `
"shared/arcadescr0_0":"d0","shared/arcadescr0_1":"d1","shared/arcadescr0_2":"d2","shared/arcadescr0_3":"d3",
"shared/arcadescr1_0":"e0","shared/arcadescr1_1":"e1",
"shared/tvstatic1":"t1","shared/tvstatic2":"t2","shared/tvstatic3":"t3",
"shared/title":"ti","s0/cover01":"c1","s0/cover02":"c2","s0/marker1":"m1"
`).replace("/*__BUILD__*/", "13 assets, test");

eval(head);
eval(code);
module.exports = globalThis.__api;
