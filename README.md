# 64-asset-editor

Standalone in-browser pixel editor for a libdragon N64 game's baked assets.

- `asset-editor.tpl.html` — the editor source (edit THIS, not the generated file)
- `build-editor.ps1` — embeds every PNG from the game's `assets/` folders into
  the template as data URIs and writes `asset-editor.html`
- `asset-editor.html` — generated; open in any browser

## Workflow

1. `powershell -File build-editor.ps1 -GameRoot C:\path\to\game`
   (re-run whenever the game's bake changes)
2. Open `asset-editor.html`, pick a store group, click a thumbnail, edit
3. Save PNG → drop into the game's `assets\shared\` or `assets\stores\sN\`
4. In the game repo:
   `docker run --rm -v C:\path\to\game:/app -w /app libdragon:preview bash tools/bake/convert.sh`
   then `make` in the same container.

CI4 note: most sprites quantize to 16 colors at bake — keep palettes tight.
Screens/title are IA8 (grayscale+alpha). Animation frames follow
`name<anim>_<frame>` (e.g. `arcadescr1_2` = anim 1, frame 2).
