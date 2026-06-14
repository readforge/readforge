import React from 'react'
import { createRoot } from 'react-dom/client'
import JSZip from 'jszip'
import './styles.css'

function local(el) { return (el?.localName || el?.tagName || '').split(':').pop().toLowerCase() }
function allByLocal(doc, name) { return [...doc.getElementsByTagName('*')].filter(el => local(el) === name.toLowerCase()) }
function textByLocal(doc, name) { return allByLocal(doc, name)[0]?.textContent?.trim() || '' }
function cleanPath(p) {
  const out = []
  String(p || '').replace(/\\/g, '/').split('/').forEach(part => {
    if (!part || part === '.') return
    if (part === '..') out.pop()
    else out.push(part)
  })
  return out.join('/')
}
function joinPath(base, href) { return cleanPath(base ? `${base}/${String(href || '').split('#')[0].split('?')[0]}` : String(href || '').split('#')[0].split('?')[0]) }
function zipFile(zip, p) {
  const n = cleanPath(p)
  return zip.file(n) || zip.file(decodeURIComponent(n)) || zip.file(n.replace(/%20/g, ' '))
}
function bufferToArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input
  if (input?.buffer instanceof ArrayBuffer) return input.buffer.slice(input.byteOffset || 0, (input.byteOffset || 0) + (input.byteLength || input.length || 0))
  if (input?.type === 'Buffer' && Array.isArray(input.data)) return new Uint8Array(input.data).buffer
  if (Array.isArray(input)) return new Uint8Array(input).buffer
  throw new Error('Could not read this book file.')
}
function mimeFromPath(p) {
  const ext = String(p || '').split('?')[0].split('#')[0].split('.').pop().toLowerCase()
  return ({ jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', bmp:'image/bmp', avif:'image/avif' })[ext] || 'application/octet-stream'
}
function keyText(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '') }
function cleanChapterTitle(raw, fallback, bookTitle, index) {
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
  const rawClean = clean(raw)
  const fallbackClean = clean(fallback).replace(/[_-]+/g, ' ')
  const bookKey = keyText(bookTitle)
  const bad = value => {
    const k = keyText(value)
    return !k || k === bookKey || (bookKey && k.includes(bookKey)) || /^\d+$/.test(k) || /^chapter\d+[a-z]?$/.test(k) || /^page\d+$/i.test(k) || /^(cover|titlepage|copyright|contents|tableofcontents|nav|navigation|newsletter|signup)$/i.test(k)
  }
  if (!bad(rawClean)) return rawClean
  if (!bad(fallbackClean)) return fallbackClean
  return `Chapter ${index + 1}`
}
function groupInfo(item, index) {
  const href = String(item?.href || '')
  const base = href.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase()
  if (/copyright|newsletter|signup/.test(base)) return null
  if (/^(titlepage|insert\d+)/.test(base)) return { id:'illustrations', label:'Illustrations' }
  const chapter = base.match(/^chapter(\d+)[a-z]?$/)
  if (chapter) return { id:`chapter-${Number(chapter[1])}`, label:`Chapter ${Number(chapter[1])}` }
  const appendix = base.match(/^appendix(\d+)(?:_split\d+)?$/)
  if (appendix) return { id:`appendix-${Number(appendix[1])}`, label:`Appendix ${Number(appendix[1])}` }
  return { id:`section-${index}`, label:base.replace(/[-_]+/g, ' ') || `Section ${index + 1}` }
}
function sanitize(doc) {
  doc.querySelectorAll('script,iframe,object,embed').forEach(el => el.remove())
  doc.querySelectorAll('*').forEach(el => [...el.attributes].forEach(a => {
    if (a.name.toLowerCase().startsWith('on')) el.removeAttribute(a.name)
  }))
}
async function inlineAssets(doc, zip, chapterPath) {
  const base = String(chapterPath || '').split('/').slice(0, -1).join('/')
  const resolve = async raw => {
    const value = String(raw || '').trim()
    if (!value || /^(data:|https?:|blob:|mailto:|#)/i.test(value)) return value
    const clean = value.split('#')[0].split('?')[0]
    const file = zipFile(zip, joinPath(base, clean)) || zipFile(zip, clean)
    if (!file) return value
    return `data:${mimeFromPath(clean)};base64,${await file.async('base64')}`
  }
  for (const img of [...doc.querySelectorAll('img')]) {
    const next = await resolve(img.getAttribute('src'))
    if (next) img.setAttribute('src', next)
  }
  for (const image of [...doc.querySelectorAll('image')]) {
    const raw = image.getAttribute('href') || image.getAttribute('xlink:href')
    const next = await resolve(raw)
    if (next) { image.setAttribute('href', next); image.setAttribute('xlink:href', next) }
  }
}
async function chapterFromItem(zip, item, bookTitle, fallback, index) {
  const file = zipFile(zip, item.fullPath)
  if (!file) return null
  const html = await file.async('text')
  const doc = new DOMParser().parseFromString(html, 'text/html')
  sanitize(doc)
  await inlineAssets(doc, zip, item.fullPath)
  const body = doc.body || doc.documentElement
  const heading = doc.querySelector('h1,h2,h3,h4,h5,h6')?.textContent?.trim() || ''
  const title = cleanChapterTitle(heading, fallback, bookTitle, index)
  const nodes = [...body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption')]
  const pathKey = keyText(item.fullPath).slice(-10)
  const paragraphs = nodes.map((el, i) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
      const id = `${index}_${pathKey}_${i}`
      if (text) el.setAttribute('data-rf-read-id', id)
      return { id, tag:local(el), text }
    })
    .filter(p => p.text)
  return { title, html:body.innerHTML, paragraphs }
}
async function parseEpub(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const container = zipFile(zip, 'META-INF/container.xml')
  if (!container) throw new Error('This EPUB is missing META-INF/container.xml.')
  const cdoc = new DOMParser().parseFromString(await container.async('text'), 'application/xml')
  const rootfile = allByLocal(cdoc, 'rootfile')[0]?.getAttribute('full-path')
  if (!rootfile) throw new Error('Could not find the EPUB package file.')
  const opfFile = zipFile(zip, rootfile)
  if (!opfFile) throw new Error('Could not open the EPUB package file.')
  const opf = new DOMParser().parseFromString(await opfFile.async('text'), 'application/xml')
  const base = rootfile.split('/').slice(0, -1).join('/')
  const title = textByLocal(opf, 'title') || 'Untitled Book'
  const author = textByLocal(opf, 'creator') || ''
  const manifest = {}
  allByLocal(opf, 'item').forEach(item => {
    const id = item.getAttribute('id'), href = item.getAttribute('href')
    if (id && href) manifest[id] = { id, href, fullPath:joinPath(base, href), mediaType:item.getAttribute('media-type') || '', properties:item.getAttribute('properties') || '' }
  })
  const spine = allByLocal(opf, 'itemref').map(x => x.getAttribute('idref')).filter(Boolean)
  let coverDataUrl = ''
  const coverId = allByLocal(opf, 'meta').find(m => m.getAttribute('name') === 'cover')?.getAttribute('content')
  const coverItem = (coverId && manifest[coverId]) || Object.values(manifest).find(x => x.properties.includes('cover-image')) || Object.values(manifest).find(x => x.mediaType.startsWith('image/') && /cover|front/i.test(`${x.id} ${x.href}`))
  if (coverItem) {
    const f = zipFile(zip, coverItem.fullPath)
    if (f) coverDataUrl = `data:${coverItem.mediaType || mimeFromPath(coverItem.href)};base64,${await f.async('base64')}`
  }
  const groups = []
  for (const id of spine) {
    const item = manifest[id]
    if (!item) continue
    if (!/html|xhtml|xml/i.test(item.mediaType) && !/\.(xhtml|html|htm|xml)$/i.test(item.href)) continue
    const info = groupInfo(item, groups.length)
    if (!info) continue
    const last = groups[groups.length - 1]
    if (last && last.id === info.id) last.items.push(item)
    else groups.push({ ...info, items:[item] })
  }
  const chapters = []
  for (const group of groups) {
    const htmlParts = []
    const paragraphs = []
    let groupTitle = group.label
    for (const item of group.items) {
      const fallback = item.href.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
      const parsed = await chapterFromItem(zip, item, title, fallback, chapters.length)
      if (!parsed) continue
      if (parsed.title && (/^Chapter \d+$/.test(groupTitle) || /^Appendix \d+$/.test(groupTitle))) groupTitle = cleanChapterTitle(parsed.title, groupTitle, title, chapters.length)
      if (parsed.html) htmlParts.push(`<section class="rf-spine-part">${parsed.html}</section>`)
      paragraphs.push(...parsed.paragraphs)
    }
    if (htmlParts.length || paragraphs.length) {
      const finalTitle = cleanChapterTitle(groupTitle, group.label, title, chapters.length)
      chapters.push({ index:chapters.length, title:finalTitle, html:htmlParts.join('\n'), paragraphs, href:group.items[0]?.href || '' })
    }
  }
  const toc = chapters.map((ch, i) => ({ label:ch.title || `Chapter ${i + 1}`, chapterIndex:i, paragraphIndex:0 }))
  const wordCount = chapters.reduce((s, ch) => s + ch.paragraphs.reduce((a, p) => a + p.text.split(/\s+/).filter(Boolean).length, 0), 0)
  return { title, author, coverDataUrl, chapters, toc, wordCount }
}
function cover(title, author, url) {
  if (url) return <img src={url} className="book-cover" alt="" />
  return <div className="generated-cover"><div className="cover-initials">RF</div><div className="cover-title">{title}</div>{author ? <div className="cover-author">{author}</div> : null}</div>
}
function Library({ library, onImport, onOpen }) {
  const books = library.books || []
  return <main className="library-screen">
    <section className="hero-panel"><div><p className="eyebrow">ReadForge</p><h1>Your EPUB library.</h1><p className="hero-copy">Fixed EPUB rendering mode: images, grouped chapters, and clean navigation.</p></div><button className="primary-button big" onClick={onImport}>＋ Import books</button></section>
    {!books.length ? <section className="empty-state glass"><h2>No books yet</h2><p>Import an EPUB to start reading.</p><button className="primary-button" onClick={onImport}>Import your first book</button></section> : <section className="book-grid">{books.map(book => <button key={book.id} className="book-card glass" onClick={() => onOpen(book)}><div className="book-cover-wrap">{cover(book.title || 'Untitled', book.author || '', book.coverDataUrl)}</div><div className="book-info"><h3>{book.title || 'Untitled'}</h3><p>{book.author || 'Unknown author'}</p><small>{book.progress?.percent || 0}% read</small></div></button>)}</section>}
  </main>
}
const THEMES = {
  library:['Cozy Library','#f4ead9','#271c14','rgba(255,248,235,.9)','#956037'], light:['Modern Light','#f7f8fb','#1f242d','rgba(255,255,255,.9)','#5877e2'], dark:['Soft Dark','#12141b','#eceff7','rgba(28,31,42,.9)','#8da2fb'], sepia:['Sepia','#ead9bc','#2e2115','rgba(255,244,222,.9)','#8a5d36'], midnight:['Midnight Blue','#081321','#e5f0ff','rgba(14,31,54,.9)','#65a5ff'], forest:['Forest','#101b14','#edf8ee','rgba(23,44,30,.9)','#8bcf8b'], contrast:['High Contrast','#000','#fff','#111','#ff0']
}
const FONTS = ['Georgia','Cambria','Palatino Linotype','Segoe UI','Arial','Verdana','Tahoma','Times New Roman','Trebuchet MS','Calibri','Consolas','Courier New']
const DEFAULT_SETTINGS = { tab:'voice', theme:'library', fontFamily:'Georgia', fontSize:20, lineHeight:1.75, paragraphSpacing:1.1, margin:44, textWidth:860, textAlign:'left', rate:1, pitch:1, volume:1, voiceURI:'', paragraphFollow:'paragraphWash', wordFollow:'pill', autoScroll:true }
function settingsStyle(settings) {
  const t = THEMES[settings.theme] || THEMES.library
  return { '--reader-bg':t[1], '--reader-text':t[2], '--reader-panel':t[3], '--reader-soft':t[3], '--reader-accent':t[4], '--font-family':settings.fontFamily, '--font-size':`${settings.fontSize}px`, '--line-height':settings.lineHeight, '--letter-spacing':'0px', '--paragraph-spacing':`${settings.paragraphSpacing}em`, '--reader-margin':`${settings.margin}px`, '--text-width':`${settings.textWidth}px`, '--text-align':settings.textAlign }
}
function fmt(key, value) {
  if (key === 'rate') return `${Number(value).toFixed(1)}x`
  if (key === 'volume') return `${Math.round(Number(value) * 100)}%`
  if (key === 'lineHeight') return Number(value).toFixed(2)
  if (key === 'paragraphSpacing') return `${Number(value).toFixed(1)}em`
  if (['fontSize','margin','textWidth'].includes(key)) return `${value}px`
  return value
}
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch])) }
function wordIndexFor(text, charIndex) {
  const words = [...String(text || '').matchAll(/\S+/g)]
  const hit = words.findIndex(m => charIndex >= m.index && charIndex <= m.index + m[0].length)
  return hit >= 0 ? hit : 0
}
function restoreWordMarks() {
  document.querySelectorAll('[data-rf-wordized="true"]').forEach(el => {
    if (el.dataset.rfOriginalHtml != null) el.innerHTML = el.dataset.rfOriginalHtml
    delete el.dataset.rfOriginalHtml
    delete el.dataset.rfWordized
  })
}
function wordStyle(style) {
  const accent = 'var(--reader-accent)'
  const text = 'var(--reader-text)'
  const bg = 'var(--reader-bg)'
  const styles = {
    pill:`background:${accent};color:white;border-radius:.35em;padding:.03em .18em;box-shadow:0 0 0 .16em color-mix(in srgb,${accent},transparent 66%)`,
    glow:`background:color-mix(in srgb,${accent},transparent 68%);color:${text};border-radius:.35em;padding:.03em .18em;box-shadow:0 0 18px color-mix(in srgb,${accent},transparent 20%)`,
    underline:`background:transparent;color:${text};text-decoration:underline 3px ${accent};text-underline-offset:.24em`,
    outline:`background:transparent;color:${text};outline:2px solid ${accent};border-radius:.35em;padding:.03em .16em`,
    invert:`background:${text};color:${bg};border-radius:.35em;padding:.03em .18em`,
    box:`background:color-mix(in srgb,${accent},transparent 78%);color:${text};border:2px solid ${accent};border-radius:.2em;padding:.02em .14em`
  }
  return styles[style] || styles.pill
}
function decorateWord(el, wordIndex, style) {
  if (!el || style === 'off') return
  restoreWordMarks()
  const text = el.innerText || ''
  const parts = text.match(/\S+|\s+/g) || []
  let count = -1
  el.dataset.rfOriginalHtml = el.innerHTML
  el.dataset.rfWordized = 'true'
  el.innerHTML = parts.map(part => {
    if (/\S/.test(part)) {
      count += 1
      if (count === wordIndex) return `<span class="spoken-word" style="${wordStyle(style)}">${escapeHtml(part)}</span>`
    }
    return escapeHtml(part)
  }).join('')
}
function Slider({ label, value, min, max, step, suffixKey, onChange }) {
  return <label className="setting-row"><span>{label}</span><div className="setting-control"><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /><b>{fmt(suffixKey, value)}</b></div></label>
}
function ReaderTools({ settings, updateSettings, voices, refreshVoices, speaking, paused, speak, pauseVoice, resumeVoice, stopVoice, status, nowReading, toggleFullscreen }) {
  const themeOptions = Object.entries(THEMES)
  return <aside className="reader-sidebar right glass"><h2>Reader Tools</h2><div className="panel-tabs"><button className={settings.tab === 'appearance' ? 'active' : ''} onClick={() => updateSettings({ tab:'appearance' })}>Appearance</button><button className={settings.tab === 'voice' ? 'active' : ''} onClick={() => updateSettings({ tab:'voice' })}>Voice</button><button className={settings.tab === 'follow' ? 'active' : ''} onClick={() => updateSettings({ tab:'follow' })}>Follow</button></div>{settings.tab === 'appearance' ? <div><label className="setting-row"><span>Theme</span><select value={settings.theme} onChange={e => updateSettings({ theme:e.target.value })}>{themeOptions.map(([k,v]) => <option key={k} value={k}>{v[0]}</option>)}</select></label><label className="setting-row"><span>Font</span><select value={settings.fontFamily} onChange={e => updateSettings({ fontFamily:e.target.value })}>{FONTS.map(f => <option key={f}>{f}</option>)}</select></label><Slider label="Font size" value={settings.fontSize} min={12} max={42} step={1} suffixKey="fontSize" onChange={v => updateSettings({ fontSize:v })}/><Slider label="Line height" value={settings.lineHeight} min={1.1} max={2.6} step={.05} suffixKey="lineHeight" onChange={v => updateSettings({ lineHeight:v })}/><Slider label="Paragraph gap" value={settings.paragraphSpacing} min={.4} max={3} step={.1} suffixKey="paragraphSpacing" onChange={v => updateSettings({ paragraphSpacing:v })}/><Slider label="Margins" value={settings.margin} min={12} max={110} step={2} suffixKey="margin" onChange={v => updateSettings({ margin:v })}/><Slider label="Text width" value={settings.textWidth} min={520} max={1250} step={10} suffixKey="textWidth" onChange={v => updateSettings({ textWidth:v })}/><label className="setting-row"><span>Text alignment</span><select value={settings.textAlign} onChange={e => updateSettings({ textAlign:e.target.value })}><option value="left">Left</option><option value="justify">Justify</option><option value="center">Center</option></select></label></div> : settings.tab === 'follow' ? <div><label className="setting-row"><span>Paragraph highlight</span><select value={settings.paragraphFollow} onChange={e => updateSettings({ paragraphFollow:e.target.value })}><option value="off">Off</option><option value="paragraphWash">Soft paragraph wash</option><option value="underlineOnly">Underline paragraph</option><option value="spotlight">Spotlight paragraph</option><option value="minimal">Left marker</option></select></label><label className="setting-row"><span>Spoken word highlight</span><select value={settings.wordFollow} onChange={e => updateSettings({ wordFollow:e.target.value })}><option value="off">Off</option><option value="pill">Solid pill</option><option value="glow">Glow</option><option value="underline">Underline word</option><option value="outline">Outline box</option><option value="invert">Invert colors</option><option value="box">Accent box</option></select></label><label className="setting-row"><span>Auto-scroll to spoken text</span><select value={settings.autoScroll ? 'yes' : 'no'} onChange={e => updateSettings({ autoScroll:e.target.value === 'yes' })}><option value="yes">On</option><option value="no">Off</option></select></label><button className="primary-button full" onClick={toggleFullscreen}>⛶ Clean full screen</button><p className="hint">{nowReading || 'Not reading yet.'}</p></div> : <div><button className="primary-button full" onClick={speak}>{speaking ? '■ Stop read aloud' : '▶ Read aloud'}</button><div className="two-col"><button className="ghost-button full" onClick={pauseVoice}>Pause</button><button className="ghost-button full" onClick={resumeVoice}>Resume</button></div><button className="ghost-button full" onClick={stopVoice}>Stop voice</button><button className="ghost-button full" onClick={refreshVoices}>Refresh voices</button><label className="setting-row"><span>Voice</span><select value={settings.voiceURI} onChange={e => updateSettings({ voiceURI:e.target.value })}>{voices.length ? voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} {v.lang ? `(${v.lang})` : ''}</option>) : <option value="">No voices found</option>}</select></label><Slider label="Speed" value={settings.rate} min={.5} max={7} step={.1} suffixKey="rate" onChange={v => updateSettings({ rate:v })}/><Slider label="Pitch" value={settings.pitch} min={0} max={2} step={.1} suffixKey="pitch" onChange={v => updateSettings({ pitch:v })}/><Slider label="Volume" value={settings.volume} min={0} max={1} step={.05} suffixKey="volume" onChange={v => updateSettings({ volume:v })}/><p className="hint">{paused ? 'Paused' : (status || `Speed is ${fmt('rate', settings.rate)}`)}</p></div>}</aside>
}
function Reader({ book, data, onBack, onProgress }) {
  const [chapterIndex, setChapterIndex] = React.useState(Math.max(0, Math.min(book.progress?.chapterIndex || 0, data.chapters.length - 1)))
  const [speaking, setSpeaking] = React.useState(false)
  const [paused, setPaused] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(Boolean(document.fullscreenElement))
  const [voices, setVoices] = React.useState([])
  const [status, setStatus] = React.useState('')
  const [activeReadId, setActiveReadId] = React.useState('')
  const [activeWordIndex, setActiveWordIndex] = React.useState(-1)
  const [nowReading, setNowReading] = React.useState('')
  const [settings, setSettings] = React.useState({ ...DEFAULT_SETTINGS, ...(book.settings || {}), paragraphFollow:book.settings?.paragraphFollow || book.settings?.follow || DEFAULT_SETTINGS.paragraphFollow, wordFollow:book.settings?.wordFollow || DEFAULT_SETTINGS.wordFollow })
  const pageRef = React.useRef(null)
  const chapter = data.chapters[chapterIndex] || data.chapters[0]
  const chunks = React.useMemo(() => { let pos = 0; return (chapter?.paragraphs || []).map((p, i) => { const start = pos; pos += p.text.length + 2; return { ...p, index:i, start, end:start + p.text.length } }) }, [chapter])
  const updateSettings = patch => { const next = { ...settings, ...patch }; setSettings(next); onProgress(book.id, { settings:next }) }
  const refreshVoices = () => { const list = window.speechSynthesis?.getVoices?.() || []; setVoices(list); if (list.length && !settings.voiceURI) updateSettings({ voiceURI:list[0].voiceURI }); setStatus(`Found ${list.length} voices. Speed is ${fmt('rate', settings.rate)}`) }
  React.useEffect(() => { refreshVoices(); window.speechSynthesis?.addEventListener?.('voiceschanged', refreshVoices); return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', refreshVoices) }, [])
  React.useEffect(() => { const sync = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync) }, [])
  React.useEffect(() => { setTimeout(() => pageRef.current?.scrollTo({ top:0, left:0 }), 0); onProgress(book.id, { progress:{ chapterIndex, paragraphIndex:0, pageIndex:0, percent:data.chapters.length ? Math.round((chapterIndex / data.chapters.length) * 100) : 0 }, lastOpenedAt:new Date().toISOString() }) }, [chapterIndex])
  React.useEffect(() => { restoreWordMarks(); document.querySelectorAll('.active-read').forEach(el => el.classList.remove('active-read','paragraphWash','underlineOnly','spotlight','minimal')); if (!activeReadId) return; const el = document.querySelector(`[data-rf-read-id="${activeReadId}"]`); if (!el) return; if (settings.paragraphFollow !== 'off') el.classList.add('active-read', settings.paragraphFollow); if (settings.wordFollow !== 'off') decorateWord(el, activeWordIndex, settings.wordFollow); if (settings.autoScroll) el.scrollIntoView({ block:'center', behavior:'smooth' }) }, [activeReadId, activeWordIndex, settings.paragraphFollow, settings.wordFollow, settings.autoScroll])
  const stopVoice = () => { window.speechSynthesis?.cancel?.(); setSpeaking(false); setPaused(false); setStatus('Stopped'); setActiveReadId(''); setActiveWordIndex(-1); restoreWordMarks() }
  const pauseVoice = () => { window.speechSynthesis?.pause?.(); setPaused(true); setStatus('Paused') }
  const resumeVoice = () => { window.speechSynthesis?.resume?.(); setPaused(false); setStatus(`Reading at ${fmt('rate', settings.rate)}`) }
  const toggleFullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
  const move = delta => { stopVoice(); setChapterIndex(i => Math.max(0, Math.min(data.chapters.length - 1, i + delta))) }
  const speak = () => {
    if (speaking) return stopVoice()
    const text = chunks.map(c => c.text).join('\n\n')
    if (!text) { setStatus('No readable text in this section.'); return }
    const u = new SpeechSynthesisUtterance(text)
    const voice = voices.find(v => v.voiceURI === settings.voiceURI)
    if (voice) u.voice = voice
    u.rate = Math.max(.5, Math.min(7, Number(settings.rate) || 1)); u.pitch = Math.max(0, Math.min(2, Number(settings.pitch) || 1)); u.volume = Math.max(0, Math.min(1, Number(settings.volume) || 1))
    u.onboundary = e => { if (typeof e.charIndex !== 'number') return; const hit = chunks.find(c => e.charIndex >= c.start && e.charIndex <= c.end) || chunks[chunks.length - 1]; if (hit) { const wordIndex = wordIndexFor(hit.text, Math.max(0, e.charIndex - hit.start)); setActiveReadId(hit.id); setActiveWordIndex(wordIndex); setNowReading(`Reading ${hit.index + 1} of ${chunks.length}: ${hit.text.slice(0, 90)}${hit.text.length > 90 ? '…' : ''}`) } }
    u.onend = () => { setSpeaking(false); setPaused(false); setStatus('Finished'); setActiveReadId(''); setActiveWordIndex(-1); restoreWordMarks() }
    u.onerror = () => { setSpeaking(false); setPaused(false); setStatus('Voice failed. Try another voice.') }
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); setSpeaking(true); setPaused(false); setStatus(`Reading at ${fmt('rate', settings.rate)}`)
    if (chunks[0]) { setActiveReadId(chunks[0].id); setActiveWordIndex(0); setNowReading(`Reading 1 of ${chunks.length}: ${chunks[0].text.slice(0, 90)}${chunks[0].text.length > 90 ? '…' : ''}`) }
  }
  return <main className={`reader-screen ${fullscreen ? 'is-fullscreen' : ''}`} style={settingsStyle(settings)}>
    {!fullscreen ? <header className="reader-topbar glass"><div className="top-left"><button className="ghost-button" onClick={() => { stopVoice(); onBack() }}>← Library</button><div className="top-book-meta"><strong>{book.title}</strong><small>{chapter?.title} · {chapterIndex + 1} of {data.chapters.length}</small></div></div><div className="player-bar"><button className="icon-button" onClick={() => move(-1)}>←</button><button className="icon-button" onClick={speak}>{speaking ? '■' : '▶'}</button><button className="icon-button" onClick={() => move(1)}>→</button></div><div className="top-actions" /></header> : null}
    {!fullscreen ? <aside className="reader-sidebar left glass"><h2>Contents</h2><div className="toc-list">{data.toc.map((x, i) => <button key={i} className={i === chapterIndex ? 'active' : ''} onClick={() => setChapterIndex(x.chapterIndex)}>{x.label}</button>)}</div></aside> : null}
    <section className="reader-stage"><div className="book-page scroll" ref={pageRef}><div className="chapter-heading"><p>Chapter {chapterIndex + 1} of {data.chapters.length}</p><h1>{chapter?.title}</h1></div><article className="original-html" dangerouslySetInnerHTML={{ __html: chapter?.html || '' }} /><div className="scroll-chapter-controls">{chapterIndex > 0 ? <button onClick={() => move(-1)}>← Previous chapter</button> : <span />}{chapterIndex < data.chapters.length - 1 ? <button onClick={() => move(1)}>Next chapter →</button> : <span>End of book</span>}</div></div></section>
    {!fullscreen ? <ReaderTools settings={settings} updateSettings={updateSettings} voices={voices} refreshVoices={refreshVoices} speaking={speaking} paused={paused} speak={speak} pauseVoice={pauseVoice} resumeVoice={resumeVoice} stopVoice={stopVoice} status={status} nowReading={nowReading} toggleFullscreen={toggleFullscreen} /> : <div className="floating-controls"><button onClick={speak}>{speaking ? '■ Stop' : '▶ Read'}</button><button onClick={pauseVoice}>Pause</button><button onClick={resumeVoice}>Resume</button><button onClick={() => updateSettings({ tab:'follow' })}>Follow: {settings.paragraphFollow}+{settings.wordFollow}</button><button onClick={toggleFullscreen}>Exit full screen</button></div>}
  </main>
}
function App() {
  const [library, setLibrary] = React.useState(null)
  const [screen, setScreen] = React.useState('library')
  const [bookData, setBookData] = React.useState(null)
  const [selected, setSelected] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  React.useEffect(() => { window.readforge.getLibrary().then(setLibrary).catch(e => setError(String(e.message || e))) }, [])
  const saveLibrary = next => { setLibrary(next); window.readforge.saveLibrary(next) }
  const updateBook = (id, patch) => setLibrary(prev => { const next = { ...prev, books:(prev.books || []).map(b => b.id === id ? { ...b, ...patch } : b) }; window.readforge.saveLibrary(next); return next })
  const importBooks = async () => { try { const imported = await window.readforge.importBook(); if (!imported?.length) return; const next = await window.readforge.getLibrary(); saveLibrary(next); openBook(imported[0]) } catch(e) { setError(String(e.message || e)) } }
  const openBook = async book => { setError(''); setLoading(true); try { const raw = await window.readforge.readBook(book.id); const parsed = await parseEpub(bufferToArrayBuffer(raw)); setSelected(book); setBookData(parsed); updateBook(book.id, { title:parsed.title || book.title, author:parsed.author || book.author, coverDataUrl:parsed.coverDataUrl || book.coverDataUrl, metadataParsed:true, lastOpenedAt:new Date().toISOString() }); setScreen('reader') } catch(e) { setError(String(e.message || e)) } finally { setLoading(false) } }
  if (!library) return <div className="boot-screen"><div className="loading-orb" /><h1>ReadForge</h1><p>Loading library...</p></div>
  if (loading) return <div className="boot-screen"><div className="loading-orb" /><h1>Opening book...</h1><p>Rendering EPUB spine and images.</p></div>
  if (screen === 'reader' && selected && bookData) return <Reader book={selected} data={bookData} onBack={() => setScreen('library')} onProgress={updateBook} />
  return <>{error ? <div className="toast glass danger" onClick={() => setError('')}>{error}</div> : null}<Library library={library} onImport={importBooks} onOpen={openBook} /></>
}

createRoot(document.getElementById('root')).render(<App />)
