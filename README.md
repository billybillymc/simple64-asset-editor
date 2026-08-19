# 64-asset-editor

Standalone in-browser pixel editor for AISLE √64's baked N64 assets
(game project: `C:\side\aisle-m64`, prototype: `C:\side\exit8-psx-love2d`).

- `asset-editor.tpl.html` — the editor source (edit THIS, not the generated file)
- `build-editor.ps1` — embeds every PNG from the game's `assets/` folders into
  the template as data URIs and writes `asset-editor.html`
- `asset-editor.html` — generated; open in any browser

## Workflow

1. `powershell -File build-editor.ps1` (re-run whenever the game's bake changes)
2. Open `asset-editor.html`, pick a store group, click a thumbnail, edit
3. Save PNG → drop into `aisle-m64\assets\shared\` or `assets\stores\sN\`
4. In the game repo:
   `docker run --rm -v C:\side\aisle-m64:/app -w /app aisle8-libdragon:preview bash tools/bake/convert.sh`
   then `make` in the same container.

CI4 note: most sprites quantize to 16 colors at bake — keep palettes tight.
Screens/title are IA8 (grayscale+alpha). Animation frames follow
`name<anim>_<frame>` (e.g. `arcadescr1_2` = anim 1, frame 2).
