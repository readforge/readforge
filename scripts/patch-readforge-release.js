const fs = require('fs')
const path = require('path')
const indexPath = path.join(process.cwd(), 'index.html')
const overlayPath = path.join(process.cwd(), 'scripts', 'word-follow-overlay.js')
const version = process.env.RELEASE_VERSION || '1.7.21'
let index = fs.readFileSync(indexPath, 'utf8')
const overlay = fs.readFileSync(overlayPath, 'utf8')
const tag = `<script id="rf-word-follow-overlay">\n${overlay}\n</script>`
index = index.replace(/ReadForge v\d+\.\d+\.\d+/g, `ReadForge v${version}`)
index = index.replace(/<script id="rf-word-follow-overlay">[\s\S]*?<\/script>\s*/g, '')
index = index.replace('</body>', `${tag}\n</body>`)
fs.writeFileSync(indexPath, index, 'utf8')
console.log('Stable overlay release patch safe final.')
