<#
.SYNOPSIS
  Generate asset-editor.html from asset-editor.tpl.html.

.DESCRIPTION
  Browsers cannot read local folders from file://, so every baked PNG in the
  game project is embedded into the generated page as a data URI. Re-run after
  any bake so the gallery shows current art.

  Use -ReuseAssets to rebuild the page from the template alone, keeping the
  assets already embedded in a previously generated page (asset-editor.html by
  default, or -From <file>). That lets you iterate on the editor itself without
  access to the game repo.

.EXAMPLE
  .\build-editor.ps1 -GameRoot C:\path\to\game
.EXAMPLE
  .\build-editor.ps1 -ReuseAssets -Open
#>
[CmdletBinding(DefaultParameterSetName = 'Scan')]
param(
  # Root of the game repo (the folder that contains assets\).
  # Also accepts the assets\ folder itself.
  [Parameter(ParameterSetName = 'Scan', Position = 0)]
  [string]$GameRoot = $env:N64_GAME_ROOT,

  # Rebuild using the assets already embedded in a previously generated page.
  [Parameter(ParameterSetName = 'Reuse', Mandatory = $true)]
  [switch]$ReuseAssets,

  # Which generated page to take those assets from (default: the output file).
  [Parameter(ParameterSetName = 'Reuse')]
  [string]$From,

  # Where to write the generated page.
  [string]$Out,

  # Open the result in the default browser when done.
  [switch]$Open
)

$ErrorActionPreference = 'Stop'
$tplPath = Join-Path $PSScriptRoot 'asset-editor.tpl.html'
if (-not $Out) { $Out = Join-Path $PSScriptRoot 'asset-editor.html' }

if (-not (Test-Path -LiteralPath $tplPath)) {
  throw "template not found: $tplPath"
}
$tpl = [IO.File]::ReadAllText($tplPath)
foreach ($token in '/*__ASSETS__*/', '/*__BUILD__*/') {
  if ($tpl -notmatch [regex]::Escape($token)) {
    throw "template is missing the $token placeholder - is $tplPath the right file?"
  }
}

# JSON-escape a PNG basename so odd characters cannot break the generated object.
function ConvertTo-JsKey([string]$s) {
  $s.Replace('\', '\\').Replace('"', '\"')
}

$assetsJs = ''
$count = 0
$summary = @()

if ($ReuseAssets) {
  if (-not $From) { $From = Join-Path $PSScriptRoot 'asset-editor.html' }
  if (-not (Test-Path -LiteralPath $From)) {
    throw "-ReuseAssets needs an existing generated page to take the art from; $From is not there. Pass -From <file> or build once with -GameRoot."
  }
  $From = (Resolve-Path -LiteralPath $From).Path
  $prev = [IO.File]::ReadAllText($From)
  $m = [regex]::Match($prev, '(?s)const ASSETS = \{(.*?)\};\r?\n')
  if (-not $m.Success) {
    throw "could not find the embedded ASSETS block in $From"
  }
  $assetsJs = $m.Groups[1].Value
  $count = ([regex]::Matches($assetsJs, '"data:image/png;base64,')).Count
  $summary += "reused $count assets from $From"
}
else {
  if (-not $GameRoot) {
    throw @"
no -GameRoot given. Either:
  .\build-editor.ps1 -GameRoot C:\path\to\game
  `$env:N64_GAME_ROOT = 'C:\path\to\game'   (then just .\build-editor.ps1)
  .\build-editor.ps1 -ReuseAssets            (keep the art already embedded)
"@
  }
  if (-not (Test-Path -LiteralPath $GameRoot)) {
    throw "game root not found: $GameRoot"
  }
  $GameRoot = (Resolve-Path -LiteralPath $GameRoot).Path
  # accept either the game root or the assets folder itself
  $assetsRoot = Join-Path $GameRoot 'assets'
  if (-not (Test-Path -LiteralPath $assetsRoot)) {
    if ((Split-Path $GameRoot -Leaf) -eq 'assets') { $assetsRoot = $GameRoot }
    else { throw "no assets folder under $GameRoot (looked for $assetsRoot)" }
  }

  # shared\, then every folder under stores\ - discovered, not hard-coded to s0..s7
  $dirs = [ordered]@{}
  $shared = Join-Path $assetsRoot 'shared'
  if (Test-Path -LiteralPath $shared) { $dirs['shared'] = $shared }
  $stores = Join-Path $assetsRoot 'stores'
  if (Test-Path -LiteralPath $stores) {
    Get-ChildItem -LiteralPath $stores -Directory |
      Sort-Object { if ($_.Name -match '^s(\d+)$') { [int]$Matches[1] } else { [int]::MaxValue } }, Name |
      ForEach-Object { $dirs[$_.Name] = $_.FullName }
  }
  if ($dirs.Count -eq 0) {
    throw "found $assetsRoot but it has no shared\ or stores\ folders - is this the right game root?"
  }

  $sb = New-Object System.Text.StringBuilder
  foreach ($key in $dirs.Keys) {
    $n = 0
    $skipped = 0
    foreach ($f in Get-ChildItem -LiteralPath $dirs[$key] -Filter *.png -File | Sort-Object Name) {
      if ($f.Length -eq 0) { $skipped++; continue }
      $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName))
      [void]$sb.Append("`n`"$(ConvertTo-JsKey $key)/$(ConvertTo-JsKey $f.BaseName)`":`"data:image/png;base64,$b64`",")
      $n++
    }
    $count += $n
    $note = if ($skipped) { " ($skipped empty file(s) skipped)" } else { '' }
    $summary += ('  {0,-8} {1,4} png{2}' -f $key, $n, $note)
  }
  if ($count -eq 0) { Write-Warning "no PNGs found under $assetsRoot - the gallery will be empty" }
  $assetsJs = $sb.ToString().TrimEnd(',')
}

$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm')
$buildInfo = "$count assets, built $stamp"

$outText = $tpl.Replace('/*__ASSETS__*/', $assetsJs).Replace('/*__BUILD__*/', $buildInfo)
[IO.File]::WriteAllText($Out, $outText, (New-Object Text.UTF8Encoding($false)))

$summary | ForEach-Object { Write-Output $_ }
Write-Output ('embedded {0} assets -> {1} ({2} MB)' -f $count, $Out, [math]::Round($outText.Length / 1MB, 2))

if ($Open) { Start-Process $Out }
