const fs = require('fs')
const path = require('path')

const indexPath = path.join(process.cwd(), 'index.html')
const mainPath = path.join(process.cwd(), 'src', 'main.jsx')
const version = process.env.RELEASE_VERSION || '1.7.21'

let index = fs.readFileSync(indexPath, 'utf8')
let main = fs.readFileSync(mainPath, 'utf8')

index = index.replace(/ReadForge v\d+\.\d+\.\d+/g, `ReadForge v${version}`)

function replaceChecked(source, find, replacement, label) {
  if (!source.includes(find)) throw new Error(`Could not apply smooth follow patch: ${label}`)
  return source.replace(find, replacement)
}

main = replaceChecked(main,
`function restoreWordMarks() {
  document.querySelectorAll('[data-rf-wordized="true"]').forEach(el => {
    if (el.dataset.rfOriginalHtml != null) el.innerHTML = el.dataset.rfOriginalHtml
    delete el.dataset.rfOriginalHtml
    delete el.dataset.rfWordized
  })
}`,
`function restoreWordMarks(root) {
  const nodes = root ? [root] : Array.from(document.querySelectorAll('[data-rf-wordized="true"]'))
  nodes.forEach(el => {
    if (el?.dataset?.rfOriginalHtml != null) el.innerHTML = el.dataset.rfOriginalHtml
    if (el?.dataset) { delete el.dataset.rfOriginalHtml; delete el.dataset.rfWordized }
  })
}`,
'restoreWordMarks optional root')

main = replaceChecked(main,
`function decorateWord(el, wordIndex, style) {
  if (!el || style === 'off') return
  restoreWordMarks()
  const text = el.innerText || ''
  const parts = text.match(/\\S+|\\s+/g) || []
  let count = -1
  el.dataset.rfOriginalHtml = el.innerHTML
  el.dataset.rfWordized = 'true'
  el.innerHTML = parts.map(part => {
    if (/\\S/.test(part)) {
      count += 1
      if (count === wordIndex) return \`<span class="spoken-word" style="\${wordStyle(style)}">\${escapeHtml(part)}</span>\`
    }
    return escapeHtml(part)
  }).join('')
}`,
`function decorateWord(el, wordIndex, style) {
  if (!el) return
  if (!el.dataset.rfWordized) {
    const text = el.innerText || ''
    const parts = text.match(/\\S+|\\s+/g) || []
    let count = -1
    el.dataset.rfOriginalHtml = el.innerHTML
    el.dataset.rfWordized = 'true'
    el.innerHTML = parts.map(part => {
      if (/\\S/.test(part)) {
        count += 1
        return '<span data-rf-word="' + count + '" class="rf-word">' + escapeHtml(part) + '</span>'
      }
      return escapeHtml(part)
    }).join('')
  }
  el.querySelectorAll('.spoken-word').forEach(node => { node.classList.remove('spoken-word'); node.removeAttribute('style') })
  if (style === 'off') return
  const word = el.querySelector('[data-rf-word="' + Math.max(0, wordIndex) + '"]')
  if (word) {
    word.classList.add('spoken-word')
    word.setAttribute('style', wordStyle(style) + ';transition:background .16s ease,color .16s ease,box-shadow .16s ease,outline .16s ease,text-decoration-color .16s ease')
  }
}`,
'stable word decoration')

main = replaceChecked(main,
`  const pageRef = React.useRef(null)
  const chapter = data.chapters[chapterIndex] || data.chapters[0]`,
`  const pageRef = React.useRef(null)
  const activeParaRef = React.useRef('')
  const chapter = data.chapters[chapterIndex] || data.chapters[0]`,
'active paragraph ref')

main = replaceChecked(main,
`  React.useEffect(() => { restoreWordMarks(); document.querySelectorAll('.active-read').forEach(el => el.classList.remove('active-read','paragraphWash','underlineOnly','spotlight','minimal')); if (!activeReadId) return; const el = document.querySelector(\`[data-rf-read-id="\${activeReadId}"]\`); if (!el) return; if (settings.paragraphFollow !== 'off') el.classList.add('active-read', settings.paragraphFollow); if (settings.wordFollow !== 'off') decorateWord(el, activeWordIndex, settings.wordFollow); if (settings.autoScroll) el.scrollIntoView({ block:'center', behavior:'smooth' }) }, [activeReadId, activeWordIndex, settings.paragraphFollow, settings.wordFollow, settings.autoScroll])`,
`  React.useEffect(() => {
    const el = activeReadId ? document.querySelector('[data-rf-read-id="' + activeReadId + '"]') : null
    document.querySelectorAll('.active-read').forEach(node => {
      if (node !== el) { node.classList.remove('active-read','paragraphWash','underlineOnly','spotlight','minimal'); restoreWordMarks(node) }
    })
    if (!el) { activeParaRef.current = ''; return }
    if (settings.paragraphFollow !== 'off') {
      if (!el.classList.contains('active-read') || activeParaRef.current !== activeReadId) {
        el.classList.add('active-read', settings.paragraphFollow)
      }
      ;['paragraphWash','underlineOnly','spotlight','minimal'].forEach(cls => { if (cls !== settings.paragraphFollow) el.classList.remove(cls) })
    } else {
      el.classList.remove('active-read','paragraphWash','underlineOnly','spotlight','minimal')
    }
    decorateWord(el, activeWordIndex, settings.wordFollow)
    if (settings.autoScroll && activeParaRef.current !== activeReadId) el.scrollIntoView({ block:'center', behavior:'smooth' })
    activeParaRef.current = activeReadId
  }, [activeReadId, activeWordIndex, settings.paragraphFollow, settings.wordFollow, settings.autoScroll])`,
'smooth follow effect')

fs.writeFileSync(indexPath, index, 'utf8')
fs.writeFileSync(mainPath, main, 'utf8')
console.log('Build patch applied: smooth voice follow without paragraph flicker.')
