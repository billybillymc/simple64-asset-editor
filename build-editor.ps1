# Regenerate asset-editor.html from the template with every baked PNG from
# the AISLE root64 project embedded as a data URI (browsers can't read local
# folders from file://). Re-run after any bake so the gallery shows current art.
param([string]$GameRoot = "C:\side\aisle-m64")

$sb = New-Object System.Text.StringBuilder
$dirs = @(@{ key = "shared"; path = "$GameRoot\assets\shared" })
0..7 | ForEach-Object { $dirs += @{ key = "s$_"; path = "$GameRoot\assets\stores\s$_" } }

$n = 0
foreach ($d in $dirs) {
  if (-not (Test-Path $d.path)) { continue }
  foreach ($f in Get-ChildItem $d.path -Filter *.png) {
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName))
    [void]$sb.Append("`n`"$($d.key)/$($f.BaseName)`":`"data:image/png;base64,$b64`",")
    $n++
  }
}

$tpl = [IO.File]::ReadAllText("$PSScriptRoot\asset-editor.tpl.html")
$out = $tpl.Replace("/*__ASSETS__*/", $sb.ToString().TrimEnd(","))
[IO.File]::WriteAllText("$PSScriptRoot\asset-editor.html", $out)
Write-Output "embedded $n assets -> $PSScriptRoot\asset-editor.html ($([math]::Round($out.Length/1MB,2)) MB)"
