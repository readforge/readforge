import React from 'react'
import { createRoot } from 'react-dom/client'
import JSZip from 'jszip'
import './styles.css'

const DEFAULT_SETTINGS = {
  theme: 'system', customBackground: '#f6efe1', customText: '#1f2328', fontFamily: 'Georgia',
  fontSize: 20, lineHeight: 1.75, letterSpacing: 0, paragraphSpacing: 1.1, margin: 44, textWidth: 820,
  textAlign: 'left', readingMode: 'scroll', paragraphsPerPage: 6, displayMode: 'clean', highlightStyle: 'wordGlow',
  voiceEngine: 'browser', voiceURI: '', voiceName: '', winrtVoiceId: '', winrtVoiceName: '', rate: 1, pitch: 1, volume: 1, sleepTimerMinutes: 0
}

const THEMES = {
  system: ['System Cozy', '#f4ecdc', '#252019', 'rgba(255,255,255,.72)', '#eadfcf', '#9b673d'],
  light: ['Modern Light', '#f7f8fb', '#1f242d', 'rgba(255,255,255,.82)', '#e6e9f1', '#5877e2'],
  library: ['Cozy Library', '#f4ead9', '#271c14', 'rgba(255,248,235,.82)', '#e6d3b8', '#956037'],
  dark: ['Soft Dark', '#12141b', '#eceff7', 'rgba(28,31,42,.80)', '#242838', '#8da2fb'],
  sepia: ['Sepia', '#ead9bc', '#2e2115', 'rgba(255,244,222,.74)', '#d8c29d', '#8a5d36'],
  midnight: ['Midnight Blue', '#081321', '#e5f0ff', 'rgba(14,31,54,.78)', '#142741', '#65a5ff'],
  forest: ['Forest', '#101b14', '#edf8ee', 'rgba(23,44,30,.78)', '#203b29', '#8bcf8b'],
  contrast: ['High Contrast', '#000', '#fff', '#111', '#2b2b2b', '#ffff00'],
  custom: ['Custom', '#f6efe1', '#1f2328', 'rgba(255,255,255,.75)', '#ded6c8', '#8b6f47']
}
const FONTS = ['Georgia','Cambria','Palatino Linotype','Segoe UI','Arial','Verdana','Tahoma','Times New Roman','Trebuchet MS','Calibri','Consolas','Courier New']

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }
function uid() { return `${Date.now()}_${Math.random().toString(16).slice(2)}` }
function local(el) { return (el?.localName || el?.tagName || '').split(':').pop().toLowerCase() }
function allByLocal(doc, name) { return [...doc.getElementsByTagName('*')].filter(el => local(el) === name.toLowerCase()) }
function textByLocal(doc, name) { return allByLocal(doc, name)[0]?.textContent?.trim() || '' }
function normalizeZipPath(p) {
  const parts = []
  String(p || '').replace(/\\/g, '/').split('/').forEach(part => { if (!part || part === '.') return; if (part === '..') parts.pop(); else parts.push(part) })
  return parts.join('/')
}
function joinZipPath(base, href) { return normalizeZipPath(base ? `${base}/${String(href || '').split('#')[0]}` : String(href || '').split('#')[0]) }
function zipFile(zip, p) { const n = normalizeZipPath(p); return zip.file(n) || zip.file(decodeURIComponent(n)) || zip.file(n.replace(/%20/g, ' ')) }
function bufferToArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input
  if (input?.buffer instanceof ArrayBuffer) return input.buffer.slice(input.byteOffset || 0, (input.byteOffset || 0) + (input.byteLength || input.length || 0))
  if (input?.type === 'Buffer' && Array.isArray(input.data)) return new Uint8Array(input.data).buffer
  if (Array.isArray(input)) return new Uint8Array(input).buffer
  throw new Error('Could not read the book data returned by Electron.')
}
function sanitize(doc) {
  doc.querySelectorAll('script,style,iframe,object,embed').forEach(el => el.remove())
  doc.querySelectorAll('*').forEach(el => [...el.attributes].forEach(a => { if (a.name.toLowerCase().startsWith('on')) el.removeAttribute(a.name) }))
}
function extractChapter(html, fallbackTitle) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  sanitize(doc)
  const body = doc.body || doc.documentElement
  const title = doc.querySelector('h1,h2,h3,title')?.textContent?.trim() || fallbackTitle || 'Chapter'
  const els = [...body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre')]
  const anchorIdsForElement = (el) => {
    const ids = new Set()
    let cur = el
    while (cur && cur !== body && cur.nodeType === 1) {
      if (cur.id) ids.add(cur.id)
      const name = cur.getAttribute?.('name')
      if (name) ids.add(name)
      cur.querySelectorAll?.('[id],a[name]').forEach(x => {
        if (x.id) ids.add(x.id)
        const n = x.getAttribute('name')
        if (n) ids.add(n)
      })
      cur = cur.parentElement
    }
    return [...ids]
  }
  let paragraphs = els.map((el, i) => ({ id: `${i}_${el.tagName.toLowerCase()}`, domId: el.id || el.getAttribute('name') || '', anchorIds: anchorIdsForElement(el), tag: el.tagName.toLowerCase(), text: (el.textContent || '').replace(/\s+/g, ' ').trim() })).filter(p => p.text)
  if (!paragraphs.length) paragraphs = (body.textContent || '').split(/\n{2,}/).map((x, i) => ({ id: `${i}_p`, domId: '', anchorIds: [], tag: 'p', text: x.replace(/\s+/g, ' ').trim() })).filter(p => p.text)
  return { title, html: body.innerHTML, paragraphs }
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
    if (id && href) manifest[id] = { id, href, fullPath: joinZipPath(base, href), mediaType: item.getAttribute('media-type') || '', properties: item.getAttribute('properties') || '' }
  })
  const spine = allByLocal(opf, 'itemref').map(el => el.getAttribute('idref')).filter(Boolean)
  let coverItem = null
  const coverMeta = allByLocal(opf, 'meta').find(m => m.getAttribute('name') === 'cover')?.getAttribute('content')
  if (coverMeta && manifest[coverMeta]) coverItem = manifest[coverMeta]
  if (!coverItem) coverItem = Object.values(manifest).find(x => x.properties.includes('cover-image'))
  if (!coverItem) coverItem = Object.values(manifest).find(x => x.mediaType.startsWith('image/') && /cover|front/i.test(`${x.id} ${x.href}`))
  let coverDataUrl = ''
  if (coverItem) { const f = zipFile(zip, coverItem.fullPath); if (f) coverDataUrl = `data:${coverItem.mediaType || 'image/jpeg'};base64,${await f.async('base64')}` }
  const chapters = []
  for (const id of spine) {
    const item = manifest[id]; if (!item) continue
    if (!/html|xhtml|xml/i.test(item.mediaType) && !/\.(xhtml|html|htm|xml)$/i.test(item.href)) continue
    const f = zipFile(zip, item.fullPath); if (!f) continue
    const fallback = item.href.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
    const ch = extractChapter(await f.async('text'), fallback)
    if (ch.paragraphs.length) chapters.push({ index: chapters.length, sourcePath: item.fullPath, href: item.href, ...ch })
  }
  let toc = []
  const nav = Object.values(manifest).find(x => x.properties.includes('nav'))
  if (nav) {
    const f = zipFile(zip, nav.fullPath)
    if (f) {
      const ndoc = new DOMParser().parseFromString(await f.async('text'), 'text/html')
      const navBase = nav.fullPath.split('/').slice(0, -1).join('/')
      const locateChapter = (href) => {
        const cleanHref = (href || '').split('#')[0]
        const fragment = decodeURIComponent((href || '').split('#')[1] || '')
        const full = cleanHref ? joinZipPath(navBase, href).split('#')[0] : nav.fullPath
        let ci = chapters.findIndex(ch => ch.sourcePath === full || decodeURIComponent(ch.sourcePath) === decodeURIComponent(full))
        if (ci < 0 && cleanHref) ci = chapters.findIndex(ch => ch.sourcePath.endsWith(cleanHref) || decodeURIComponent(ch.sourcePath).endsWith(decodeURIComponent(cleanHref)))
        if (ci < 0 && cleanHref) {
          const baseName = cleanHref.split('/').pop()
          ci = chapters.findIndex(ch => ch.sourcePath.split('/').pop() === baseName)
        }
        if (ci < 0) ci = 0
        let paragraphIndex = 0
        if (fragment && chapters[ci]) {
          const lower = fragment.toLowerCase()
          const found = chapters[ci].paragraphs.findIndex(p => (p.domId || '').toLowerCase() === lower || (p.anchorIds || []).some(id => String(id).toLowerCase() === lower))
          if (found >= 0) paragraphIndex = found
        }
        return { chapterIndex: ci, paragraphIndex }
      }
      toc = [...ndoc.querySelectorAll('nav a, a')].map(a => {
        const href = a.getAttribute('href') || ''
        const label = (a.textContent || '').replace(/\s+/g, ' ').trim()
        return { label, href, ...locateChapter(href) }
      }).filter(x => x.label)
    }
  }
  if (!toc.length) toc = chapters.map((ch, i) => ({ label: ch.title || `Chapter ${i + 1}`, href: ch.href, chapterIndex: i, paragraphIndex: 0 }))
  return { title, author, coverDataUrl, chapters, toc, wordCount: chapters.reduce((s, ch) => s + ch.paragraphs.reduce((a, p) => a + p.text.split(/\s+/).filter(Boolean).length, 0), 0) }
}
function tokens(text) { const out=[]; const re=/\S+\s*/g; let m; while((m=re.exec(text))) out.push({ text:m[0], start:m.index, end:m.index+m[0].length }); return out }
function progressPercent(data, chapterIndex, paragraphIndex) {
  const total = data.chapters.reduce((s, ch) => s + ch.paragraphs.length, 0)
  const done = data.chapters.slice(0, chapterIndex).reduce((s, ch) => s + ch.paragraphs.length, 0) + paragraphIndex
  return total ? Math.round(done / total * 100) : 0
}
function generatedCover(title, author) { const initials=(title||'RF').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); return <div className="generated-cover"><div className="cover-glow"/><div className="cover-initials">{initials}</div><div className="cover-title">{title||'Untitled'}</div>{author?<div className="cover-author">{author}</div>:null}</div> }
function SliderRow({label,value,min,max,step,onChange,suffix=''}) { return <label className="setting-row"><span>{label}</span><div className="setting-control"><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/><b>{value}{suffix}</b></div></label> }
function IconButton({children,onClick,title,active}) { return <button title={title} onClick={onClick} className={`icon-button ${active?'active':''}`}>{children}</button> }



function UpdateCenter({library,onSave,onClose}) {
  const prefs=library.preferences||{}
  const [version,setVersion]=React.useState('')
  const [provider,setProvider]=React.useState(prefs.updateProvider||'github')
  const [githubOwner,setGithubOwner]=React.useState(prefs.githubOwner||'readforge')
  const [githubRepo,setGithubRepo]=React.useState(prefs.githubRepo||'readforge')
  const [feedUrl,setFeedUrl]=React.useState(prefs.updateFeedUrl||'')
  const [releasePage,setReleasePage]=React.useState(prefs.releasePageUrl||'https://github.com/readforge/readforge/releases')
  const [message,setMessage]=React.useState('Use GitHub Releases for the easiest free update feed. Create a public repo, upload release assets, then ReadForge can check that repo for updates.')
  const [event,setEvent]=React.useState(null)
  React.useEffect(()=>{ window.readforge.getAppVersion?.().then(setVersion).catch(()=>setVersion('unknown')); const off=window.readforge.onUpdateEvent?.(payload=>{setEvent(payload); setMessage(payload?.message||'Update event received.')}); return()=>{ if(off) off() } },[])
  const calculatedReleasePage=`https://github.com/${githubOwner||'OWNER'}/${githubRepo||'REPO'}/releases`
  const calculatedFeedLabel=provider==='github'?`GitHub provider: ${githubOwner||'OWNER'}/${githubRepo||'REPO'}`:(feedUrl||'No generic URL set')
  const savePrefs=async()=>{
    const next={...library, preferences:{...(library.preferences||{}), updateProvider:provider, githubOwner:githubOwner.trim(), githubRepo:githubRepo.trim(), updateFeedUrl:feedUrl.trim(), releasePageUrl:(releasePage.trim()||calculatedReleasePage)}}
    await onSave(next)
    setMessage('Update settings saved.')
  }
  const check=async()=>{
    await savePrefs()
    setMessage('Checking for updates...')
    const result=await window.readforge.checkForUpdates({provider,owner:githubOwner.trim(),repo:githubRepo.trim(),feedUrl:feedUrl.trim()})
    setMessage(result?.message||'Update check requested.')
  }
  const download=async()=>{ const r=await window.readforge.downloadUpdate(); setMessage(r?.message||'Download requested.') }
  const install=async()=>{ const r=await window.readforge.installUpdate(); setMessage(r?.message||'Restarting to install...') }
  const openRelease=async()=>{ const url=(releasePage.trim()||calculatedReleasePage); await window.readforge.openExternal(url) }
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="update-center glass" onClick={e=>e.stopPropagation()}>
      <div className="update-head">
        <div><p className="eyebrow mini">ReadForge updates</p><h2>Update Center</h2><p>Current version: <b>{version||'loading...'}</b></p></div>
        <button className="ghost-button" onClick={onClose}>Close</button>
      </div>

      <div className="update-card">
        <h3>Recommended: GitHub Releases</h3>
        <p>Make a public GitHub repo named <b>{githubRepo}</b>, upload ReadForge release assets, then use these settings for one-click updates.</p>
        <label className="setting-row"><span>Update provider</span><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="github">GitHub Releases</option><option value="generic">Generic hosted folder</option></select></label>
        {provider==='github'?<>
          <label className="setting-row"><span>GitHub owner / username</span><input value={githubOwner} onChange={e=>{setGithubOwner(e.target.value); setReleasePage(`https://github.com/${e.target.value||'OWNER'}/${githubRepo||'REPO'}/releases`)}} placeholder="readforge"/></label>
          <label className="setting-row"><span>GitHub repo name</span><input value={githubRepo} onChange={e=>{setGithubRepo(e.target.value); setReleasePage(`https://github.com/${githubOwner||'OWNER'}/${e.target.value||'REPO'}/releases`)}} placeholder="readforge"/></label>
        </>:<>
          <label className="setting-row"><span>Generic update feed URL</span><input value={feedUrl} onChange={e=>setFeedUrl(e.target.value)} placeholder="https://your-site.com/readforge-updates/"/></label>
        </>}
        <label className="setting-row"><span>Release page URL</span><input value={releasePage} onChange={e=>setReleasePage(e.target.value)} placeholder={calculatedReleasePage}/></label>
        <p className="hint">Current target: {calculatedFeedLabel}</p>
        <div className="preset-actions">
          <button className="secondary-button" onClick={savePrefs}>Save update settings</button>
          <button className="ghost-button" onClick={openRelease}>Open release page</button>
        </div>
      </div>

      <div className="update-card">
        <h3>Check/install</h3>
        <div className="preset-actions">
          <button className="primary-button" onClick={check}>Check for updates</button>
          <button className="ghost-button" onClick={download}>Download update</button>
        </div>
        <button className="secondary-button full" onClick={install}>Restart and install downloaded update</button>
        <p className="hint">Auto-updates work in the built/installed app, not while running with npm run dev. The GitHub release must include the installer, blockmap, and latest.yml files generated by Electron Builder.</p>
      </div>

      <div className="update-status">
        <b>Status</b>
        <p>{message}</p>
        {event?.progress ? <div className="progress-line"><span style={{width:`${Math.round(event.progress.percent||0)}%`}}/></div> : null}
      </div>
    </section>
  </div>
}

function LibraryView({library,onImport,onOpen,onLibraryChange,onOpenUpdates}) {
  const [query,setQuery]=React.useState('')
  const view=library.preferences?.view||'grid', sort=library.preferences?.sort||'recent'
  const updatePrefs=patch=>onLibraryChange({...library, preferences:{...(library.preferences||{}), ...patch}})
  const books=React.useMemo(()=>{ const q=query.trim().toLowerCase(); return [...(library.books||[])].filter(b=>!q||`${b.title} ${b.author} ${b.fileName}`.toLowerCase().includes(q)).sort((a,b)=>{ if(sort==='title') return (a.title||'').localeCompare(b.title||''); if(sort==='author') return (a.author||'').localeCompare(b.author||''); if(sort==='imported') return String(b.importedAt||'').localeCompare(String(a.importedAt||'')); return String(b.lastOpenedAt||b.importedAt||'').localeCompare(String(a.lastOpenedAt||a.importedAt||'')) }) },[library.books,query,sort])
  return <main className="library-screen">
    <section className="hero-panel"><div><p className="eyebrow">ReadForge</p><h1>Your modern read-aloud library.</h1><p className="hero-copy">Import EPUBs, keep your place, customize the page, and listen with paragraph and word highlighting.</p></div><div className="hero-actions"><button className="primary-button big" onClick={onImport}>＋ Import books</button><button className="ghost-button big" onClick={onOpenUpdates}>Check updates</button></div></section>
    <section className="library-toolbar glass"><div className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, author, or file name..."/></div><select value={sort} onChange={e=>updatePrefs({sort:e.target.value})}><option value="recent">Recently opened</option><option value="title">Title</option><option value="author">Author</option><option value="imported">Recently imported</option></select><div className="segmented"><button className={view==='grid'?'selected':''} onClick={()=>updatePrefs({view:'grid'})}>Grid</button><button className={view==='list'?'selected':''} onClick={()=>updatePrefs({view:'list'})}>List</button></div></section>
    {!books.length ? <section className="empty-state glass"><div className="empty-icon">📚</div><h2>No books yet</h2><p>Import an EPUB to start building your ReadForge library.</p><button className="primary-button" onClick={onImport}>Import your first book</button></section> : <section className={view==='grid'?'book-grid':'book-list'}>{books.map(book=><button key={book.id} className={view==='grid'?'book-card glass':'book-row glass'} onClick={()=>onOpen(book)}><div className="book-cover-wrap">{book.coverDataUrl?<img src={book.coverDataUrl} className="book-cover" alt=""/>:generatedCover(book.title,book.author)}</div><div className="book-info"><h3>{book.title||'Untitled'}</h3><p>{book.author||'Unknown author'}</p><div className="progress-line"><span style={{width:`${book.progress?.percent||0}%`}}/></div><small>{book.progress?.percent||0}% read</small></div></button>)}</section>}
  </main>
}


function SettingsPresetPanel({settings,presets,onSave,onLoad,onDelete,onResetVisual,onResetAll,compact=false}) {
  const [selected,setSelected]=React.useState('')
  React.useEffect(()=>{
    if(!selected && presets?.length) setSelected(presets[0].id)
    if(selected && presets?.length && !presets.some(p=>p.id===selected)) setSelected(presets[0]?.id||'')
    if(selected && !presets?.length) setSelected('')
  },[presets,selected])
  const chosen=(presets||[]).find(p=>p.id===selected)
  return <section className={compact?'preset-panel compact':'preset-panel'}>
    <div className="preset-head"><div><h2>Settings presets</h2><p>Save this book's look and read-aloud settings, then load them later.</p></div></div>
    <button className="secondary-button full" onClick={onSave}>Save current settings as preset</button>
    <label className="setting-row"><span>Load saved preset</span><select value={selected} onChange={e=>setSelected(e.target.value)}>{(presets||[]).length?(presets||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>):<option value="">No saved presets yet</option>}</select></label>
    <div className="preset-actions">
      <button className="ghost-button" disabled={!chosen} onClick={()=>chosen&&onLoad(chosen)}>Load</button>
      <button className="ghost-button" disabled={!chosen} onClick={()=>chosen&&onDelete(chosen.id)}>Delete</button>
    </div>
    <div className="preset-actions">
      <button className="ghost-button" onClick={onResetVisual}>Reset layout defaults</button>
      <button className="ghost-button" onClick={onResetAll}>Reset all defaults</button>
    </div>
  </section>
}

function ReaderView({book,bookData,onBack,onUpdateBook}) {
  const initial=book.progress||{}
  const [chapterIndex,setChapterIndex]=React.useState(clamp(initial.chapterIndex||0,0,Math.max(bookData.chapters.length-1,0)))
  const [pageIndex,setPageIndex]=React.useState(initial.pageIndex||0)
  const [currentParagraph,setCurrentParagraph]=React.useState(initial.paragraphIndex||0)
  const [settings,setSettings]=React.useState({...DEFAULT_SETTINGS,...(book.settings||{})})
  const [voices,setVoices]=React.useState([]), [winrtVoices,setWinrtVoices]=React.useState([]), [activeParagraph,setActiveParagraph]=React.useState(null), [activeWord,setActiveWord]=React.useState(null)
  const [isReading,setIsReading]=React.useState(false), [isPaused,setIsPaused]=React.useState(false), [panel,setPanel]=React.useState('toc')
  const [fullscreen,setFullscreen]=React.useState(false), [controlsVisible,setControlsVisible]=React.useState(true), [status,setStatus]=React.useState(''), [fullSettingsOpen,setFullSettingsOpen]=React.useState(false)
  const refs=React.useRef({}), settingsRef=React.useRef(settings), tts=React.useRef({stopped:true,deadline:0}), hideTimer=React.useRef(null), nativeAudio=React.useRef(null), nativeWordTimer=React.useRef(null)
  const chapter=bookData.chapters[chapterIndex], paragraphs=chapter?.paragraphs||[], pageSize=clamp(settings.paragraphsPerPage||6,2,14)
  const chapterLabel=chapter?.title||`Chapter ${chapterIndex+1}`
  const totalPages=Math.max(1,Math.ceil(paragraphs.length/pageSize)), pageStart=settings.readingMode==='page'?clamp(pageIndex,0,totalPages-1)*pageSize:0
  const visible=settings.readingMode==='page'?paragraphs.slice(pageStart,pageStart+pageSize):paragraphs
  React.useEffect(()=>{settingsRef.current=settings},[settings])
  React.useEffect(()=>{ const load=()=>{ const list=window.speechSynthesis?.getVoices?.()||[]; setVoices(list); if(!settingsRef.current.voiceURI && list.length) setSettings(p=>({...p, voiceURI:(list.find(v=>v.default)||list[0]).voiceURI, voiceName:(list.find(v=>v.default)||list[0]).name}))}; load(); if('speechSynthesis' in window){window.speechSynthesis.onvoiceschanged=load; setTimeout(load,500); setTimeout(load,1600)} return()=>{ if('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged=null } },[])
  React.useEffect(()=>{ const loadNative=async()=>{ try{ const list=await window.readforge.listWindowsNaturalVoices(); setWinrtVoices(list||[]); if(!settingsRef.current.winrtVoiceId && list?.length){ const preferred=list.find(v=>/andrew/i.test(`${v.displayName} ${v.description}`))||list[0]; setSettings(p=>({...p, winrtVoiceId:preferred.id, winrtVoiceName:preferred.displayName||preferred.description||'Windows voice'})) } }catch(e){ console.warn('Could not load Windows Natural voices',e) } }; loadNative() },[])
  React.useEffect(()=>{ const f=()=>setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange',f); return()=>document.removeEventListener('fullscreenchange',f)},[])
  React.useEffect(()=>{ onUpdateBook(book.id,{ progress:{...(book.progress||{}), chapterIndex, paragraphIndex:currentParagraph, pageIndex, percent:progressPercent(bookData,chapterIndex,currentParagraph)}, settings, lastOpenedAt:new Date().toISOString(), updatedAt:new Date().toISOString() }) },[chapterIndex,currentParagraph,pageIndex,settings])
  const theme=React.useMemo(()=>{ const arr=THEMES[settings.theme]||THEMES.system; return {label:arr[0], bg:settings.theme==='custom'?settings.customBackground:arr[1], text:settings.theme==='custom'?settings.customText:arr[2], panel:arr[3], soft:arr[4], accent:arr[5]} },[settings])
  const vars={'--reader-bg':theme.bg,'--reader-text':theme.text,'--reader-panel':theme.panel,'--reader-soft':theme.soft,'--reader-accent':theme.accent,'--font-family':settings.fontFamily,'--font-size':`${settings.fontSize}px`,'--line-height':settings.lineHeight,'--letter-spacing':`${settings.letterSpacing}px`,'--paragraph-spacing':`${settings.paragraphSpacing}em`,'--reader-margin':`${settings.margin}px`,'--text-width':`${settings.textWidth}px`,'--text-align':settings.textAlign}
  const updateSettings=patch=>setSettings(p=>({...p,...patch}))
  const visualDefaultKeys=['theme','customBackground','customText','fontFamily','fontSize','lineHeight','letterSpacing','paragraphSpacing','margin','textWidth','textAlign','readingMode','paragraphsPerPage','displayMode','highlightStyle']
  const currentPresets=book.settingPresets||[]
  const saveSettingsPreset=()=>{
    const name=window.prompt('Name this settings preset:', `Settings ${currentPresets.length+1}`)
    if(!name) return
    const preset={id:uid(), name:name.trim()||`Settings ${currentPresets.length+1}`, settings:{...settings}, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()}
    onUpdateBook(book.id,{settingPresets:[...currentPresets,preset], updatedAt:new Date().toISOString()})
    setStatus(`Saved settings preset: ${preset.name}`)
  }
  const loadSettingsPreset=preset=>{
    if(!preset?.settings) return
    setSettings({...DEFAULT_SETTINGS,...preset.settings})
    setStatus(`Loaded settings preset: ${preset.name}`)
  }
  const deleteSettingsPreset=id=>{
    const preset=currentPresets.find(p=>p.id===id)
    if(!preset) return
    if(!window.confirm(`Delete settings preset "${preset.name}"?`)) return
    onUpdateBook(book.id,{settingPresets:currentPresets.filter(p=>p.id!==id), updatedAt:new Date().toISOString()})
    setStatus(`Deleted settings preset: ${preset.name}`)
  }
  const resetVisualDefaults=()=>{
    const patch={}
    visualDefaultKeys.forEach(k=>patch[k]=DEFAULT_SETTINGS[k])
    setSettings(p=>({...p,...patch}))
    setStatus('Reading layout reset to default.')
  }
  const resetAllDefaults=()=>{
    if(!window.confirm('Reset all reading settings for this book back to default?')) return
    setSettings({...DEFAULT_SETTINGS})
    setStatus('All settings reset to default.')
  }
  const stopReading=()=>{tts.current.stopped=true; window.speechSynthesis?.cancel?.(); if(nativeAudio.current){try{nativeAudio.current.pause(); nativeAudio.current.src=''}catch{} nativeAudio.current=null} if(nativeWordTimer.current){clearInterval(nativeWordTimer.current); nativeWordTimer.current=null} setIsReading(false); setIsPaused(false); setActiveWord(null)}
  const moveChapter=i=>{stopReading(); setChapterIndex(clamp(i,0,bookData.chapters.length-1)); setPageIndex(0); setCurrentParagraph(0); setActiveParagraph(null); setActiveWord(null)}
  const wordIndexFromChar=(text,char)=>{ const list=tokens(text); const i=list.findIndex(t=>char>=t.start&&char<t.end); return i<0?0:i }
  const speakParagraph=React.useCallback(async (idx)=>{ const s=settingsRef.current, para=bookData.chapters[chapterIndex]?.paragraphs?.[idx]; if(!para){setIsReading(false); return} if(tts.current.deadline && Date.now()>tts.current.deadline){stopReading(); setStatus('Sleep timer stopped reading.'); return}
    const pageForParagraph=Math.floor(idx/clamp(s.paragraphsPerPage||6,2,14))
    setIsReading(true); setIsPaused(false); setActiveParagraph(idx); setCurrentParagraph(idx); if(s.readingMode==='page') setPageIndex(pageForParagraph); setActiveWord(null); setTimeout(()=>refs.current[idx]?.scrollIntoView({block:'center',behavior:'smooth'}),60)
    if(s.voiceEngine==='windowsNatural'){
      try{
        if(nativeAudio.current){try{nativeAudio.current.pause(); nativeAudio.current.src=''}catch{}}
        if(nativeWordTimer.current){clearInterval(nativeWordTimer.current); nativeWordTimer.current=null}
        const result=await window.readforge.synthesizeWindowsNaturalSpeech({text:para.text,voiceId:s.winrtVoiceId,voiceName:s.winrtVoiceName,rate:s.rate,volume:s.volume})
        if(tts.current.stopped) return
        const audio=new Audio(`data:${result.mimeType||'audio/wav'};base64,${result.base64}`)
        audio.playbackRate=clamp(Number(s.rate||1),0.5,7)
        audio.volume=clamp(Number(s.volume||1),0,1)
        nativeAudio.current=audio
        const wordList=tokens(para.text)
        audio.onloadedmetadata=()=>{ nativeWordTimer.current=setInterval(()=>{ if(!nativeAudio.current||!isFinite(audio.duration)||audio.duration<=0) return; const i=Math.min(wordList.length-1,Math.max(0,Math.floor((audio.currentTime/audio.duration)*wordList.length))); setActiveWord(i) },90) }
        audio.onended=()=>{ if(nativeWordTimer.current){clearInterval(nativeWordTimer.current); nativeWordTimer.current=null} if(tts.current.stopped) return; const next=idx+1; if(next<bookData.chapters[chapterIndex].paragraphs.length) speakParagraph(next); else { setIsReading(false); setActiveParagraph(null); setActiveWord(null); setStatus(chapterIndex<bookData.chapters.length-1?'Reached the end of this chapter. Choose the next chapter to continue.':'Finished reading.') } }
        audio.onerror=()=>{ setStatus('Windows Natural voice playback failed. Try Refresh Windows voices or another voice.'); setIsReading(false) }
        await audio.play()
      }catch(e){ setStatus(`Windows Natural voice failed: ${e.message}`); setIsReading(false) }
      return
    }
    const u=new SpeechSynthesisUtterance(para.text); const voice=(window.speechSynthesis.getVoices()||[]).find(v=>v.voiceURI===s.voiceURI); if(voice) u.voice=voice; u.rate=clamp(Number(s.rate||1),0.5,7); u.pitch=clamp(Number(s.pitch||1),0,2); u.volume=clamp(Number(s.volume||1),0,1)
    u.onboundary=e=>{ if(typeof e.charIndex==='number') setActiveWord(wordIndexFromChar(para.text,e.charIndex)) }
    u.onerror=()=>{ if(!tts.current.stopped){setStatus('The selected voice failed. Try another voice or refresh voices.'); setIsReading(false)} }
    u.onend=()=>{ if(tts.current.stopped) return; const next=idx+1; if(next<bookData.chapters[chapterIndex].paragraphs.length) speakParagraph(next); else { setIsReading(false); setActiveParagraph(null); setActiveWord(null); setStatus(chapterIndex<bookData.chapters.length-1?'Reached the end of this chapter. Choose the next chapter to continue.':'Finished reading.') } }
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u)
  },[bookData,chapterIndex])
  const startReading=(from=currentParagraph)=>{ if(settingsRef.current.voiceEngine!=='windowsNatural'&&!('speechSynthesis' in window)){setStatus('Text-to-speech is not available on this system.'); return} tts.current.stopped=false; const min=Number(settings.sleepTimerMinutes||0); tts.current.deadline=min>0?Date.now()+min*60000:0; speakParagraph(clamp(from,0,paragraphs.length-1)) }
  const pauseResume=()=>{ if(!isReading) return; if(settingsRef.current.voiceEngine==='windowsNatural'&&nativeAudio.current){ if(nativeAudio.current.paused){nativeAudio.current.play(); setIsPaused(false)} else {nativeAudio.current.pause(); setIsPaused(true)} return } if(window.speechSynthesis.paused){window.speechSynthesis.resume(); setIsPaused(false)} else {window.speechSynthesis.pause(); setIsPaused(true)} }
  const skipParagraph=d=>{ const next=clamp((activeParagraph??currentParagraph)+d,0,paragraphs.length-1); setCurrentParagraph(next); setActiveParagraph(next); if(settings.readingMode==='page') setPageIndex(Math.floor(next/pageSize)); if(isReading){tts.current.stopped=false; speakParagraph(next)} }
  const addBookmark=()=>{ const name=window.prompt('Bookmark name:',`Chapter ${chapterIndex+1}, paragraph ${currentParagraph+1}`); if(!name) return; onUpdateBook(book.id,{bookmarks:[...(book.bookmarks||[]),{id:uid(),name,chapterIndex,paragraphIndex:currentParagraph,pageIndex,createdAt:new Date().toISOString(),snippet:paragraphs[currentParagraph]?.text?.slice(0,160)||''}]}) }
  const addHighlight=()=>{ const note=window.prompt('Optional note for this highlight:',''); onUpdateBook(book.id,{highlights:[...(book.highlights||[]),{id:uid(),chapterIndex,paragraphIndex:currentParagraph,note:note||'',createdAt:new Date().toISOString(),text:paragraphs[currentParagraph]?.text||''}]}) }
  const goTo=p=>{stopReading(); setChapterIndex(clamp(p.chapterIndex||0,0,bookData.chapters.length-1)); setCurrentParagraph(p.paragraphIndex||0); setPageIndex(p.pageIndex||Math.floor((p.paragraphIndex||0)/pageSize)); setTimeout(()=>refs.current[p.paragraphIndex||0]?.scrollIntoView({block:'center'}),120)}
  const refreshVoices=()=>{ const list=window.speechSynthesis?.getVoices?.()||[]; setVoices(list); setStatus(`Found ${list.length} browser voice(s).`) }
  const refreshWindowsNaturalVoices=async()=>{ try{ setStatus('Checking Windows Natural voices...'); const list=await window.readforge.listWindowsNaturalVoices(); setWinrtVoices(list||[]); if(list?.length&&!settings.winrtVoiceId){ const preferred=list.find(v=>/andrew/i.test(`${v.displayName} ${v.description}`))||list[0]; updateSettings({winrtVoiceId:preferred.id,winrtVoiceName:preferred.displayName||preferred.description||'Windows voice'}) } setStatus(`Found ${list?.length||0} Windows Natural voice(s).`) }catch(e){setStatus(`Could not load Windows Natural voices: ${e.message}`)} }
  const renderVoiceControls=()=> <><label className="setting-row"><span>Voice engine</span><select value={settings.voiceEngine||'browser'} onChange={e=>updateSettings({voiceEngine:e.target.value})}><option value="browser">Browser/Chromium voices</option><option value="windowsNatural">Windows Natural voices - Andrew HD</option></select></label>{settings.voiceEngine==='windowsNatural'?<><button className="ghost-button full" onClick={refreshWindowsNaturalVoices}>Refresh Windows Natural voices</button><label className="setting-row"><span>Windows voice</span><select value={settings.winrtVoiceId} onChange={e=>{const v=winrtVoices.find(x=>x.id===e.target.value); updateSettings({winrtVoiceId:e.target.value,winrtVoiceName:v?.displayName||v?.description||''})}}>{winrtVoices.length?winrtVoices.map(v=><option key={v.id} value={v.id}>{v.displayName||v.description} {v.language?`(${v.language})`:''}{/andrew/i.test(`${v.displayName} ${v.description}`)?' ★':''}</option>):<option value="">No Windows Natural voices found yet</option>}</select></label><p className="hint">For Microsoft Andrew Natural HD, install it in Windows Narrator, then choose the Windows Natural voice engine and click Refresh Windows Natural voices.</p></>:<><button className="ghost-button full" onClick={refreshVoices}>Refresh browser voices</button><label className="setting-row"><span>Voice</span><select value={settings.voiceURI} onChange={e=>{const v=voices.find(x=>x.voiceURI===e.target.value); updateSettings({voiceURI:e.target.value,voiceName:v?.name||''})}}>{voices.length?voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} {v.lang?`(${v.lang})`:''}{v.localService?' · local':''}</option>):<option value="">No voices found yet</option>}</select></label></>}</>
  const exportAudio=async()=>{ try{ setStatus('Exporting chapter audio...'); const r=await window.readforge.exportChapterAudio({title:`${book.title||'Book'} - ${chapter.title||'Chapter'}`,text:chapter.paragraphs.map(p=>p.text).join('\n\n'),voiceName:(settings.voiceEngine==='windowsNatural'?settings.winrtVoiceName:settings.voiceName),rate:settings.rate}); setStatus(r?.canceled?'Audio export canceled.':(r.truncated?`Exported WAV, but shortened because the chapter was long: ${r.filePath}`:`Exported WAV: ${r.filePath}`)) }catch(e){setStatus(`Audio export failed: ${e.message}`)} }
  const toggleFullscreen=async()=>{ if(!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen() }
  const onMouseMove=()=>{setControlsVisible(true); if(hideTimer.current) clearTimeout(hideTimer.current); if(fullscreen&&!fullSettingsOpen) hideTimer.current=setTimeout(()=>setControlsVisible(false),1800)}
  const highlightSet=React.useMemo(()=>new Set((book.highlights||[]).filter(h=>h.chapterIndex===chapterIndex).map(h=>h.paragraphIndex)),[book.highlights,chapterIndex])
  return <main className={`reader-screen ${fullscreen?'is-fullscreen':''}`} style={vars} onMouseMove={onMouseMove}>
    <header className={`reader-topbar glass ${fullscreen&&!controlsVisible&&!fullSettingsOpen?'hide-ui':''}`}><div className="top-left"><button className="ghost-button" onClick={()=>{stopReading();onBack()}}>← Library</button><div className="top-book-meta"><strong title={book.title}>{book.title}</strong><small title={`${chapterLabel} · ${book.progress?.percent||0}% read`}>{chapterLabel} · {book.progress?.percent||0}% read</small></div></div><div className="player-bar"><IconButton title="Previous paragraph" onClick={()=>skipParagraph(-1)}>⏮</IconButton><IconButton title="Read" active={isReading&&!isPaused} onClick={()=>isReading?pauseResume():startReading()}>▶</IconButton><IconButton title="Pause" active={isPaused} onClick={pauseResume}>⏸</IconButton><IconButton title="Stop" onClick={stopReading}>■</IconButton><IconButton title="Next paragraph" onClick={()=>skipParagraph(1)}>⏭</IconButton></div><div className="top-actions"><button className="ghost-button" onClick={addBookmark}>Bookmark</button><button className="ghost-button" onClick={addHighlight}>Highlight</button>{fullscreen?<button className="ghost-button" onClick={()=>{setFullSettingsOpen(true);setControlsVisible(true)}}>Settings</button>:null}<button className="ghost-button" onClick={toggleFullscreen}>{fullscreen?'Exit full screen':'Full screen'}</button></div></header>
    <aside className={`reader-sidebar left glass ${fullscreen?'hide-hard':''}`}><div className="panel-tabs"><button className={panel==='toc'?'active':''} onClick={()=>setPanel('toc')}>Contents</button><button className={panel==='marks'?'active':''} onClick={()=>setPanel('marks')}>Marks</button></div>{panel==='toc'?<div className="toc-list">{bookData.toc.map((x,i)=><button key={i} className={x.chapterIndex===chapterIndex?'active':''} onClick={()=>goTo({chapterIndex:x.chapterIndex||0,paragraphIndex:x.paragraphIndex||0,pageIndex:Math.floor((x.paragraphIndex||0)/pageSize)})}>{x.label}</button>)}</div>:<div className="marks-list"><h3>Bookmarks</h3>{(book.bookmarks||[]).length?book.bookmarks.map(b=><button key={b.id} onClick={()=>goTo(b)}><b>{b.name}</b><small>{b.snippet}</small></button>):<p>No bookmarks yet.</p>}<h3>Highlights & notes</h3>{(book.highlights||[]).length?book.highlights.map(h=><div key={h.id} className="note-card"><button onClick={()=>goTo(h)}><b>Chapter {h.chapterIndex+1}, paragraph {h.paragraphIndex+1}</b><small>{h.text?.slice(0,120)}</small>{h.note?<em>{h.note}</em>:null}</button><button className="tiny-danger" onClick={()=>onUpdateBook(book.id,{highlights:(book.highlights||[]).filter(x=>x.id!==h.id)})}>Remove</button></div>):<p>No highlights yet.</p>}</div>}</aside>
    <section className="reader-stage"><div className={`book-page ${settings.readingMode}`}><div className="chapter-heading"><p>Chapter {chapterIndex+1} of {bookData.chapters.length}</p><h1>{chapter?.title||`Chapter ${chapterIndex+1}`}</h1></div>{settings.displayMode==='original'?<article className="original-html" dangerouslySetInnerHTML={{__html:chapter?.html||''}}/>:<article className="clean-text">{visible.map((p,localIndex)=>{ const absolute=settings.readingMode==='page'?pageStart+localIndex:localIndex; const list=tokens(p.text); const isActive=activeParagraph===absolute; return <p key={absolute} ref={el=>{refs.current[absolute]=el}} className={[`text-block tag-${p.tag}`,isActive?`active-read ${settings.highlightStyle}`:'',currentParagraph===absolute?'current-position':'',highlightSet.has(absolute)?'saved-highlight':''].join(' ')} onClick={()=>{setCurrentParagraph(absolute); setActiveParagraph(absolute); if(settings.readingMode==='page') setPageIndex(Math.floor(absolute/pageSize))}}>{list.map((t,i)=><span key={i} className={isActive&&activeWord===i?'spoken-word':''}>{t.text}</span>)}</p>})}</article>}{settings.readingMode==='scroll'?<div className="scroll-chapter-controls">{chapterIndex>0?<button onClick={()=>moveChapter(chapterIndex-1)}>← Previous chapter</button>:<span/>}<span>{chapterIndex<bookData.chapters.length-1?'End of chapter':'End of book'}</span>{chapterIndex<bookData.chapters.length-1?<button onClick={()=>moveChapter(chapterIndex+1)}>Next chapter →</button>:<span/>}</div>:null}{settings.readingMode==='page'?<div className="page-controls"><button onClick={()=>{ if(pageIndex>0){setPageIndex(pageIndex-1);setCurrentParagraph((pageIndex-1)*pageSize)} else if(chapterIndex>0) moveChapter(chapterIndex-1)}}>← Previous page</button><span>Page {clamp(pageIndex+1,1,totalPages)} of {totalPages}</span><button onClick={()=>{ if(pageIndex<totalPages-1){setPageIndex(pageIndex+1);setCurrentParagraph((pageIndex+1)*pageSize)} else if(chapterIndex<bookData.chapters.length-1) moveChapter(chapterIndex+1)}}>Next page →</button></div>:null}</div></section>
    <aside className={`reader-sidebar right glass ${fullscreen?'hide-hard':''}`}><h2>Reading settings</h2><label className="setting-row"><span>Theme</span><select value={settings.theme} onChange={e=>updateSettings({theme:e.target.value})}>{Object.entries(THEMES).map(([k,v])=><option key={k} value={k}>{v[0]}</option>)}</select></label>{settings.theme==='custom'?<div className="two-col"><label>Background <input type="color" value={settings.customBackground} onChange={e=>updateSettings({customBackground:e.target.value})}/></label><label>Text <input type="color" value={settings.customText} onChange={e=>updateSettings({customText:e.target.value})}/></label></div>:null}<label className="setting-row"><span>Font</span><select value={settings.fontFamily} onChange={e=>updateSettings({fontFamily:e.target.value})}>{FONTS.map(f=><option key={f} value={f}>{f}</option>)}</select></label><div className="segmented wide"><button className={settings.readingMode==='scroll'?'selected':''} onClick={()=>updateSettings({readingMode:'scroll'})}>Scrolling</button><button className={settings.readingMode==='page'?'selected':''} onClick={()=>updateSettings({readingMode:'page'})}>Pages</button></div><div className="segmented wide"><button className={settings.displayMode==='clean'?'selected':''} onClick={()=>updateSettings({displayMode:'clean'})}>Clean</button><button className={settings.displayMode==='original'?'selected':''} onClick={()=>updateSettings({displayMode:'original'})}>Original</button></div><SliderRow label="Font size" value={settings.fontSize} min={12} max={42} step={1} suffix="px" onChange={v=>updateSettings({fontSize:v})}/><SliderRow label="Line height" value={settings.lineHeight} min={1.1} max={2.6} step={0.05} onChange={v=>updateSettings({lineHeight:v})}/><SliderRow label="Letter spacing" value={settings.letterSpacing} min={-1} max={5} step={0.1} suffix="px" onChange={v=>updateSettings({letterSpacing:v})}/><SliderRow label="Paragraph gap" value={settings.paragraphSpacing} min={0.4} max={3} step={0.1} suffix="em" onChange={v=>updateSettings({paragraphSpacing:v})}/><SliderRow label="Margins" value={settings.margin} min={12} max={110} step={2} suffix="px" onChange={v=>updateSettings({margin:v})}/><SliderRow label="Text width" value={settings.textWidth} min={520} max={1250} step={10} suffix="px" onChange={v=>updateSettings({textWidth:v})}/><SliderRow label="Paragraphs/page" value={settings.paragraphsPerPage} min={2} max={14} step={1} onChange={v=>updateSettings({paragraphsPerPage:v})}/><label className="setting-row"><span>Text align</span><select value={settings.textAlign} onChange={e=>updateSettings({textAlign:e.target.value})}><option value="left">Left</option><option value="justify">Justified</option><option value="center">Centered</option></select></label><SettingsPresetPanel settings={settings} presets={currentPresets} onSave={saveSettingsPreset} onLoad={loadSettingsPreset} onDelete={deleteSettingsPreset} onResetVisual={resetVisualDefaults} onResetAll={resetAllDefaults}/><h2>Read aloud</h2><SettingsPresetPanel compact settings={settings} presets={currentPresets} onSave={saveSettingsPreset} onLoad={loadSettingsPreset} onDelete={deleteSettingsPreset} onResetVisual={resetVisualDefaults} onResetAll={resetAllDefaults}/>{renderVoiceControls()}<SliderRow label="Speed" value={settings.rate} min={0.5} max={7} step={0.1} suffix="x" onChange={v=>updateSettings({rate:v})}/><SliderRow label="Pitch" value={settings.pitch} min={0} max={2} step={0.05} onChange={v=>updateSettings({pitch:v})}/><SliderRow label="Volume" value={settings.volume} min={0} max={1} step={0.05} onChange={v=>updateSettings({volume:v})}/><SliderRow label="Sleep timer" value={settings.sleepTimerMinutes} min={0} max={120} step={5} suffix="m" onChange={v=>updateSettings({sleepTimerMinutes:v})}/><label className="setting-row"><span>Highlight style</span><select value={settings.highlightStyle} onChange={e=>updateSettings({highlightStyle:e.target.value})}><option value="wordGlow">Word glow + paragraph underline</option><option value="paragraphWash">Whole paragraph wash</option><option value="spotlight">Spotlight</option><option value="underlineOnly">Underline only</option><option value="minimal">Minimal</option></select></label><button className="secondary-button full" onClick={exportAudio}>Export current chapter WAV</button><p className="hint">Live reading uses free Chromium/Windows voices. Exported WAV uses Windows desktop speech, so it may have fewer voices.</p></aside>
    <div className={`floating-controls glass ${fullscreen&&controlsVisible?'':'hide-ui'} ${fullscreen?'':'not-fullscreen'}`}><button onClick={()=>isReading?pauseResume():startReading()}>{isReading&&!isPaused?'Pause':'Read'}</button><button onClick={stopReading}>Stop</button><button onClick={()=>{setFullSettingsOpen(true);setControlsVisible(true)}}>Settings</button><button onClick={()=>setControlsVisible(false)}>Hide</button></div>{fullscreen&&fullSettingsOpen?<div className="fullscreen-settings-backdrop" onClick={()=>setFullSettingsOpen(false)}><section className="fullscreen-tts-panel glass" onClick={e=>e.stopPropagation()}><div className="fullscreen-panel-head"><div><p className="eyebrow mini">Read aloud</p><h2>Full-screen settings</h2></div><button className="ghost-button" onClick={()=>setFullSettingsOpen(false)}>Close</button></div>{renderVoiceControls()}<SliderRow label="Speed" value={settings.rate} min={0.5} max={7} step={0.1} suffix="x" onChange={v=>updateSettings({rate:v})}/><SliderRow label="Pitch" value={settings.pitch} min={0} max={2} step={0.05} onChange={v=>updateSettings({pitch:v})}/><SliderRow label="Volume" value={settings.volume} min={0} max={1} step={0.05} onChange={v=>updateSettings({volume:v})}/><SliderRow label="Sleep timer" value={settings.sleepTimerMinutes} min={0} max={120} step={5} suffix="m" onChange={v=>updateSettings({sleepTimerMinutes:v})}/><label className="setting-row"><span>Highlight style</span><select value={settings.highlightStyle} onChange={e=>updateSettings({highlightStyle:e.target.value})}><option value="wordGlow">Word glow + paragraph underline</option><option value="paragraphWash">Whole paragraph wash</option><option value="spotlight">Spotlight</option><option value="underlineOnly">Underline only</option><option value="minimal">Minimal</option></select></label><div className="fullscreen-player-row"><button className="primary-button" onClick={()=>isReading?pauseResume():startReading()}>{isReading&&!isPaused?'Pause':'Read aloud'}</button><button className="ghost-button" onClick={stopReading}>Stop</button></div><p className="hint">Changes save automatically for this book.</p></section></div>:null}{status?<div className="toast glass" onClick={()=>setStatus('')}>{status}</div>:null}
  </main>
}

function App() {
  const [library,setLibrary]=React.useState(null), [screen,setScreen]=React.useState('library'), [selectedId,setSelectedId]=React.useState(null), [bookData,setBookData]=React.useState(null), [loading,setLoading]=React.useState(false), [error,setError]=React.useState(''), [updatesOpen,setUpdatesOpen]=React.useState(false)
  const selectedBook=React.useMemo(()=>library?.books?.find(b=>b.id===selectedId)||null,[library,selectedId])
  React.useEffect(()=>{window.readforge.getLibrary().then(setLibrary)},[])
  const persist=async next=>{setLibrary(next); await window.readforge.saveLibrary(next)}
  const updateBook=React.useCallback((id,patch)=>{setLibrary(prev=>{ if(!prev) return prev; const next={...prev,books:prev.books.map(b=>b.id===id?{...b,...patch}:b)}; window.readforge.saveLibrary(next); return next })},[])
  const openBook=async book=>{ setError(''); setLoading(true); setSelectedId(book.id); try{ const raw=await window.readforge.readBook(book.id); const ab=bufferToArrayBuffer(raw); let parsed; if(book.extension==='epub') parsed=await parseEpub(ab); else { const text=new TextDecoder().decode(ab); const ps=text.split(/\n{2,}/).map((x,i)=>({id:`${i}_p`,tag:'p',text:x.replace(/\s+/g,' ').trim()})).filter(p=>p.text); parsed={title:book.title,author:book.author||'',coverDataUrl:book.coverDataUrl||'',chapters:[{index:0,title:book.title,html:'',paragraphs:ps}],toc:[{label:book.title,chapterIndex:0}],wordCount:ps.reduce((s,p)=>s+p.text.split(/\s+/).length,0)} } setBookData(parsed); const patch={title:parsed.title||book.title,author:parsed.author||book.author,coverDataUrl:parsed.coverDataUrl||book.coverDataUrl,metadataParsed:true,lastOpenedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}; updateBook(book.id,patch); setScreen('reader') }catch(e){setError(e.message||String(e)); setScreen('library')} finally{setLoading(false)} }
  const importBooks=async()=>{ setError(''); try{ const imported=await window.readforge.importBook(); if(!imported?.length) return; const next=await window.readforge.getLibrary(); await persist(next); await openBook(imported[0]) }catch(e){setError(e.message||String(e))} }
  if(!library) return <div className="boot-screen"><div className="loading-orb"/><h1>ReadForge</h1><p>Loading your library...</p></div>
  if(loading) return <div className="boot-screen"><div className="loading-orb"/><h1>Opening book...</h1><p>Extracting chapters, cover, and table of contents.</p></div>
  if(screen==='reader' && selectedBook && bookData) return <ReaderView book={selectedBook} bookData={bookData} onBack={()=>{window.speechSynthesis?.cancel?.(); setScreen('library'); setBookData(null)}} onUpdateBook={updateBook}/>
  return <>{<LibraryView library={library} onImport={importBooks} onOpen={openBook} onLibraryChange={persist} onOpenUpdates={()=>setUpdatesOpen(true)}/>} {updatesOpen?<UpdateCenter library={library} onSave={persist} onClose={()=>setUpdatesOpen(false)}/>:null} {error?<div className="toast glass danger" onClick={()=>setError('')}>{error}</div>:null}</>
}

createRoot(document.getElementById('root')).render(<App />)
