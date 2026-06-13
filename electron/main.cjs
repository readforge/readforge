const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const childProcess = require('child_process')
let autoUpdater = null
try { autoUpdater = require('electron-updater').autoUpdater } catch { autoUpdater = null }
let log = null
try { log = require('electron-log') } catch { log = console }

let mainWindow
let autoInstallAfterDownload = false

function sendUpdateEvent(payload) {
  try {
    if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('updater:event', payload)
  } catch {}
}

function setupAutoUpdater() {
  if (!autoUpdater) return
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  if (log && log.transports && log.transports.file) autoUpdater.logger = log

  autoUpdater.on('checking-for-update', () => sendUpdateEvent({ type: 'checking', message: 'Checking for updates...' }))
  autoUpdater.on('update-available', info => sendUpdateEvent({ type: 'available', info, message: `Update available: ${info?.version || 'new version'}` }))
  autoUpdater.on('update-not-available', info => sendUpdateEvent({ type: 'not-available', info, message: 'ReadForge is up to date.' }))
  autoUpdater.on('error', error => sendUpdateEvent({ type: 'error', message: error?.message || String(error) }))
  autoUpdater.on('download-progress', progress => sendUpdateEvent({ type: 'download-progress', progress, message: `Downloading update: ${Math.round(progress?.percent || 0)}%` }))
  autoUpdater.on('update-downloaded', info => {
    sendUpdateEvent({ type: 'downloaded', info, message: autoInstallAfterDownload ? 'Update downloaded. Restarting to install...' : 'Update downloaded. Restart to install.' })
    if (autoInstallAfterDownload) setTimeout(() => { try { autoUpdater.quitAndInstall(false, true) } catch (error) { sendUpdateEvent({ type: 'error', message: error?.message || String(error) }) } }, 1000)
  })
}

function userDataDir() { return app.getPath('userData') }
function libraryPath() { return path.join(userDataDir(), 'library.json') }
function booksDir() { return path.join(userDataDir(), 'books') }
function ensureDataDirs() { fs.mkdirSync(userDataDir(), { recursive: true }); fs.mkdirSync(booksDir(), { recursive: true }) }
function defaultLibrary() { return { version: 1, books: [], preferences: { view: 'grid', sort: 'recent', theme: 'system' } } }
function readLibrary() {
  ensureDataDirs()
  const file = libraryPath()
  if (!fs.existsSync(file)) { const lib = defaultLibrary(); fs.writeFileSync(file, JSON.stringify(lib, null, 2), 'utf-8'); return lib }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return { ...defaultLibrary(), ...parsed, books: Array.isArray(parsed.books) ? parsed.books : [] }
  } catch { return defaultLibrary() }
}
function writeLibrary(library) {
  ensureDataDirs()
  const safe = { ...defaultLibrary(), ...library, books: Array.isArray(library.books) ? library.books : [] }
  fs.writeFileSync(libraryPath(), JSON.stringify(safe, null, 2), 'utf-8')
  return safe
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1050, minHeight: 680,
    backgroundColor: '#111318', title: 'ReadForge', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  })
  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}
app.whenReady().then(() => { ensureDataDirs(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

ipcMain.handle('library:get', async () => readLibrary())
ipcMain.handle('library:save', async (_event, library) => writeLibrary(library))
ipcMain.handle('app:revealUserData', async () => { ensureDataDirs(); shell.openPath(userDataDir()); return userDataDir() })

ipcMain.handle('app:getVersion', async () => app.getVersion())

ipcMain.handle('app:openExternal', async (_event, url) => {
  const safe = String(url || '').trim()
  if (!/^https?:\/\//i.test(safe)) throw new Error('Only http/https links can be opened.')
  await shell.openExternal(safe)
  return true
})

ipcMain.handle('updater:checkForUpdates', async (_event, payload) => {
  if (!autoUpdater) {
    return { ok: false, message: 'The updater dependency is not installed yet. Run npm install, then rebuild ReadForge.' }
  }
  if (!app.isPackaged) {
    return {
      ok: false,
      devMode: true,
      message: 'Updater is ready, but automatic updates only work after ReadForge is built/installed from the release folder. Use 3_BUILD_WINDOWS_APP.bat first.'
    }
  }

  const provider = String(payload?.provider || '').trim()
  const owner = String(payload?.owner || '').trim()
  const repo = String(payload?.repo || '').trim()
  const feedUrl = String(payload?.feedUrl || '').trim()
  autoInstallAfterDownload = Boolean(payload?.autoInstall)
  autoUpdater.autoDownload = autoInstallAfterDownload

  if (provider === 'github' || (owner && repo)) {
    if (!owner || !repo) throw new Error('GitHub owner and repo are required.')
    autoUpdater.setFeedURL({ provider: 'github', owner, repo })
  } else if (feedUrl) {
    if (!/^https?:\/\//i.test(feedUrl)) throw new Error('Update feed URL must start with http:// or https://')
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    return { ok: true, message: 'Update check started.', result: result?.updateInfo || null }
  } catch (error) {
    return { ok: false, message: error?.message || String(error) }
  }
})

ipcMain.handle('updater:downloadUpdate', async () => {
  if (!autoUpdater) return { ok: false, message: 'Updater dependency is not installed.' }
  if (!app.isPackaged) return { ok: false, message: 'Download/install updates only work in the built app.' }
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true, message: 'Update download started.' }
  } catch (error) {
    return { ok: false, message: error?.message || String(error) }
  }
})

ipcMain.handle('updater:installUpdate', async () => {
  if (!autoUpdater) return { ok: false, message: 'Updater dependency is not installed.' }
  if (!app.isPackaged) return { ok: false, message: 'Install updates only work in the built app.' }
  autoUpdater.quitAndInstall(false, true)
  return { ok: true }
})


ipcMain.handle('book:import', async () => {
  ensureDataDirs()
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import a book into ReadForge', properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Readable books', extensions: ['epub', 'txt', 'html', 'htm'] },
      { name: 'EPUB', extensions: ['epub'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'HTML', extensions: ['html', 'htm'] }
    ]
  })
  if (result.canceled || !result.filePaths.length) return []
  const library = readLibrary(); const imported = []
  for (const filePath of result.filePaths) {
    const ext = path.extname(filePath).toLowerCase()
    const originalName = path.basename(filePath)
    const id = `${Date.now()}_${crypto.randomBytes(5).toString('hex')}`
    const destPath = path.join(booksDir(), `${id}${ext}`)
    fs.copyFileSync(filePath, destPath)
    const stats = fs.statSync(destPath)
    const entry = {
      id, title: path.basename(originalName, ext), author: '', fileName: originalName,
      extension: ext.replace('.', ''), storedPath: destPath, importedAt: new Date().toISOString(),
      lastOpenedAt: null, updatedAt: new Date().toISOString(), sizeBytes: stats.size,
      coverDataUrl: '', metadataParsed: false,
      progress: { chapterIndex: 0, paragraphIndex: 0, pageIndex: 0, scrollTop: 0, percent: 0 },
      settings: {}, bookmarks: [], highlights: [], notes: []
    }
    library.books.unshift(entry); imported.push(entry)
  }
  writeLibrary(library)
  return imported
})

ipcMain.handle('book:read', async (_event, bookId) => {
  const library = readLibrary(); const book = library.books.find(b => b.id === bookId)
  if (!book) throw new Error('Book not found in library.')
  if (!book.storedPath || !fs.existsSync(book.storedPath)) throw new Error('Book file is missing from ReadForge storage.')
  return fs.readFileSync(book.storedPath)
})

function encodePowerShell(script) { return Buffer.from(script, 'utf16le').toString('base64') }
function mapSpeechRateToSapi(speed) {
  const n = Number(speed || 1)
  if (n <= 0.5) return -6; if (n <= 0.75) return -3; if (n <= 1.1) return 0
  if (n <= 1.5) return 2; if (n <= 2) return 4; if (n <= 3) return 6; if (n <= 5) return 8
  return 10
}
ipcMain.handle('audio:exportChapterWav', async (_event, payload) => {
  if (process.platform !== 'win32') throw new Error('Chapter audio export is currently Windows-only.')
  const text = String(payload?.text || '').trim(); if (!text) throw new Error('No chapter text was available to export.')
  const saveResult = await dialog.showSaveDialog(mainWindow, {
    title: 'Export chapter audio',
    defaultPath: `${String(payload?.title || 'chapter').replace(/[\\/:*?"<>|]/g, '_')}.wav`,
    filters: [{ name: 'WAV audio', extensions: ['wav'] }]
  })
  if (saveResult.canceled || !saveResult.filePath) return { canceled: true }
  const voiceName = String(payload?.voiceName || '').replace(/^Windows:\s*/i, '').replace(/^Desktop:\s*/i, '')
  const rate = mapSpeechRateToSapi(payload?.rate || 1)
  const limitedText = text.length > 60000 ? text.slice(0, 60000) : text
  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = ${rate}
$s.Volume = 100
$voice = ${JSON.stringify(voiceName)}
if ($voice -and $voice.Length -gt 0) { try { $s.SelectVoice($voice) } catch { } }
$out = ${JSON.stringify(saveResult.filePath)}
$text = ${JSON.stringify(limitedText)}
$s.SetOutputToWaveFile($out)
$s.Speak($text)
$s.Dispose()
`
  const exe = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : 'powershell.exe'
  await new Promise((resolve, reject) => {
    const child = childProcess.spawn(exe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePowerShell(script)], { windowsHide: true })
    let err = ''; child.stderr.on('data', d => err += d.toString()); child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(err || `PowerShell exited with code ${code}`)))
  })
  return { canceled: false, filePath: saveResult.filePath, truncated: text.length > limitedText.length }
})


function windowsPowerShellExe() {
  return process.env.SystemRoot
    ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe'
}

function runPowerShellEncoded(script) {
  const exe = windowsPowerShellExe()
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(exe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePowerShell(script)], { windowsHide: true })
    let out = ''
    let err = ''
    child.stdout.on('data', d => out += d.toString())
    child.stderr.on('data', d => err += d.toString())
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve(out) : reject(new Error(err || out || `PowerShell exited with code ${code}`)))
  })
}

const winrtHeader = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Foundation.IAsyncOperation\`1, Windows.Foundation, ContentType=WindowsRuntime]
[void][Windows.Foundation.IAsyncOperationWithProgress\`2, Windows.Foundation, ContentType=WindowsRuntime]
[void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]
[void][Windows.Media.SpeechSynthesis.SpeechSynthesisStream, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]
[void][Windows.Media.SpeechSynthesis.VoiceInformation, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]

function AwaitWinRt($AsyncOperation, $ResultType) {
  $methods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.IsGenericMethodDefinition -and
    $_.GetParameters().Count -eq 1
  }
  $method = $methods | Where-Object { $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*' } | Select-Object -First 1
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOperation))
  $task.Wait()
  return $task.Result
}
`

ipcMain.handle('winrt:listVoices', async () => {
  if (process.platform !== 'win32') return []
  const script = winrtHeader + `
$voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
$result = @()
foreach ($v in $voices) {
  $result += [PSCustomObject]@{
    id = $v.Id
    displayName = $v.DisplayName
    description = $v.Description
    language = $v.Language
    gender = $v.Gender.ToString()
  }
}
$result | ConvertTo-Json -Depth 4
`
  const out = await runPowerShellEncoded(script)
  if (!out.trim()) return []
  const parsed = JSON.parse(out)
  return Array.isArray(parsed) ? parsed : [parsed]
})

ipcMain.handle('winrt:synthesizeSpeech', async (_event, payload) => {
  if (process.platform !== 'win32') throw new Error('Windows Natural voice synthesis is Windows-only.')

  ensureDataDirs()
  const tempDir = path.join(userDataDir(), 'temp-speech')
  fs.mkdirSync(tempDir, { recursive: true })

  const id = crypto.randomBytes(8).toString('hex')
  const inputPath = path.join(tempDir, `${id}.json`)
  const outputPath = path.join(tempDir, `${id}.wav`)

  const body = {
    text: String(payload?.text || '').slice(0, 12000),
    voiceId: String(payload?.voiceId || ''),
    voiceName: String(payload?.voiceName || ''),
    outputPath
  }
  fs.writeFileSync(inputPath, JSON.stringify(body), 'utf-8')

  const script = winrtHeader + `
$inputPath = ${JSON.stringify(inputPath)}
$data = Get-Content -Raw -Path $inputPath | ConvertFrom-Json
$text = [string]$data.text
$out = [string]$data.outputPath
$voiceId = [string]$data.voiceId
$voiceName = [string]$data.voiceName

$speech = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()
$voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices

if ($voiceId) {
  $match = $voices | Where-Object { $_.Id -eq $voiceId } | Select-Object -First 1
  if ($match) { $speech.Voice = $match }
}
if (-not $match -and $voiceName) {
  $match = $voices | Where-Object { $_.DisplayName -eq $voiceName -or $_.Description -like "*$voiceName*" } | Select-Object -First 1
  if ($match) { $speech.Voice = $match }
}

$escaped = [System.Security.SecurityElement]::Escape($text)
$lang = $speech.Voice.Language
$ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='$lang'><prosody rate='medium'>$escaped</prosody></speak>"

$stream = AwaitWinRt ($speech.SynthesizeSsmlToStreamAsync($ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$reader = [Windows.Storage.Streams.DataReader]::new($stream.GetInputStreamAt(0))
[void](AwaitWinRt ($reader.LoadAsync([uint32]$stream.Size)) ([uint32]))
$bytes = New-Object byte[] ([int]$stream.Size)
$reader.ReadBytes($bytes)
[System.IO.File]::WriteAllBytes($out, $bytes)
$speech.Dispose()
Write-Output $out
`
  try {
    await runPowerShellEncoded(script)
    const base64 = fs.readFileSync(outputPath).toString('base64')
    try { fs.unlinkSync(inputPath) } catch {}
    try { fs.unlinkSync(outputPath) } catch {}
    return {
      base64,
      mimeType: 'audio/wav',
      truncated: String(payload?.text || '').length > 12000
    }
  } catch (err) {
    try { fs.unlinkSync(inputPath) } catch {}
    try { fs.unlinkSync(outputPath) } catch {}
    throw err
  }
})
