const fs = require('fs')
const path = require('path')
const mainPath = path.join(process.cwd(), 'src', 'main.jsx')
const indexPath = path.join(process.cwd(), 'index.html')
const version = process.env.RELEASE_VERSION || '1.7.19'
let main = fs.readFileSync(mainPath, 'utf8')
let index = fs.readFileSync(indexPath, 'utf8')
index = index.replace(/ReadForge v\d+\.\d+\.\d+/g, `ReadForge v${version}`)
if (!main.includes("reader-features-restored")) {
  main = main.replace("import './styles.css'", "import './styles.css'\nimport { DEFAULT_SETTINGS, ReaderSettingsPanel, settingsVars } from './reader-features-restored.jsx'")
}
const oldBlock = `  const [speaking, setSpeaking] = React.useState(false)
  const pageRef = React.useRef(null)
  const chapter = data.chapters[chapterIndex] || data.chapters[0]
  React.useEffect(() => {
    setTimeout(() => pageRef.current?.scrollTo({ top:0, left:0 }), 0)
    onProgress(book.id, { progress:{ chapterIndex, paragraphIndex:0, pageIndex:0, percent:data.chapters.length ? Math.round((chapterIndex / data.chapters.length) * 100) : 0 }, lastOpenedAt:new Date().toISOString() })
  }, [chapterIndex])
  const move = delta => setChapterIndex(i => Math.max(0, Math.min(data.chapters.length - 1, i + delta)))
  const speak = () => {
    window.speechSynthesis?.cancel?.()
    if (speaking) { setSpeaking(false); return }
    const text = (chapter.paragraphs || []).map(p => p.text).join('\n\n')
    if (!text) return
    const u = new SpeechSynthesisUtterance(text)
    u.onend = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }
  return <main className="reader-screen" style={{ '--reader-bg':'#f4ead9', '--reader-text':'#271c14', '--reader-panel':'rgba(255,248,235,.9)', '--reader-soft':'#e6d3b8', '--reader-accent':'#956037', '--font-family':'Georgia', '--font-size':'20px', '--line-height':1.75, '--letter-spacing':'0px', '--paragraph-spacing':'1.1em', '--reader-margin':'44px', '--text-width':'860px', '--text-align':'left' }}>`
const newBlock = `  const [speaking, setSpeaking] = React.useState(false)
  const [voices, setVoices] = React.useState([])
  const [status, setStatus] = React.useState('')
  const [settings, setSettings] = React.useState({ ...DEFAULT_SETTINGS, ...(book.settings || {}), displayMode:(book.settings?.displayMode || 'original') })
  const pageRef = React.useRef(null)
  const sleepTimer = React.useRef(null)
  const chapter = data.chapters[chapterIndex] || data.chapters[0]
  const updateSettings = patch => { const next = { ...settings, ...patch }; setSettings(next); onProgress(book.id, { settings:next }) }
  const refreshVoices = () => { const list = window.speechSynthesis?.getVoices?.() || []; setVoices(list); if (list.length && !settings.voiceURI) updateSettings({ voiceURI:list[0].voiceURI, voiceName:list[0].name }); setStatus('Found ' + list.length + ' Voice Style(s).') }
  React.useEffect(() => { refreshVoices(); window.speechSynthesis?.addEventListener?.('voiceschanged', refreshVoices); return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', refreshVoices) }, [])
  React.useLayoutEffect(() => { pageRef.current?.scrollTo({ top:0, left:0 }); setTimeout(() => pageRef.current?.scrollTo({ top:0, left:0 }), 80) }, [chapterIndex])
  React.useEffect(() => { onProgress(book.id, { progress:{ chapterIndex, paragraphIndex:0, pageIndex:0, percent:data.chapters.length ? Math.round((chapterIndex / data.chapters.length) * 100) : 0 }, lastOpenedAt:new Date().toISOString() }) }, [chapterIndex])
  const stopVoice = () => { window.speechSynthesis?.cancel?.(); setSpeaking(false); if (sleepTimer.current) clearTimeout(sleepTimer.current) }
  const move = delta => { stopVoice(); setChapterIndex(i => Math.max(0, Math.min(data.chapters.length - 1, i + delta))) }
  const speak = () => {
    if (speaking) return stopVoice()
    const text = (chapter.paragraphs || []).map(p => p.text).join('\n\n')
    if (!text) { setStatus('This section has images but no readable text.'); return }
    const u = new SpeechSynthesisUtterance(text)
    const voice = voices.find(v => v.voiceURI === settings.voiceURI); if (voice) u.voice = voice
    u.rate = Math.max(.5, Math.min(7, Number(settings.rate)||1)); u.pitch = Math.max(0, Math.min(2, Number(settings.pitch)||1)); u.volume = Math.max(0, Math.min(1, Number(settings.volume)||1))
    u.onend = () => setSpeaking(false); u.onerror = () => { setSpeaking(false); setStatus('Voice Style failed. Try another voice.') }
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); setSpeaking(true); setStatus('Reading ' + chapter.title + '.')
    if (Number(settings.sleepTimerMinutes || 0) > 0) sleepTimer.current = setTimeout(stopVoice, Number(settings.sleepTimerMinutes) * 60000)
  }
  const contentHtml = settings.displayMode === 'original' ? (chapter?.html || '') : '<div>' + (chapter?.paragraphs || []).map(p => '<p>' + p.text + '</p>').join('') + '</div>'
  return <main className="reader-screen" style={settingsVars(settings)}>`
if (main.includes(oldBlock)) main = main.replace(oldBlock, newBlock)
main = main.replace("<button className=\"icon-button\" onClick={speak}>{speaking ? '■' : '▶'}</button>", "<button className=\"icon-button\" onClick={speak}>{speaking ? '■' : '▶'}</button><button className=\"icon-button\" onClick={stopVoice}>Stop</button>")
main = main.replace("dangerouslySetInnerHTML={{ __html: chapter?.html || '' }}", "dangerouslySetInnerHTML={{ __html: contentHtml }}")
main = main.replace("    <section className=\"reader-stage\"><div className=\"book-page scroll\"", "    <section className=\"reader-stage\"><div className=\"book-page scroll\"")
main = main.replace("  </main>\n}\nfunction App()", "    <ReaderSettingsPanel settings={settings} updateSettings={updateSettings} voices={voices} refreshVoices={refreshVoices} status={status} />\n  </main>\n}\nfunction App()")
fs.writeFileSync(mainPath, main, 'utf8')
fs.writeFileSync(indexPath, index, 'utf8')
console.log('Restored reader settings, themes, layout controls, and Voice Styles.')
