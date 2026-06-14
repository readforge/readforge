const fs = require('fs')
const path = require('path')

const indexPath = path.join(process.cwd(), 'index.html')
const version = process.env.RELEASE_VERSION || '1.7.21'

let index = fs.readFileSync(indexPath, 'utf8')
index = index.replace(/ReadForge v\d+\.\d+\.\d+/g, `ReadForge v${version}`)

const noShakeStyle = `
<style id="rf-no-shake-follow">
  .spoken-word,
  .rf-word.spoken-word {
    display:inline !important;
    margin:0 !important;
    padding:0 !important;
    border:0 !important;
    outline:0 !important;
    line-height:inherit !important;
    font-size:inherit !important;
    font-weight:inherit !important;
    letter-spacing:inherit !important;
    vertical-align:baseline !important;
    box-decoration-break:clone;
    -webkit-box-decoration-break:clone;
    transition:background-color .12s linear,color .12s linear,box-shadow .12s linear,text-shadow .12s linear,text-decoration-color .12s linear !important;
  }
  .rf-word { display:inline !important; margin:0 !important; padding:0 !important; border:0 !important; outline:0 !important; line-height:inherit !important; vertical-align:baseline !important; }
  .active-read { transition:background-color .18s ease, box-shadow .18s ease, border-color .18s ease, text-decoration-color .18s ease !important; }
</style>`

index = index.replace(/<style id="rf-no-shake-follow">[\s\S]*?<\/style>\s*/g, '')
index = index.replace('</head>', `${noShakeStyle}\n</head>`)

fs.writeFileSync(indexPath, index, 'utf8')
console.log('Build patch applied: no-layout-shift follow highlight style injected.')
