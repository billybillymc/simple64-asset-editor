/* End-to-end test: builds a small fixture page from asset-editor.tpl.html,
   drives it in headless Chrome with real pointer and keyboard events, and
   reports what the UI actually did.  Run:  node test/browser.test.js
   Skips (exit 0) when no Chromium-based browser is installed. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TPL = process.env.TPL || path.join(ROOT, "asset-editor.tpl.html");

/* ---- find a browser ---- */
function findBrowser() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const pf = process.env["ProgramFiles"] || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const candidates = [
    path.join(pf, "Google\\Chrome\\Application\\chrome.exe"),
    path.join(pf86, "Google\\Chrome\\Application\\chrome.exe"),
    path.join(pf, "Microsoft\\Edge\\Application\\msedge.exe"),
    path.join(pf86, "Microsoft\\Edge\\Application\\msedge.exe"),
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ];
  return candidates.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
}

/* ---- a solid-color PNG, so the fixture needs no binary files on disk ---- */
function solidPng(w, h, rgb) {
  const raw = Buffer.concat(Array.from({ length: h }, () =>
    Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w },
      () => Buffer.from([rgb[0], rgb[1], rgb[2], 255])))])));
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))
  ]);
  return "data:image/png;base64," + png.toString("base64");
}
let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* ---- fixture: 9 shared assets (one 4-frame anim, one 4-frame run, a title) ---- */
function fixtureAssets() {
  const a = {};
  for (let f = 0; f < 4; f++) a["shared/arcadescr0_" + f] = solidPng(64, 48, [10, 200 - f * 40, 60]);
  for (let i = 1; i <= 4; i++) a["shared/tvstatic" + i] = solidPng(64, 48, [20 * i, 30, 40]);
  a["shared/title"] = solidPng(128, 24, [200, 30, 30]);
  a["s0/marker1"] = solidPng(64, 16, [0, 120, 200]);
  return Object.entries(a).map(([k, v]) => JSON.stringify(k) + ":" + JSON.stringify(v)).join(",\n");
}

const browser = findBrowser();
if (!browser) {
  console.log("skipped: no Chrome or Edge found (set CHROME=<path> to run this suite)");
  process.exit(0);
}

const page = fs.readFileSync(TPL, "utf8")
  .replace("/*__ASSETS__*/", fixtureAssets())
  .replace("/*__BUILD__*/", "browser test fixture")
  .replace("</body>", "<script>\n" + fs.readFileSync(path.join(__dirname, "browser-driver.js"), "utf8") + "\n</script>\n</body>");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "n64ae-"));
const file = path.join(dir, "fixture.html");
fs.writeFileSync(file, page, "utf8");

let dom = "";
try {
  dom = execFileSync(browser, [
    "--headless", "--disable-gpu", "--no-sandbox", "--window-size=1750,1150",
    "--virtual-time-budget=30000", "--dump-dom",
    "file:///" + file.replace(/\\/g, "/")
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  console.error("browser run failed: " + e.message);
  process.exit(1);
} finally {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* leave the temp dir */ }
}

const m = /<title>RESULTS\|(\d+)\|(\d+)\|([\s\S]*?)<\/title>/.exec(dom);
if (!m) {
  console.error("the page never reported results - the driver script did not finish");
  process.exit(1);
}
const [, passed, failed, joined] = m;
const decode = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
for (const line of decode(joined).split(" ;; ")) {
  if (line.startsWith("FAIL")) console.log("  " + line);
}
console.log("\n" + passed + " passed, " + failed + " failed  (" + path.basename(browser) + ")");
process.exit(+failed ? 1 : 0);
