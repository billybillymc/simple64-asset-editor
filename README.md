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

All eight stores hold the same 148 names, so one drawing usually belongs in
several of them. Tick the extras under **also save into** and a single save
writes them all; a dot next to a store means it already has an asset by that
name, so you can see what you are about to replace before you do it.

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
Shift+arrow moves 8 px. <kbd>Ctrl</kbd>+wheel zooms **around the pointer**, so
zooming into a detail keeps it under the cursor instead of flinging it off
screen.

Tick **tile 3x3** under the preview and the image repeats in a 3x3 grid — the
only honest way to tell whether a floor, wall or ceiling texture actually meets
itself. Pair it with the wrapping nudge to slide a pattern until the seam
disappears.

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

## Three ways to look at the canvas

The dropdown in the canvas toolbar (or <kbd>V</kbd>) switches what the big
canvas shows:

- **edit** — the image, as normal.
- **as baked** — the CI4/IA8/RGBA16 result at working size. The little preview
  is 64 px wide; deciding whether a 300-colour wall survives quantization needs
  it big, and this is the same pixels you would ship.
- **changes only** — everything you have altered since opening the asset at full
  strength, everything untouched ghosted to grey, and a count: *116 pixels
  changed*. Rubbed-out pixels show as red holes. It is how you proofread a
  touch-up.

The two review views are read-only, and say so if you try to draw in them,
rather than quietly dropping the stroke. Middle-mouse drag pans the canvas at
any zoom.

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

Colours you draw with collect in a **recently used** strip, so getting back to
one is a click rather than a hunt.

When **fit it** borrows the swatches to show an asset's own colours, it does not
overwrite the palette you assembled — a **restore mine** button appears to put
yours back, and nothing is written to disk in the meantime.

Three buttons cover the CI4 palette workflow:

- **from image** pulls the image's own 16 quantized colors into the palette.
- **lock** snaps every *new* stroke to the nearest palette entry.
- **map image** snaps every pixel *already on the canvas* to the palette — the
  fix when the panel says something like *120/16 colors, the bake will merge
  some* and you would rather choose the 16 yourself than let mksprite choose.

## Auditing the whole project

The bake panel only ever describes the file you have open, so a project-wide
problem stays invisible. **scan every asset** decodes all of them once and says
what the bake will change:

```
1228 scanned - 981 over the CI4 palette · 16 odd width · 28 soft alpha

  s1/flooraisle   64x64   334 / 16   merges 318 colors
  s1/wall         64x64   307 / 16   merges 291 colors
  s4/flooraisle   64x64   272 / 16   merges 256 colors
  ...
```

Sort by any column, filter to one kind of problem, click a row to open that
asset, or **export** the whole thing as CSV. **rescan** picks up anything you
have saved since.

Any row that is over budget gets a **fit it** button: it opens that asset with
its own best 16 colours already applied, and leaves it *unsaved* so you can look
at the damage, undo it, or keep it. That is deliberate — nothing rewrites your
art behind your back. It also checks animation runs for
holes — a `name1`, `name3` pair with no `name2` is a missing frame, and the
game will notice even if you do not.

Those numbers are from the sample project this was built against: **80% of its
art is over the CI4 budget**, which means mksprite is quietly choosing the
16 colours for most of it. Whether that matters is a judgement call, but you
could not previously make that call without opening 1228 files by hand.

## Animation

Frames follow `name<anim>_<frame>` (`arcadescr1_2` = anim 1, frame 2) or a plain
trailing number (`tvstatic1`…`tvstatic6`). The editor finds the sequence around
whatever you have open and gives you playback at 1–30 fps, frame stepping, and
an **onion** ghost of the previous frame under the canvas. The frame you are
editing plays live, so you see your change in motion before saving.

Step to a frame with <kbd>,</kbd> / <kbd>.</kbd> and the **edit it** button
names that frame; click it (or hold <kbd>Shift</kbd> while stepping) to open it
for editing. That is how you work through an animation without hunting for each
frame in the browser.

**ref** ghosts the asset as it was when you opened it — handy for redrawing over
existing art.

## Safety net

Undo/redo goes 150 steps deep. The canvas is autosaved to `localStorage` and
comes back after a crash or an accidental reload, closing the tab with unsaved
changes asks first, and **revert** restores the asset exactly as it was opened.

## Tests

```
node test/editor.test.js     # 79 assertions, no browser needed
node test/browser.test.js    # 123 assertions, drives the real UI in headless Chrome
```

`editor.test.js` boots the editor's script against a small DOM stub — so a bad
element id or a broken wiring reference fails immediately — then checks the
drawing, selection, transform, resize, quantization and frame-detection logic.

`browser.test.js` builds a small fixture page from the template and drives it in
headless Chrome with real pointer and keyboard events: opening an asset from the
gallery, lazy thumbnail loading, drawing a stroke, undo/redo, the marquee, the
bake panel's warnings, transforms, revert, filename validation, the tiled
preview, frame-to-frame editing, palette remapping, pointer-anchored zoom, the
audit report, and every readout described under *Knowing what you are about to
do*. Its fixture carries one deliberate example of each problem the audit looks
for, so the counts are exact rather than approximate. It skips itself (exit 0) when no
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
