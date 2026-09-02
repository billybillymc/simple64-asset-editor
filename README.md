# 64-asset-editor

Standalone in-browser pixel editor for a libdragon N64 game's baked assets.
One HTML file, no dependencies, no server — open it and draw.

| file | what it is |
| --- | --- |
| `asset-editor.tpl.html` | the editor source — **edit this**, not the generated file |
| `build-editor.ps1` | embeds every PNG from the game's `assets/` folders as data URIs and writes `asset-editor.html` |
| `asset-editor.html` | generated; open in any browser |
| `test/` | node regression tests — pixel logic, plus a headless-browser UI pass |

## Workflow

1. `powershell -File build-editor.ps1 -GameRoot C:\path\to\game`
   (re-run whenever the game's bake changes; or set `$env:N64_GAME_ROOT` once)
2. Open `asset-editor.html`, pick a group, click a thumbnail, edit.
3. **connect** the game folder once and *save png* writes straight into
   `assets\shared\` or `assets\stores\sN\` — no download step. The browser
   remembers the folder between sessions. Without it, saves fall back to a
   normal download.
4. In the game repo:
   `docker run --rm -v C:\path\to\game:/app -w /app libdragon:preview bash tools/bake/convert.sh`
   then `make` in the same container. (The editor builds this line for you from
   the game-root box — hit *copy*.)

Connected to the folder, **rescan** re-reads every PNG from disk, so the gallery
shows what is actually on disk rather than the snapshot taken at build time.

## Drawing

Pen, eraser, line, rect, ellipse, flood fill, eyedropper, and a rectangular
select you can drag to move. Right-click always erases; hold <kbd>Alt</kbd> to
pick a color with any tool. Strokes are interpolated, so fast drags don't leave
gaps. Brush 1–8 px.

| | | | |
| --- | --- | --- | --- |
| <kbd>B</kbd> pen | <kbd>E</kbd> eraser | <kbd>L</kbd> line | <kbd>R</kbd> rect |
| <kbd>O</kbd> oval | <kbd>G</kbd> fill | <kbd>I</kbd> pick | <kbd>M</kbd> select |
| <kbd>[</kbd> <kbd>]</kbd> brush | <kbd>Ctrl+Z</kbd>/<kbd>Y</kbd> undo/redo | <kbd>Ctrl+C/X/V</kbd> clipboard | <kbd>Ctrl+A</kbd> select all |
| <kbd>Ctrl+S</kbd> save | <kbd>Del</kbd> clear | <kbd>+</kbd> <kbd>-</kbd> <kbd>0</kbd> zoom | <kbd>,</kbd> <kbd>.</kbd> step frames |

Arrow keys nudge. With nothing selected the nudge **wraps**, which is how you
line up a seamless floor/wall tile; with a selection it moves just that block.
Shift+arrow moves 8 px. <kbd>Ctrl</kbd>+wheel zooms.

## Knowing what you are about to do

The editor tries to answer "what will this actually do?" before you commit to it:

- The cursor draws the **exact pixels the brush would touch**, filled with the
  colour that will really be used — so a 4 px brush looks like a 4 px brush.
- **lock** quietly redirects your colour to the nearest palette entry, so the
  panel spells it out: *lock is on — draws #e8262d (nearest palette entry to
  #ff3388)*.
- Dragging a shape reports itself at the cursor and in the corner:
  *rect 23x17 outline*, *line 14 px*, *move +3, -2*, *select 8x8*.
- Each tool prints its own modifiers underneath the tool buttons, so
  right-click-erases and Shift-fills stop being folklore.
- The save button says which thing it will do — **save to folder** or
  **download png** — and under it, the exact path, plus whether that
  **replaces an asset already there** or makes a new one.
- Unsaved work is marked next to the filename and in the browser tab title,
  and the discard prompt names the file it is about to throw away.
- Undo says what it reversed (*undid fill (3 more)*), because every history
  entry is labelled with the action that created it.

## Seeing the bake before you bake

The *as baked* panel simulates what `mksprite` will do, so surprises show up
before a 3-minute Docker round trip:

- **CI4** — 16-entry palette, median-cut, ordered dither, RGBA5551 color
  truncation. If any pixel is transparent one entry is spent on it, so the real
  budget drops to **15 colors** — the panel says which and turns red when the
  image is over.
- **IA8** — 4-bit intensity + 4-bit alpha, and it warns when you feed it an
  image that still has real color to lose.
- **RGBA16** (5551) and **RGBA32** for comparison.

It also flags partial alpha (CI4/RGBA16 keep only 1 bit of it), odd widths for
CI4's 2-pixels-per-byte packing, the byte cost against a 4 KB TMEM load, and any
size change from the asset you opened. **apply** bakes the result into the
canvas so what you draw is exactly what ships.

*from image* pulls the image's own 16 quantized colors into the palette, and
**lock** snaps every stroke to the nearest palette entry — the reliable way to
stay inside the CI4 budget while drawing.

## Animation

Frames follow `name<anim>_<frame>` (`arcadescr1_2` = anim 1, frame 2) or a plain
trailing number (`tvstatic1`…`tvstatic6`). The editor finds the sequence around
whatever you have open and gives you playback at 1–30 fps, frame stepping, and
an **onion** ghost of the previous frame under the canvas. The frame you are
editing plays live, so you see your change in motion before saving.

**ref** ghosts the asset as it was when you opened it — handy for redrawing over
existing art.

## Safety net

Undo/redo goes 150 steps deep. The canvas is autosaved to `localStorage` and
comes back after a crash or an accidental reload, closing the tab with unsaved
changes asks first, and **revert** restores the asset exactly as it was opened.

## Tests

```
node test/editor.test.js     # 79 assertions, no browser needed
node test/browser.test.js    # 60 assertions, drives the real UI in headless Chrome
```

`editor.test.js` boots the editor's script against a small DOM stub — so a bad
element id or a broken wiring reference fails immediately — then checks the
drawing, selection, transform, resize, quantization and frame-detection logic.

`browser.test.js` builds a small fixture page from the template and drives it in
headless Chrome with real pointer and keyboard events: opening an asset from the
gallery, lazy thumbnail loading, drawing a stroke, undo/redo, the marquee, the
bake panel's warnings, transforms, revert, filename validation, and every
readout described under *Knowing what you are about to do*. It skips itself (exit 0) when no
Chrome or Edge is installed; set `CHROME=<path>` to point it somewhere else.

Run both after editing `asset-editor.tpl.html`.

## Rebuilding without the game repo

```
powershell -File build-editor.ps1 -ReuseAssets
```

Regenerates `asset-editor.html` from the template while keeping the art already
embedded in the previous build — how you iterate on the editor itself.
`-From <file>` takes the art from a different generated page, `-Out <file>`
writes elsewhere, `-Open` launches the result.
