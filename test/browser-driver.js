/* Injected into a generated page by browser.test.js and run in headless Chrome.
   Drives the real UI with real events, then reports through document.title. */
(function () {
  /* headless Chrome blocks the renderer on a real confirm() dialog */
  let confirms = 0;
  window.confirm = () => { confirms++; return true; };

  const R = [];
  const t = (name, cond, extra) => R.push((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " [" + extra + "]"));
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function pointer(el, type, x, y, opts) {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(type, Object.assign({
      bubbles: true, cancelable: true, pointerId: 1, isPrimary: true,
      clientX: r.left + x, clientY: r.top + y, button: 0, buttons: 1
    }, opts || {})));
  }
  function key(k, opts) {
    document.dispatchEvent(new KeyboardEvent("keydown", Object.assign({
      bubbles: true, cancelable: true, key: k
    }, opts || {})));
  }
  const px = (id, x, y) => Array.from($(id).getContext("2d").getImageData(x, y, 1, 1).data);
  const previewData = () => $("preview").getContext("2d")
    .getImageData(0, 0, $("preview").width, $("preview").height).data;
  const redCount = () => {
    const d = previewData();
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && !d[i + 1] && !d[i + 2] && d[i + 3]) n++;
    return n;
  };
  const opaqueInPreview = () => {
    const d = previewData();
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  };

  window.addEventListener("error", e => R.push("FAIL uncaught [" + e.message + " @" + e.lineno + "]"));
  let step = "start";
  const S = n => { step = n; };
  setTimeout(() => report(R.concat(["FAIL watchdog fired during: " + step])), 20000);

  (async function () {
    await sleep(200);

    S("boot");
    const thumbs = [...document.querySelectorAll(".thumb")];
    t("gallery rendered thumbnails", thumbs.length === 9, thumbs.length);
    t("gallery count label", /assets?$/.test($("galCount").textContent), $("galCount").textContent);
    t("no startup error in the status line", !/fail|error/i.test($("status").textContent), $("status").textContent);
    await sleep(200);
    const decodedAtBoot = thumbs.filter(d => {
      const i = d.querySelector("img");
      return i.complete && i.naturalWidth;
    }).length;
    t("every thumbnail in view decoded at boot", decodedAtBoot === thumbs.length,
      decodedAtBoot + "/" + thumbs.length);

    S("open asset");
    const target = thumbs.find(d => d.querySelector("img").alt === "arcadescr0_1");
    t("found arcadescr0_1 in the browser", !!target);
    target.click();
    await sleep(300);
    t("opening set the filename", $("fname").value === "arcadescr0_1", $("fname").value);
    t("opening set the canvas size", $("inW").value === "64" && $("inH").value === "48",
      $("inW").value + "x" + $("inH").value);
    t("preset auto-matched the size", $("preset").value === "64x48", $("preset").value);
    t("asset pixels reached the preview", opaqueInPreview() === 64 * 48, opaqueInPreview());
    t("the open asset is highlighted", !!document.querySelector(".thumb.cur"));
    /* the gallery is rebuilt when an asset opens; its thumbnails must still load.
       This used to break: lazy-loading missed every rebuilt thumbnail. */
    await sleep(300);
    const imgs = [...document.querySelectorAll(".thumb img")];
    const decoded = imgs.filter(i => i.complete && i.naturalWidth).length;
    t("thumbnails still load after the gallery rebuilds", decoded === imgs.length,
      decoded + "/" + imgs.length);

    S("anim");
    t("frame sequence found", /4 frames/.test($("animInfo").textContent), $("animInfo").textContent);
    t("editing frame is named", /editing #1/.test($("animInfo").textContent), $("animInfo").textContent);
    t("play button enabled", !$("bPlay").disabled);
    $("bNextF").click();
    await sleep(50);

    S("draw");
    $("color").value = "#ff0000";
    $("color").dispatchEvent(new Event("input", { bubbles: true }));
    const cv = $("cv");
    const Z = parseInt($("zLab").textContent, 10);      /* whatever fit chose for this window */
    const c = p => p * Z + Math.floor(Z / 2);           /* center of pixel p */
    t("zoom label is a usable number", Z >= 1 && Z <= 48, Z);
    pointer(cv, "pointerdown", c(5), c(5));
    pointer(cv, "pointermove", c(30), c(20));
    pointer(cv, "pointerup", c(30), c(20), { buttons: 0 });
    await sleep(60);
    const p = px("preview", 5, 5);
    t("pen drew the chosen color at the press point", p[0] === 255 && !p[1] && !p[2], p.join(","));
    const end = px("preview", 30, 20);
    t("pen drew at the release point too", end[0] === 255 && !end[1], end.join(","));
    /* a 5,5 -> 30,20 drag is one pointermove: without interpolation only the two
       endpoints would be red, so counting the run proves the stroke is filled in */
    t("the drag interpolated into a full stroke", redCount() >= 26, redCount());
    t("coords readout updated", /\d+,\d+/.test($("coords").textContent), $("coords").textContent);

    S("undo");
    key("z", { ctrlKey: true });
    await sleep(40);
    const undone = px("preview", 5, 5);
    t("ctrl+z undid the stroke", !(undone[0] === 255 && !undone[1]), undone.join(","));
    key("y", { ctrlKey: true });
    await sleep(40);
    const redone = px("preview", 5, 5);
    t("ctrl+y redid it", redone[0] === 255 && !redone[1], redone.join(","));
    t("redo brought the whole stroke back", redCount() >= 26, redCount());

    S("tools");
    key("m");
    t("M selected the marquee tool", document.querySelector('[data-tool="select"]').classList.contains("on"));
    key("b");
    t("B went back to the pen", document.querySelector('[data-tool="pen"]').classList.contains("on"));
    key("]");
    t("] grew the brush", $("brush").value === "2", $("brush").value);
    key("[");
    t("[ shrank it again", $("brush").value === "1", $("brush").value);

    S("selection");
    key("m");
    pointer(cv, "pointerdown", c(2), c(2));
    pointer(cv, "pointermove", c(9), c(9));
    pointer(cv, "pointerup", c(9), c(9), { buttons: 0 });
    await sleep(40);
    t("marquee reports its size right away", /sel 8x8/.test($("coords").textContent), $("coords").textContent);
    const beforeClear = opaqueInPreview();
    key("Delete");
    await sleep(40);
    t("Del cleared exactly the selection", opaqueInPreview() === beforeClear - 64,
      beforeClear + " -> " + opaqueInPreview());
    key("Escape");
    key("b");

    S("bake");
    $("fmtSel").value = "ci4";
    $("fmtSel").dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    const w = $("warns").textContent;
    t("CI4 panel reports the color budget", /\d+\/1[56] colors/.test(w), w.slice(0, 90));
    t("CI4 panel reserves an entry for transparency", /transparency/.test(w), w.slice(0, 90));
    t("baked canvas was rendered", $("baked").width === 64 && $("baked").height === 48,
      $("baked").width + "x" + $("baked").height);
    $("fmtSel").value = "ia8";
    $("fmtSel").dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    t("IA8 warns about discarded color", /throws all of it away/.test($("warns").textContent),
      $("warns").textContent.slice(0, 90));
    t("format label followed the select", $("fmtLabel").textContent === "IA8", $("fmtLabel").textContent);

    S("palette");
    $("fmtSel").value = "ci4";
    $("fmtSel").dispatchEvent(new Event("change", { bubbles: true }));
    $("bExtract").click();
    await sleep(80);
    const sw = document.querySelectorAll("#pal .sw").length;
    t("from-image built a palette within budget", sw > 0 && sw <= 16, sw);

    S("transform");
    $("bFlipH").click(); await sleep(40);
    $("bRot90").click(); await sleep(60);
    t("rot90 swapped the size inputs", $("inW").value === "48" && $("inH").value === "64",
      $("inW").value + "x" + $("inH").value);
    $("bRot90").click(); $("bRot90").click(); $("bRot90").click(); await sleep(60);
    t("four rotations return to 64x48", $("inW").value === "64" && $("inH").value === "48",
      $("inW").value + "x" + $("inH").value);
    $("inW").value = "32"; $("inH").value = "32";
    $("bResize").click(); await sleep(60);
    t("resize applied", $("cv").width === 32 * parseInt($("zLab").textContent, 10), $("zLab").textContent);

    S("revert");
    $("bRevert").click(); await sleep(80);
    t("revert restored the original size", $("inW").value === "64" && $("inH").value === "48",
      $("inW").value + "x" + $("inH").value);
    t("revert restored the pixels", opaqueInPreview() === 64 * 48, opaqueInPreview());
    t("revert asked before discarding edits", confirms > 0, confirms);

    S("name validation");
    $("fname").value = "bad name!";
    $("bSave").click();
    await sleep(80);
    t("save rejects an illegal filename", /only letters/.test($("status").textContent), $("status").textContent);
    $("fname").value = "";
    $("bSave").click();
    await sleep(80);
    t("save rejects an empty filename", /name/i.test($("status").textContent), $("status").textContent);

    S("bake cmd");
    $("gameRoot").value = "D:\\proj\\mygame";
    $("gameRoot").dispatchEvent(new Event("input", { bubbles: true }));
    t("bake command follows the game root", $("bakeCmd").textContent.includes("D:\\proj\\mygame"),
      $("bakeCmd").textContent);

    S("search");
    $("search").value = "tvstatic";
    $("search").dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(80);
    const found = [...document.querySelectorAll(".thumb img")];
    t("search filters the gallery", found.length === 4, found.length);
    await sleep(200);
    t("filtered thumbnails load too", found.every(i => i.complete && i.naturalWidth),
      found.filter(i => i.complete && i.naturalWidth).length + "/" + found.length);
    $("search").value = "zzzznothing";
    $("search").dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(60);
    t("empty search result explains itself", /nothing matches/.test($("gallery").textContent),
      $("gallery").textContent.slice(0, 60));

    report(R);
  })().catch(e => report(R.concat(["FAIL threw during " + step + " [" + e.message + "]"])));

  let reported = false;
  function report(list) {
    if (reported) return;
    reported = true;
    const failed = list.filter(x => x.startsWith("FAIL"));
    document.title = "RESULTS|" + (list.length - failed.length) + "|" + failed.length + "|" + list.join(" ;; ");
    document.body.innerHTML = "";
    document.body.style.cssText = "background:#0b0d10;color:#d6dbe0;font:15px/1.5 Consolas,monospace;padding:20px";
    const h = document.createElement("div");
    h.style.cssText = "font-size:22px;margin-bottom:10px;color:" + (failed.length ? "#e06767" : "#57c7a8");
    h.textContent = (list.length - failed.length) + " passed, " + failed.length + " failed";
    document.body.appendChild(h);
    for (const line of list) {
      const d = document.createElement("div");
      d.style.color = line.startsWith("FAIL") ? "#e06767" : "#8a939d";
      d.textContent = line;
      document.body.appendChild(d);
    }
  }
})();
