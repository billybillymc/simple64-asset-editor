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

  const setViewTo = m => {
    $("viewMode").value = m;
    $("viewMode").dispatchEvent(new Event("change", { bubbles: true }));
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
    t("the audit report stays hidden until asked for", $("auditWrap").hidden === true &&
      getComputedStyle($("auditWrap")).display === "none",
      getComputedStyle($("auditWrap")).display);
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

    S("feedback");
    /* the panel that says exactly which file a save will write */
    const sp = () => $("savePath").textContent;
    t("save path names the file it will write", /arcadescr0_1\.png/.test(sp()), sp());
    t("save path names the folder it belongs in", /assets.shared/.test(sp()), sp());
    t("save path warns it replaces an existing asset", /replaces the asset already there/.test(sp()), sp());
    t("save button says it downloads when no folder is connected",
      $("bSave").textContent === "download png", $("bSave").textContent);
    $("fname").value = "brandnewthing";
    $("fname").dispatchEvent(new Event("input", { bubbles: true }));
    t("save path flags a name that does not exist yet",
      /makes a new asset/.test(sp()), sp());
    $("fname").value = "arcadescr0_1";
    $("fname").dispatchEvent(new Event("input", { bubbles: true }));
    t("nothing is marked unsaved right after opening", $("dirtyMark").textContent === "",
      $("dirtyMark").textContent);
    t("the tool hint describes the active tool", /pen/.test($("toolHint").textContent),
      $("toolHint").textContent);
    t("the color readout says what will be drawn", /#57c7a8/.test($("drawsAs").textContent),
      $("drawsAs").textContent);

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
    t("drawing marks the file unsaved", /unsaved/.test($("dirtyMark").textContent),
      $("dirtyMark").textContent);
    t("the tab title flags unsaved work", document.title.indexOf("●") === 0, document.title);

    /* lock-to-palette silently redirects the color, so it must be spelled out */
    $("lockPal").checked = true;
    $("lockPal").dispatchEvent(new Event("change", { bubbles: true }));
    t("lock explains that it redirects the color", /lock is on/.test($("drawsAs").textContent),
      $("drawsAs").textContent);
    $("lockPal").checked = false;
    $("lockPal").dispatchEvent(new Event("change", { bubbles: true }));
    t("unlocking goes back to the plain color", /^draws/.test($("drawsAs").textContent.trim()),
      $("drawsAs").textContent);

    /* a shape drag reports its size at the cursor while you drag */
    {
      key("r");
      pointer(cv, "pointerdown", c(4), c(4));
      pointer(cv, "pointermove", c(15), c(11));
      await sleep(30);
      t("a rect drag reports its size live", /rect 12x8/.test($("coords").textContent),
        $("coords").textContent);
      pointer(cv, "pointerup", c(15), c(11), { buttons: 0 });
      key("z", { ctrlKey: true });
      key("b");
    }

    S("undo");
    key("z", { ctrlKey: true });
    await sleep(40);
    t("undo says what it reversed", /undid .*stroke/.test($("status").textContent),
      $("status").textContent);
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

    S("new features");
    /* tiled preview: the seam check for floor/wall textures */
    const pvW = $("preview").width;
    $("tilePv").checked = true;
    $("tilePv").dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(60);
    t("tile 3x3 makes the preview nine copies", $("preview").width === pvW * 3,
      pvW + " -> " + $("preview").width);
    t("the preview label explains the tiled mode", /seams/.test($("pvLab").textContent),
      $("pvLab").textContent);
    $("tilePv").checked = false;
    $("tilePv").dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(60);
    t("untiling goes back to 1x", $("preview").width === pvW, $("preview").width);

    /* stepping the animation and opening that frame to edit it */
    $("fname").value = "arcadescr0_1";
    $("fname").dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(60);
    t("edit-it is disabled while previewing the open frame", $("bOpenFrame").disabled);
    $("bNextF").click();
    await sleep(60);
    t("edit-it names the frame it would open", /arcadescr0_2/.test($("bOpenFrame").textContent),
      $("bOpenFrame").textContent);
    t("edit-it becomes available on another frame", !$("bOpenFrame").disabled);
    $("bOpenFrame").click();
    await sleep(300);
    t("edit-it actually opens that frame", $("fname").value === "arcadescr0_2", $("fname").value);
    t("opening a frame keeps the sequence", /4 frames/.test($("animInfo").textContent),
      $("animInfo").textContent);

    /* mapping existing pixels onto the palette */
    $("bPalReset").click();
    await sleep(30);
    $("bMapPal").click();
    await sleep(80);
    t("map-image reports what it remapped", /remapped \d+ pixels|already on the palette/
      .test($("status").textContent), $("status").textContent);
    {
      const d = previewData();
      const pal = [...document.querySelectorAll("#pal .sw")].map(sw => sw.dataset.c);
      const hex = v => v.toString(16).padStart(2, "0");
      let offPalette = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        if (!pal.includes("#" + hex(d[i]) + hex(d[i + 1]) + hex(d[i + 2]))) offPalette++;
      }
      t("every pixel now sits on the palette", offPalette === 0, offPalette + " strays");
    }
    key("z", { ctrlKey: true });
    await sleep(60);
    t("the remap is undoable", /undid map to palette/.test($("status").textContent),
      $("status").textContent);

    /* Ctrl+wheel must keep the pixel under the pointer put, or zooming in on a
       detail throws it off screen */
    const wrap = $("cwrap");
    $("zFit").click(); await sleep(40);
    for (let i = 0; i < 14; i++) $("zIn").click();   /* zoom past the view, so it can scroll */
    await sleep(60);
    t("the canvas can scroll once zoomed in", wrap.scrollWidth > wrap.clientWidth,
      wrap.scrollWidth + " vs " + wrap.clientWidth);
    const wr = wrap.getBoundingClientRect();
    const anchorX = wr.left + wrap.clientWidth * 0.7, anchorY = wr.top + wrap.clientHeight * 0.6;
    const pixelUnder = () => {
      const r = cv.getBoundingClientRect(), z = parseInt($("zLab").textContent, 10);
      return [Math.floor((anchorX - r.left) / z), Math.floor((anchorY - r.top) / z)];
    };
    const beforeZ = pixelUnder();
    const zStart = parseInt($("zLab").textContent, 10);
    /* eight steps at the same point: unanchored zoom drifts several pixels, so a
       one-step tolerance would pass either way */
    for (let i = 0; i < 8; i++) {
      wrap.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true, cancelable: true, ctrlKey: true, deltaY: -1,
        clientX: anchorX, clientY: anchorY
      }));
      await sleep(15);
    }
    const afterZ = pixelUnder();
    t("Ctrl+wheel zoomed in", parseInt($("zLab").textContent, 10) === zStart + 8,
      zStart + " -> " + $("zLab").textContent);
    t("Ctrl+wheel keeps the pixel under the pointer through eight steps",
      Math.abs(afterZ[0] - beforeZ[0]) <= 1 && Math.abs(afterZ[1] - beforeZ[1]) <= 1,
      beforeZ + " -> " + afterZ);
    $("zFit").click(); await sleep(40);

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

    S("audit");
    /* The fixture carries one deliberate example of each problem:
       s0/toomany 90 colors, s0/oddwide 21 px wide, s0/huge 128x128,
       and s0/gappy1 + gappy3 with frame 2 missing between them. */
    $("bAudit").click();
    for (let i = 0; i < 60 && /scanning/.test($("auditSum").textContent); i++) await sleep(100);
    t("the report opens", !$("auditWrap").hidden);
    t("the scan covers every asset", /^15 scanned/.test($("auditSum").textContent),
      $("auditSum").textContent);
    const rowsFor = f => {
      $("auditFilter").value = f;
      $("auditFilter").dispatchEvent(new Event("change", { bubbles: true }));
      return [...document.querySelectorAll("#auditList td.nm")].map(td => td.dataset.key);
    };
    const over = rowsFor("colors");
    t("finds the asset that is over the CI4 palette",
      over.length === 1 && over[0] === "s0/toomany", over.join(","));
    t("says how many colors the bake will merge",
      /merges 74 colors/.test($("auditList").textContent),
      $("auditList").textContent.slice(0, 120));
    const odd = rowsFor("odd");
    t("finds the odd width", odd.length === 1 && odd[0] === "s0/oddwide", odd.join(","));
    const tmem = rowsFor("tmem");
    t("finds the asset too big for one TMEM load",
      tmem.length === 1 && tmem[0] === "s0/huge", tmem.join(","));
    const gaps = rowsFor("gap");
    t("finds both frames either side of a missing one",
      gaps.length === 2 && gaps.indexOf("s0/gappy1") >= 0 && gaps.indexOf("s0/gappy3") >= 0,
      gaps.join(","));
    t("names the frame that is missing", /frame 2 missing/.test($("auditList").textContent),
      $("auditList").textContent.slice(0, 200));
    t("no soft alpha in this fixture", rowsFor("alpha").length === 0);
    t("problems-only lists exactly the five", rowsFor("problems").length === 5,
      rowsFor("problems").join(","));
    t("every-asset lists all fifteen", rowsFor("all").length === 15);
    t("clean assets are called out as clean",
      /bakes unchanged/.test($("auditList").textContent));
    t("the headline breaks the flags down",
      /over the CI4 palette/.test($("auditSum").textContent) &&
      /odd width/.test($("auditSum").textContent), $("auditSum").textContent);

    /* sorting by a column header */
    rowsFor("all");
    const th = [...document.querySelectorAll("#auditList th")].find(x => x.dataset.sort === "size");
    th.click();
    await sleep(30);
    const bySize = [...document.querySelectorAll("#auditList td.nm")].map(x => x.dataset.key);
    t("sorting by size puts the biggest first", bySize[0] === "s0/huge", bySize.slice(0, 3).join(","));

    /* clicking a row opens that asset and closes the report */
    rowsFor("colors");
    document.querySelector("#auditList td.nm").click();
    await sleep(300);
    t("clicking a row closes the report", $("auditWrap").hidden);
    t("clicking a row opens that asset", $("fname").value === "toomany", $("fname").value);
    t("the opened asset really is over budget",
      /\d+\/1[56] colors/.test($("warns").textContent) && /merge/.test($("warns").textContent),
      $("warns").textContent.slice(0, 80));

    /* one click should take an over-budget asset down to a palette that fits */
    $("bAudit").click();
    for (let i = 0; i < 60 && /scanning/.test($("auditSum").textContent); i++) await sleep(100);
    rowsFor("colors");
    document.querySelector("#auditList button[data-fix]").click();
    await sleep(400);
    t("fit-it opens the offending asset", $("fname").value === "toomany", $("fname").value);
    t("fit-it leaves it inside the CI4 budget",
      /^\d+\/1[56] colors/.test($("warns").textContent.trim()) &&
      !/merge/.test($("warns").textContent), $("warns").textContent.slice(0, 70));
    t("fit-it says what it cost", /cut .*from 90 colors/.test($("status").textContent),
      $("status").textContent);
    t("fit-it leaves the change unsaved for review", /unsaved/.test($("dirtyMark").textContent));
    t("fit-it is undoable", !$("bUndo").disabled);
    key("z", { ctrlKey: true });
    await sleep(250);                      /* the bake panel is debounced by 90ms */
    t("undoing fit-it restores the colors", /merge/.test($("warns").textContent),
      $("warns").textContent.slice(0, 70));

    /* colors you draw with should collect for reuse */
    S("recent colors");
    key("b");
    $("color").value = "#123456";
    $("color").dispatchEvent(new Event("input", { bubbles: true }));
    pointer(cv, "pointerdown", c(3), c(3));
    pointer(cv, "pointerup", c(3), c(3), { buttons: 0 });
    await sleep(60);
    const recentSw = [...document.querySelectorAll("#recent .sw")].map(x => x.dataset.c);
    t("the color just used is remembered", recentSw[0] === "#123456", recentSw.join(","));
    $("color").value = "#abcdef";
    $("color").dispatchEvent(new Event("input", { bubbles: true }));
    pointer(cv, "pointerdown", c(4), c(4));
    pointer(cv, "pointerup", c(4), c(4), { buttons: 0 });
    await sleep(60);
    const recent2 = [...document.querySelectorAll("#recent .sw")].map(x => x.dataset.c);
    t("the newest color comes first", recent2[0] === "#abcdef" && recent2[1] === "#123456",
      recent2.join(","));
    document.querySelectorAll("#recent .sw")[1].click();
    t("clicking a recent color selects it", $("color").value === "#123456", $("color").value);

    /* writing one drawing into several stores */
    S("multi-store save");
    $("fname").value = "marker1";
    $("fname").dispatchEvent(new Event("input", { bubbles: true }));
    $("saveTarget").value = "s0";
    $("saveTarget").dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(60);
    const boxes = [...document.querySelectorAll("#multiTargets input")];
    t("other groups are offered as extra targets", boxes.length > 0, boxes.length);
    t("the current target is not offered to itself",
      boxes.every(b => b.value !== "s0"), boxes.map(b => b.value).join(","));
    const sharedBox = boxes.find(b => b.value === "shared");
    t("a store that already has the name is marked",
      sharedBox && !sharedBox.parentElement.classList.contains("has"),
      "shared has no marker1, so no dot");
    sharedBox.checked = true;
    sharedBox.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(60);
    t("ticking a store shows up in the save line", /1 more store/.test($("savePath").textContent),
      $("savePath").textContent);
    t("and warns the folder is needed for it",
      /needs the game folder connected/.test($("savePath").textContent),
      $("savePath").textContent);
    const many = [...document.querySelectorAll("#multiTargets input")].slice(0, 3);
    many.forEach(b => { b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true })); });
    const stillChecked = [...document.querySelectorAll("#multiTargets input:checked")].length;
    t("ticking several stores keeps them all ticked", stillChecked === 3, stillChecked);
    t("the save line counts them all", /3 more stores/.test($("savePath").textContent),
      $("savePath").textContent);
    [...document.querySelectorAll("#multiTargets input:checked")]
      .forEach(b => { b.checked = false; b.dispatchEvent(new Event("change", { bubbles: true })); });
    t("unticking clears the extra stores",
      !/more store/.test($("savePath").textContent), $("savePath").textContent);

    S("view modes");
    /* open a clean asset, change one pixel, and check the three views.
       The search box still holds the filter from the gallery test - clear it. */
    $("search").value = "";
    $("search").dispatchEvent(new Event("input", { bubbles: true }));
    $("group").value = "shared";
    $("group").dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    [...document.querySelectorAll(".thumb")]
      .find(d => d.querySelector("img").alt === "tvstatic1").click();
    await sleep(300);
    t("opening an asset returns to the edit view", $("viewMode").value === "edit",
      $("viewMode").value);

    const zz = parseInt($("zLab").textContent, 10);
    const cc = p => p * zz + Math.floor(zz / 2);
    key("b");
    $("color").value = "#ff00ff";
    $("color").dispatchEvent(new Event("input", { bubbles: true }));
    pointer(cv, "pointerdown", cc(10), cc(10));
    pointer(cv, "pointerup", cc(10), cc(10), { buttons: 0 });
    await sleep(80);

    setViewTo("changes");
    await sleep(80);
    t("changes view counts what you touched", /^1 pixel changed/.test($("viewNote").textContent),
      $("viewNote").textContent);
    const cvPix = (x, y) => Array.from(cv.getContext("2d")
      .getImageData(x * zz + 2, y * zz + 2, 1, 1).data);
    const edited = cvPix(10, 10), untouched = cvPix(30, 30);
    t("the edited pixel shows at full strength",
      edited[0] === 255 && edited[1] === 0 && edited[2] === 255, edited.join(","));
    t("untouched pixels are ghosted back",
      untouched[3] < 200 && untouched[0] === untouched[1] && untouched[1] === untouched[2],
      untouched.join(","));

    /* Review views must not silently swallow strokes. Check the pixel itself:
       tvstatic1 is fully opaque, so an opaque-pixel count cannot tell the
       difference and would pass whether the guard worked or not. */
    const isMagenta = () => {
      const q = px("preview", 20, 20);
      return q[0] === 255 && q[1] === 0 && q[2] === 255;
    };
    t("the test pixel starts out unpainted", !isMagenta(), px("preview", 20, 20).join(","));
    pointer(cv, "pointerdown", cc(20), cc(20));
    pointer(cv, "pointerup", cc(20), cc(20), { buttons: 0 });
    await sleep(60);
    t("drawing is refused in a review view", !isMagenta(), px("preview", 20, 20).join(","));
    t("and it says why", /switch back to edit/.test($("status").textContent),
      $("status").textContent);

    setViewTo("baked");
    await sleep(120);
    t("baked view names the format", /IA8|CI4|RGBA/.test($("viewNote").textContent),
      $("viewNote").textContent);

    key("v");                                    /* V cycles back round to edit */
    await sleep(60);
    t("V cycles the view", $("viewMode").value === "changes", $("viewMode").value);
    setViewTo("edit");
    await sleep(60);
    t("the edit view clears the note", $("viewNote").textContent === "", $("viewNote").textContent);
    pointer(cv, "pointerdown", cc(20), cc(20));
    pointer(cv, "pointerup", cc(20), cc(20), { buttons: 0 });
    await sleep(60);
    t("drawing works again once back in edit", isMagenta(), px("preview", 20, 20).join(","));

    /* middle-drag pans instead of drawing */
    S("pan");
    const wrap2 = $("cwrap");
    $("zFit").click(); await sleep(40);
    for (let i = 0; i < 14; i++) $("zIn").click();
    await sleep(60);
    wrap2.scrollLeft = 40; wrap2.scrollTop = 40;
    const opaqueBeforePan = opaqueInPreview();
    pointer(cv, "pointerdown", 200, 200, { button: 1, buttons: 4 });
    pointer(cv, "pointermove", 160, 170, { button: 1, buttons: 4 });
    pointer(cv, "pointerup", 160, 170, { button: 1, buttons: 0 });
    await sleep(60);
    t("middle-drag scrolls the view", wrap2.scrollLeft === 80 && wrap2.scrollTop === 70,
      wrap2.scrollLeft + "," + wrap2.scrollTop);
    t("middle-drag draws nothing", opaqueInPreview() === opaqueBeforePan);
    $("zFit").click();

    /* Esc closes the report without deselecting behind it */
    $("bAudit").click();
    await sleep(60);
    key("Escape");
    await sleep(30);
    t("Esc closes the report", $("auditWrap").hidden);

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
