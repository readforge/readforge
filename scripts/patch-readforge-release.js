const fs = require('fs')
const path = require('path')

const root = process.cwd()
const mainPath = path.join(root, 'src', 'main.jsx')
const indexPath = path.join(root, 'index.html')
const version = process.env.RELEASE_VERSION || '1.7.18'

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8')
}

function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) {
    console.log(`Patch skipped: ${label}`)
    return content
  }
  console.log(`Patched: ${label}`)
  return content.replace(from, to)
}

function replaceRegex(content, regex, to, label) {
  if (!regex.test(content)) {
    console.log(`Patch skipped: ${label}`)
    return content
  }
  console.log(`Patched: ${label}`)
  return content.replace(regex, to)
}

let main = read(mainPath)
let index = read(indexPath)

// Version badge.
index = index.replace(/ReadForge v\d+\.\d+\.\d+/g, `ReadForge v${version}`)

// Make original rendering the default. This keeps images in the chapter where the EPUB placed them.
main = replaceOnce(
  main,
  "textAlign: 'left', readingMode: 'scroll', paragraphsPerPage: 6, displayMode: 'clean', highlightStyle: 'wordGlow',",
  "textAlign: 'left', readingMode: 'scroll', paragraphsPerPage: 6, displayMode: 'original', highlightStyle: 'wordGlow',",
  'default display mode original'
)

// Add asset helpers next to zipFile.
main = replaceOnce(
  main,
  "function zipFile(zip, p) { const n = normalizeZipPath(p); return zip.file(n) || zip.file(decodeURIComponent(n)) || zip.file(n.replace(/%20/g, ' ')) }",
  `function zipFile(zip, p) { const n = normalizeZipPath(p); return zip.file(n) || zip.file(decodeURIComponent(n)) || zip.file(n.replace(/%20/g, ' ')) }
function mimeFromPath(p) {
  const ext = String(p || '').split('?')[0].split('#')[0].split('.').pop().toLowerCase()
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif' })[ext] || 'application/octet-stream'
}
async function inlineEpubAssets(doc, zip, chapterPath) {
  const base = String(chapterPath || '').split('/').slice(0, -1).join('/')
  const resolveAsset = async raw => {
    const value = String(raw || '').trim()
    if (!value || /^(data:|https?:|blob:|mailto:|#)/i.test(value)) return value
    const clean = value.split('#')[0].split('?')[0]
    const file = zipFile(zip, joinZipPath(base, clean))
    if (!file) return value
    return 'data:' + mimeFromPath(clean) + ';base64,' + await file.async('base64')
  }

  for (const img of [...doc.querySelectorAll('img')]) {
    const next = await resolveAsset(img.getAttribute('src'))
    if (next) img.setAttribute('src', next)
  }
  for (const image of [...doc.querySelectorAll('image')]) {
    const raw = image.getAttribute('href') || image.getAttribute('xlink:href')
    const next = await resolveAsset(raw)
    if (next) {
      image.setAttribute('href', next)
      image.setAttribute('xlink:href', next)
    }
  }
  for (const source of [...doc.querySelectorAll('source')]) {
    const next = await resolveAsset(source.getAttribute('srcset') || source.getAttribute('src'))
    if (next) {
      if (source.hasAttribute('srcset')) source.setAttribute('srcset', next)
      else source.setAttribute('src', next)
    }
  }
}
function cleanChapterTitle(raw, fallback, bookTitle, index) {
  const clean = value => String(value || '').replace(/\\s+/g, ' ').trim()
  const key = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
  const rawClean = clean(raw)
  const fallbackClean = clean(fallback).replace(/[_-]+/g, ' ')
  const bookKey = key(bookTitle)
  const bad = value => {
    const k = key(value)
    return !k || k === bookKey || /^(titlepage|cover|copyright|contents|tableofcontents|frontmatter|nav|navigation)$/i.test(k) || (bookKey && k.includes(bookKey))
  }
  if (!bad(rawClean)) return rawClean
  if (!bad(fallbackClean)) return fallbackClean
  return 'Chapter ' + (index + 1)
}`,
  'asset and chapter helpers'
)

// Make extraction async so image assets can be inlined before the HTML is stored.
main = replaceOnce(main, 'function extractChapter(html, fallbackTitle) {', 'async function extractChapter(html, fallbackTitle, zip, chapterPath, bookTitle, chapterNumber) {', 'async extractChapter signature')
main = replaceOnce(main, "  sanitize(doc)\n  const body = doc.body || doc.documentElement", "  sanitize(doc)\n  if (zip) await inlineEpubAssets(doc, zip, chapterPath)\n  const body = doc.body || doc.documentElement", 'inline assets before body read')
main = replaceOnce(main, "  const title = doc.querySelector('h1,h2,h3,title')?.textContent?.trim() || fallbackTitle || 'Chapter'", "  const heading = doc.querySelector('h1,h2,h3,h4,h5,h6')?.textContent?.trim() || ''\n  const title = cleanChapterTitle(heading, fallbackTitle, bookTitle, chapterNumber || 0)", 'clean chapter title')
main = replaceOnce(main, "  const els = [...body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre')]", "  const els = [...body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figure,img')]")
main = replaceOnce(main, "    const ch = extractChapter(await f.async('text'), fallback)", "    const ch = await extractChapter(await f.async('text'), fallback, zip, item.fullPath, title, chapters.length)", 'await extractChapter')

// Clean nav labels that repeat the book title / volume title.
main = replaceOnce(
  main,
  "        const label = (a.textContent || '').replace(/\\s+/g, ' ').trim()\n        return { label, href, ...locateChapter(href) }",
  "        const location = locateChapter(href)\n        const rawLabel = (a.textContent || '').replace(/\\s+/g, ' ').trim()\n        const fallbackLabel = chapters[location.chapterIndex]?.title || `Chapter ${location.chapterIndex + 1}`\n        const label = cleanChapterTitle(rawLabel, fallbackLabel, title, location.chapterIndex)\n        return { label, href, ...location }",
  'clean toc labels'
)
main = replaceOnce(
  main,
  "  if (!toc.length) toc = chapters.map((ch, i) => ({ label: ch.title || `Chapter ${i + 1}`, href: ch.href, chapterIndex: i, paragraphIndex: 0 }))",
  "  if (!toc.length) toc = chapters.map((ch, i) => ({ label: cleanChapterTitle(ch.title, `Chapter ${i + 1}`, title, i), href: ch.href, chapterIndex: i, paragraphIndex: 0 }))",
  'clean fallback toc labels'
)

// Force existing books/settings away from broken Windows voice and toward original rendering.
main = replaceOnce(
  main,
  "const [settings,setSettings]=React.useState({...DEFAULT_SETTINGS,...(book.settings||{})})",
  "const [settings,setSettings]=React.useState({...DEFAULT_SETTINGS,...(book.settings||{}), displayMode: 'original', voiceEngine: 'browser'})",
  'force original rendering and browser voice'
)

// Ensure every chapter change scrolls to the top.
main = replaceOnce(
  main,
  "  React.useEffect(()=>{settingsRef.current=settings},[settings])",
  "  React.useEffect(()=>{settingsRef.current=settings},[settings])\n  React.useEffect(()=>{ setTimeout(()=>{ window.scrollTo(0,0); document.querySelector('.reader-stage')?.scrollTo({top:0,left:0}); document.querySelector('.book-page')?.scrollIntoView({block:'start'}); refs.current[0]?.scrollIntoView({block:'start'}); },60) },[chapterIndex])",
  'scroll top on chapter change'
)
main = replaceOnce(
  main,
  "const moveChapter=i=>{stopReading(); setChapterIndex(clamp(i,0,bookData.chapters.length-1)); setPageIndex(0); setCurrentParagraph(0); setActiveParagraph(null); setActiveWord(null)}",
  "const moveChapter=i=>{stopReading(); setChapterIndex(clamp(i,0,bookData.chapters.length-1)); setPageIndex(0); setCurrentParagraph(0); setActiveParagraph(null); setActiveWord(null); setTimeout(()=>{window.scrollTo(0,0); document.querySelector('.reader-stage')?.scrollTo({top:0,left:0,behavior:'smooth'}); document.querySelector('.book-page')?.scrollIntoView({block:'start',behavior:'smooth'}); refs.current[0]?.scrollIntoView({block:'start',behavior:'smooth'})},80)}",
  'moveChapter scroll top'
)
main = replaceOnce(
  main,
  "const goTo=p=>{stopReading(); setChapterIndex(clamp(p.chapterIndex||0,0,bookData.chapters.length-1)); setCurrentParagraph(p.paragraphIndex||0); setPageIndex(p.pageIndex||Math.floor((p.paragraphIndex||0)/pageSize)); setTimeout(()=>refs.current[p.paragraphIndex||0]?.scrollIntoView({block:'center'}),120)}",
  "const goTo=p=>{stopReading(); const para=p.paragraphIndex||0; setChapterIndex(clamp(p.chapterIndex||0,0,bookData.chapters.length-1)); setCurrentParagraph(para); setPageIndex(p.pageIndex||Math.floor(para/pageSize)); setTimeout(()=>{ if(para===0){ window.scrollTo(0,0); document.querySelector('.reader-stage')?.scrollTo({top:0,left:0}); document.querySelector('.book-page')?.scrollIntoView({block:'start'}); } else refs.current[para]?.scrollIntoView({block:'center'}); },120)}",
  'toc top behavior'
)

// Remove the broken Windows voice option from the real voice controls.
main = replaceOnce(
  main,
  '<option value="browser">Browser/Chromium voices</option><option value="windowsNatural">Windows Natural voices - Andrew HD</option>',
  '<option value="browser">Voice Styles</option>',
  'voice engine label'
)

write(mainPath, main)
write(indexPath, index)
console.log('ReadForge release patches applied.')
