const fs = require('fs')
const path = require('path')

const indexPath = path.join(process.cwd(), 'index.html')
const version = process.env.RELEASE_VERSION || '1.7.21'

let index = fs.readFileSync(indexPath, 'utf8')
index = index.replace(/ReadForge v\d+\.\d+\.\d+/g, `ReadForge v${version}`)

fs.writeFileSync(indexPath, index, 'utf8')
console.log('Build patch applied: version badge only. Reader source is not changed during release build.')
