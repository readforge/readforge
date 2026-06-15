const fs = require('fs')
const path = require('path')

const indexPath = path.join(process.cwd(), 'index.html')
const mainPath = path.join(process.cwd(), 'src', 'main.jsx')
const version = process.env.RELEASE_VERSION || '1.7.21'

let index = fs.readFileSync(indexPath, 'utf8')
index = index.replace(/ReadForge v\d+\.\d+\.\d+/g, `ReadForge v${version}`)
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

console.log('Safe build patch complete: books open and word-follow text mutation is disabled.')
