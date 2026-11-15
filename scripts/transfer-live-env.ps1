param([ValidateSet('Start','Stop')][string]$Action='Start',[switch]$KeepMinio)
# Real services only. Test accounts/data use isolated schemas and loopback MinIO.
if($Action -eq 'Stop') {
 $ErrorActionPreference='Stop'
 $root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
 $testRoot=Join-Path $root 'bin\live-transfer';$setupPath=Join-Path $testRoot 'setup.json'
 if(!(Test-Path -LiteralPath $setupPath)){Write-Output 'No live-test environment recorded.';return}
 $setup=Get-Content -LiteralPath $setupPath | ConvertFrom-Json
 $env:ORCA_TEST_DATABASE_URL='postgres://orca:orca_secret@127.0.0.1:5432/orca_db?sslmode=disable'
 foreach($profile in $setup.profiles){
  foreach($kind in @('api','ui')){
   $processID=if($kind -eq 'api'){$profile.apiPID}else{$profile.uiPID}
   $process=Get-Process -Id $processID -ErrorAction SilentlyContinue
   if(!$process){continue}
   $valid=$false
   if($kind -eq 'api'){$valid=$process.Path.StartsWith((Join-Path $testRoot 'tools\orca-live-api'))}
   else{$details=Get-CimInstance Win32_Process -Filter "ProcessId=$processID";$valid=$details.CommandLine.Contains((Join-Path $root 'web\node_modules\vite\bin\vite.js')) -and $details.CommandLine.Contains("--port $($profile.uiPort)")}
   if(!$valid){throw "Refusing to stop unrelated process $processID"};Stop-Process -Id $processID
  }
  & (Join-Path $testRoot 'tools\live-transfer-helper.exe') schema-drop $profile.schema
  if($LASTEXITCODE -ne 0){throw 'Temporary schema cleanup failed'}
 }
 if(!$KeepMinio){$minio=Get-Process -Id $setup.minioPID -ErrorAction SilentlyContinue;if($minio){if($minio.Path -ne (Join-Path $testRoot 'tools\minio.exe')){throw 'Unexpected MinIO process'};Stop-Process -Id $minio.Id}}
 $setup | Add-Member -NotePropertyName cleanedAt -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
 $setup | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $setupPath
 Write-Output 'Stopped test services and removed only their temporary schemas. Artifacts retained under bin/live-transfer.'
 return
}
Push-Location (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
try {
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$testRoot=Join-Path $root 'bin\live-transfer'
$tools=Join-Path $testRoot 'tools'
foreach($testPort in @(8081,8082,3001,3002)){if(Get-NetTCPConnection -LocalPort $testPort -State Listen -ErrorAction SilentlyContinue){throw "Test port $testPort is occupied; stop the previous test environment first."}}
$envPath=Join-Path $testRoot 'minio.env'
if (!(Test-Path -LiteralPath $envPath)) {
 $minioUser='orca-live-'+[guid]::NewGuid().ToString('N').Substring(0,8)
 $minioPassword=[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
 @("MINIO_ROOT_USER=$minioUser","MINIO_ROOT_PASSWORD=$minioPassword") | Set-Content -LiteralPath $envPath
}
Get-Content -LiteralPath $envPath | ForEach-Object { $parts=$_ -split '=',2; [Environment]::SetEnvironmentVariable($parts[0],$parts[1],'Process') }
$minioPath=Join-Path $tools 'minio.exe'
if (!(Test-Path -LiteralPath $minioPath)) { $env:GOBIN=$tools; go install -p 2 github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z; if($LASTEXITCODE -ne 0){throw 'MinIO build failed'} }
$listener=Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue
if ($listener) { $minioProcess=Get-Process -Id ($listener | Select-Object -First 1 -ExpandProperty OwningProcess); if ($minioProcess.Path -ne $minioPath) { throw 'Port 9000 belongs to another service' } }
else {
 New-Item -ItemType Directory -Force -Path (Join-Path $testRoot 'minio-data') | Out-Null
 $minioProcess=Start-Process -FilePath $minioPath -ArgumentList @('server',(Join-Path $testRoot 'minio-data'),'--address','127.0.0.1:9000','--console-address','127.0.0.1:9001') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'minio.log') -RedirectStandardError (Join-Path $testRoot 'minio-error.log')
}
for ($attempt=0;$attempt -lt 20;$attempt++) { try { $null=Invoke-WebRequest 'http://127.0.0.1:9000/minio/health/live' -UseBasicParsing; break } catch { if ($attempt -eq 19) {throw}; Start-Sleep -Milliseconds 500 } }
$helper=Join-Path $tools 'live-transfer-helper.exe'
go build -o $helper ./scripts/live-transfer-helper; if($LASTEXITCODE -ne 0){throw 'Live helper build failed'}
go build -o (Join-Path $tools 'orca-live-api.exe') ./cmd/server; if($LASTEXITCODE -ne 0){throw 'Test API build failed'}
& $helper bucket-init; if ($LASTEXITCODE -ne 0) {throw 'MinIO bucket setup failed'}
$env:ORCA_TEST_DATABASE_URL='postgres://orca:orca_secret@127.0.0.1:5432/orca_db?sslmode=disable'
$run=[guid]::NewGuid().ToString('N').Substring(0,12)
$profiles=@()
foreach ($kind in @('local','s3')) {
 $schema="orca_live_${kind}_$run"
 & $helper schema-create $schema; if ($LASTEXITCODE -ne 0) {throw 'Schema setup failed'}
 $port=if($kind -eq 'local'){8081}else{8082}; $uiPort=if($kind -eq 'local'){3001}else{3002}
 $env:ENV='test';$env:PORT="$port";$env:DATABASE_URL="$($env:ORCA_TEST_DATABASE_URL)&search_path=$schema";$env:DB_MIN_CONNS='1';$env:DB_MAX_CONNS='10';$env:AUTO_MIGRATE='true';$env:ALLOW_REGISTRATION='true';$env:ALLOW_DEV_WORKSPACE_HEADER='false';$env:JWT_SECRET=[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32));$env:CORS_ALLOWED_ORIGINS='http://127.0.0.1:3001,http://127.0.0.1:3002,http://localhost:3001,http://localhost:3002'
 $env:STORAGE_DRIVER=$kind;$env:STORAGE_LOCAL_DIR=Join-Path $testRoot 'local-uploads'
 $env:STORAGE_S3_ENDPOINT='http://127.0.0.1:9000';$env:STORAGE_S3_BUCKET='orca-live';$env:STORAGE_S3_REGION='us-east-1';$env:STORAGE_S3_ACCESS_KEY=$env:MINIO_ROOT_USER;$env:STORAGE_S3_SECRET_KEY=$env:MINIO_ROOT_PASSWORD;$env:STORAGE_S3_PUBLIC_URL_BASE='http://127.0.0.1:9000/orca-live'
 if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Test API port $port is occupied"}
 $api=Start-Process -FilePath (Join-Path $tools 'orca-live-api.exe') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot "$kind-api.log") -RedirectStandardError (Join-Path $testRoot "$kind-api-error.log")
 $env:VITE_API_URL="http://127.0.0.1:$port/api/v1"
 if(Get-NetTCPConnection -LocalPort $uiPort -State Listen -ErrorAction SilentlyContinue){throw "Test UI port $uiPort is occupied"}
 $ui=Start-Process -FilePath (Get-Command node).Source -ArgumentList @((Join-Path $root 'web\node_modules\vite\bin\vite.js'),'--host','127.0.0.1','--port',"$uiPort",'--strictPort') -WorkingDirectory (Join-Path $root 'web') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot "$kind-ui.log") -RedirectStandardError (Join-Path $testRoot "$kind-ui-error.log")
 $profiles+=@{kind=$kind;schema=$schema;apiPort=$port;uiPort=$uiPort;apiPID=$api.Id;uiPID=$ui.Id}
}
@{run=$run;minioPID=$minioProcess.Id;profiles=$profiles} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $testRoot 'setup.json')
foreach ($profile in $profiles) {for($attempt=0;$attempt -lt 30;$attempt++){try{$health=Invoke-RestMethod "http://127.0.0.1:$($profile.apiPort)/healthz"; if($health.status -eq 'ok'){break}}catch{if($attempt -eq 29){throw};Start-Sleep -Milliseconds 500}}}
Write-Output 'MinIO and isolated Local/S3 API + UI services are running.'

} finally { Pop-Location }
