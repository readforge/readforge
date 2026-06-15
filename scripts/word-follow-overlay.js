(function(){
  if (window.__RF_WORD_OVERLAY__) return;
  window.__RF_WORD_OVERLAY__ = true;
  const STYLE_ID = 'rf-word-overlay-style';
  const MARK_ID = 'rf-word-overlay-marker';
  const PANEL_ID = 'rf-word-overlay-controls';
  const storeKey = 'rfWordOverlaySettings';
  const defaults = { enabled:true, style:'pill' };
  let settings = Object.assign({}, defaults, JSON.parse(localStorage.getItem(storeKey) || '{}'));
  let chunks = [];
  let lastSig = '';
  function save(){ localStorage.setItem(storeKey, JSON.stringify(settings)); }
  function qsa(q){ return Array.from(document.querySelectorAll(q)); }
  function installStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `#${MARK_ID}{position:fixed;z-index:999999;pointer-events:none;border-radius:.35em;opacity:0;transition:left .08s linear,top .08s linear,width .08s linear,height .08s linear,opacity .08s linear,background .12s linear,box-shadow .12s linear,border-color .12s linear;box-sizing:border-box}#${MARK_ID}.show{opacity:1}#${PANEL_ID}{margin-top:10px;padding:10px;border-radius:14px;background:color-mix(in srgb,var(--reader-text),transparent 94%);display:grid;gap:8px;font-size:12px}#${PANEL_ID} label{display:grid;gap:5px;font-weight:700;opacity:.9}#${PANEL_ID} select{width:100%}`;
    document.head.appendChild(s);
  }
  function marker(){ installStyle(); let el = document.getElementById(MARK_ID); if (!el) { el = document.createElement('div'); el.id = MARK_ID; document.body.appendChild(el); } return el; }
  function hideMarker(){ const el = document.getElementById(MARK_ID); if (el) el.classList.remove('show'); }
  function textEls(){ return qsa('.book-page .original-html [data-rf-read-id]').filter(el => (el.innerText || '').trim().length > 0); }
  function buildChunks(){
    const els = textEls();
    const sig = els.map(el => el.getAttribute('data-rf-read-id') + ':' + (el.innerText || '').slice(0,20)).join('|');
    if (sig === lastSig && chunks.length) return chunks;
    lastSig = sig;
    let pos = 0;
    chunks = els.map((el, i) => { const text = (el.innerText || '').replace(/\s+/g, ' ').trim(); const start = pos; pos += text.length + 2; return { el, text, start, end:start + text.length, index:i }; }).filter(c => c.text);
    return chunks;
  }
  function wordAt(text, charIndex){
    const words = Array.from(String(text || '').matchAll(/\S+/g));
    if (!words.length) return 0;
    const hit = words.findIndex(m => charIndex >= m.index && charIndex <= m.index + m[0].length);
    return hit >= 0 ? hit : Math.max(0, words.findIndex(m => charIndex < m.index));
  }
  function findWordRange(el, index){
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode(node){ return node.nodeValue && /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
    let count = -1;
    let node;
    while ((node = walker.nextNode())) {
      const value = node.nodeValue || '';
      const re = /\S+/g;
      let m;
      while ((m = re.exec(value))) {
        count += 1;
        if (count === index) { const r = document.createRange(); r.setStart(node, m.index); r.setEnd(node, m.index + m[0].length); return r; }
      }
    }
    return null;
  }
  function styleMarker(el){
    const accent = getComputedStyle(document.body).getPropertyValue('--reader-accent') || '#956037';
    el.style.border = '0'; el.style.background = 'transparent'; el.style.boxShadow = 'none'; el.style.mixBlendMode = 'normal'; el.style.height = '';
    if (settings.style === 'underline') { el.style.height = '4px'; el.style.background = accent; el.style.borderRadius = '999px'; return 'underline'; }
    if (settings.style === 'outline') { el.style.border = `2px solid ${accent}`; }
    else if (settings.style === 'glow') { el.style.background = `color-mix(in srgb, ${accent}, transparent 68%)`; el.style.boxShadow = `0 0 18px ${accent}`; }
    else if (settings.style === 'invert') { el.style.background = 'var(--reader-text)'; el.style.mixBlendMode = 'difference'; }
    else if (settings.style === 'box') { el.style.background = `color-mix(in srgb, ${accent}, transparent 76%)`; el.style.boxShadow = `inset 0 0 0 2px ${accent}`; }
    else { el.style.background = accent; el.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${accent}, transparent 65%)`; }
    return 'box';
  }
  function moveMarkerTo(range){
    if (!settings.enabled || settings.style === 'off' || !range) { hideMarker(); return; }
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    const r = rects[0] || range.getBoundingClientRect();
    if (!r || !r.width || !r.height) { hideMarker(); return; }
    const el = marker();
    const mode = styleMarker(el);
    if (mode === 'underline') { el.style.left = `${r.left}px`; el.style.top = `${r.bottom + 1}px`; el.style.width = `${r.width}px`; }
    else { el.style.left = `${r.left - 2}px`; el.style.top = `${r.top - 1}px`; el.style.width = `${r.width + 4}px`; el.style.height = `${r.height + 2}px`; }
    el.classList.add('show');
  }
  function showForChar(charIndex){
    const list = buildChunks();
    const hit = list.find(c => charIndex >= c.start && charIndex <= c.end) || list[list.length - 1];
    if (!hit) return;
    const wordIndex = wordAt(hit.text, Math.max(0, charIndex - hit.start));
    moveMarkerTo(findWordRange(hit.el, wordIndex));
  }
  function injectControls(){
    const followPanel = Array.from(document.querySelectorAll('.reader-sidebar.right')).find(panel => panel.innerText && panel.innerText.includes('Follow-along'));
    if (!followPanel || document.getElementById(PANEL_ID)) return;
    const box = document.createElement('div');
    box.id = PANEL_ID;
    box.innerHTML = `<label>Spoken word overlay<select id="rf-word-style"><option value="off">Off</option><option value="pill">Solid pill</option><option value="glow">Glow</option><option value="underline">Underline</option><option value="outline">Outline</option><option value="invert">Invert</option><option value="box">Accent box</option></select></label>`;
    followPanel.appendChild(box);
    const select = box.querySelector('#rf-word-style');
    select.value = settings.style;
    select.onchange = () => { settings.style = select.value; settings.enabled = select.value !== 'off'; save(); if (!settings.enabled) hideMarker(); };
  }
  const ss = window.speechSynthesis;
  if (ss && ss.speak && !ss.__rfOverlayPatched) {
    ss.__rfOverlayPatched = true;
    const originalSpeak = ss.speak.bind(ss);
    const originalCancel = ss.cancel.bind(ss);
    ss.speak = function(utterance){
      buildChunks();
      const oldBoundary = utterance.onboundary;
      utterance.onboundary = function(e){ if (oldBoundary) oldBoundary.call(this, e); if (typeof e.charIndex === 'number') requestAnimationFrame(() => showForChar(e.charIndex)); };
      const oldEnd = utterance.onend;
      utterance.onend = function(e){ hideMarker(); if (oldEnd) oldEnd.call(this, e); };
      const oldError = utterance.onerror;
      utterance.onerror = function(e){ hideMarker(); if (oldError) oldError.call(this, e); };
      return originalSpeak(utterance);
    };
    ss.cancel = function(){ hideMarker(); return originalCancel(); };
  }
  setInterval(injectControls, 700);
})();
