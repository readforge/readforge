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
  const paragraphs = [...body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption')]
    .map((el, i) => ({ id:`${index}_${i}`, tag:local(el), text:(el.textContent || '').replace(/\s+/g, ' ').trim() }))
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
function Reader({ book, data, onBack, onProgress }) {
  const [chapterIndex, setChapterIndex] = React.useState(Math.max(0, Math.min(book.progress?.chapterIndex || 0, data.chapters.length - 1)))
  const [speaking, setSpeaking] = React.useState(false)
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
  return <main className="reader-screen" style={{ '--reader-bg':'#f4ead9', '--reader-text':'#271c14', '--reader-panel':'rgba(255,248,235,.9)', '--reader-soft':'#e6d3b8', '--reader-accent':'#956037', '--font-family':'Georgia', '--font-size':'20px', '--line-height':1.75, '--letter-spacing':'0px', '--paragraph-spacing':'1.1em', '--reader-margin':'44px', '--text-width':'860px', '--text-align':'left' }}>
    <header className="reader-topbar glass"><div className="top-left"><button className="ghost-button" onClick={() => { window.speechSynthesis?.cancel?.(); onBack() }}>← Library</button><div className="top-book-meta"><strong>{book.title}</strong><small>{chapter?.title} · {chapterIndex + 1} of {data.chapters.length}</small></div></div><div className="player-bar"><button className="icon-button" onClick={() => move(-1)}>←</button><button className="icon-button" onClick={speak}>{speaking ? '■' : '▶'}</button><button className="icon-button" onClick={() => move(1)}>→</button></div><div className="top-actions" /></header>
    <aside className="reader-sidebar left glass"><h2>Contents</h2><div className="toc-list">{data.toc.map((x, i) => <button key={i} className={i === chapterIndex ? 'active' : ''} onClick={() => setChapterIndex(x.chapterIndex)}>{x.label}</button>)}</div></aside>
    <section className="reader-stage"><div className="book-page scroll" ref={pageRef}><div className="chapter-heading"><p>Chapter {chapterIndex + 1} of {data.chapters.length}</p><h1>{chapter?.title}</h1></div><article className="original-html" dangerouslySetInnerHTML={{ __html: chapter?.html || '' }} /><div className="scroll-chapter-controls">{chapterIndex > 0 ? <button onClick={() => move(-1)}>← Previous chapter</button> : <span />}{chapterIndex < data.chapters.length - 1 ? <button onClick={() => move(1)}>Next chapter →</button> : <span>End of book</span>}</div></div></section>
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
