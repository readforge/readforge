const fs = require('fs')
const path = require('path')

const indexPath = path.join(process.cwd(), 'index.html')
const mainPath = path.join(process.cwd(), 'src', 'main.jsx')
const overlayPath = path.join(process.cwd(), 'scripts', 'word-follow-overlay.js')
const version = process.env.RELEASE_VERSION || '1.7.21'

let index = fs.readFileSync(indexPath, 'utf8')
const overlay = fs.readFileSync(overlayPath, 'utf8')
const tag = `<script id="rf-word-follow-overlay">\n${overlay}\n</script>`

index = index.replace(/ReadForge v\d+\.\d+\.\d+/g, `ReadForge v${version}`)
index = index.replace(/<script id="rf-word-follow-overlay">[\s\S]*?<\/script>\s*/g, '')
index = index.replace('</body>', `${tag}\n</body>`)
fs.writeFileSync(indexPath, index, 'utf8')

if (fs.existsSync(mainPath)) {
  let main = fs.readFileSync(mainPath, 'utf8')
  main = main.replace("wordFollow:'pill'", "wordFollow:'off'")
  main = main.replace(/function decorateWord\(el, wordIndex, style\) \{[\s\S]*?\n\}\nfunction Slider/, "function decorateWord(el, wordIndex, style) { return }\nfunction Slider")
  main = main.replace("if (settings.wordFollow !== 'off') decorateWord(el, activeWordIndex, settings.wordFollow); ", "")
  main = main.replace("setActiveWordIndex(wordIndex); ", "")
  main = main.replace("setActiveWordIndex(0); ", "")
  fs.writeFileSync(mainPath, main, 'utf8')
}

console.log('Build patch complete: built-in word mutation disabled, overlay word highlight injected.')
