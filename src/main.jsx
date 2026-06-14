import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return <main style={{ padding: 32, fontFamily: 'Segoe UI, sans-serif' }}>
    <h1>ReadForge repair mode</h1>
    <p>The app source is being repaired. Please do not build this version.</p>
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
