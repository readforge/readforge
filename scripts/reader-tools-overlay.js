(function(){
  try {
    const THEMES = {
      library:['Cozy Library','#f4ead9','#271c14','rgba(255,248,235,.94)','#956037'],
      light:['Modern Light','#f7f8fb','#1f242d','rgba(255,255,255,.94)','#5877e2'],
      dark:['Soft Dark','#12141b','#eceff7','rgba(28,31,42,.94)','#8da2fb'],
      sepia:['Sepia','#ead9bc','#2e2115','rgba(255,244,222,.94)','#8a5d36'],
      midnight:['Midnight Blue','#081321','#e5f0ff','rgba(14,31,54,.94)','#65a5ff'],
      forest:['Forest','#101b14','#edf8ee','rgba(23,44,30,.94)','#8bcf8b'],
      contrast:['High Contrast','#000','#fff','#111','#ff0']
    };
    const FONTS = ['Georgia','Cambria','Palatino Linotype','Segoe UI','Arial','Verdana','Tahoma','Times New Roman','Trebuchet MS','Calibri','Consolas','Courier New'];
    const DEFAULTS = { tab:'voice', theme:'library', font:'Georgia', size:20, line:1.75, gap:1.1, margin:44, width:860, align:'left', rate:1, pitch:1, vol:1, voice:'', follow:'paragraphWash', autoScroll:true };
    let settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('rfReaderTools') || '{}'));
    let speaking = false;
    let chunks = [];
    let activeIndex = -1;
    const $ = q => document.querySelector(q);
    const $$ = q => Array.from(document.querySelectorAll(q));
    const save = () => localStorage.setItem('rfReaderTools', JSON.stringify(settings));
    function theme(){ return THEMES[settings.theme] || THEMES.library; }
    function fmt(key, value) {
      if (key === 'rate') return Number(value).toFixed(1) + 'x';
      if (key === 'pitch') return Number(value).toFixed(1);
      if (key === 'vol') return Math.round(Number(value) * 100) + '%';
      if (key === 'line') return Number(value).toFixed(2);
      if (key === 'gap') return Number(value).toFixed(1) + 'em';
      if (key === 'size' || key === 'margin' || key === 'width') return value + 'px';
      return String(value);
    }
    function apply() {
      const r = $('.reader-screen');
      if (!r) return;
      const t = theme();
      r.style.setProperty('--reader-bg', t[1]);
      r.style.setProperty('--reader-text', t[2]);
      r.style.setProperty('--reader-panel', t[3]);
      r.style.setProperty('--reader-soft', t[3]);
      r.style.setProperty('--reader-accent', t[4]);
      r.style.setProperty('--font-family', settings.font);
      r.style.setProperty('--font-size', settings.size + 'px');
      r.style.setProperty('--line-height', settings.line);
      r.style.setProperty('--paragraph-spacing', settings.gap + 'em');
      r.style.setProperty('--reader-margin', settings.margin + 'px');
      r.style.setProperty('--text-width', settings.width + 'px');
      r.style.setProperty('--text-align', settings.align);
      r.classList.toggle('is-fullscreen', !!document.fullscreenElement);
    }
    function voiceList(){ return window.speechSynthesis?.getVoices?.() || []; }
    function readableElements() {
      return $$('.book-page .original-html h1,.book-page .original-html h2,.book-page .original-html h3,.book-page .original-html h4,.book-page .original-html h5,.book-page .original-html h6,.book-page .original-html p,.book-page .original-html li,.book-page .original-html blockquote,.book-page .original-html pre,.book-page .original-html figcaption')
        .filter(el => (el.innerText || '').replace(/\s+/g,' ').trim().length > 1);
    }
    function buildChunks() {
      clearActive();
      chunks = [];
      let pos = 0;
      readableElements().forEach((el, index) => {
        const text = (el.innerText || '').replace(/\s+/g,' ').trim();
        if (!text) return;
        chunks.push({ el, index, text, start:pos, end:pos + text.length });
        pos += text.length + 2;
      });
      return chunks;
    }
    function clearActive() {
      $$('.active-read,.rf-speaking-now').forEach(el => el.classList.remove('active-read','paragraphWash','underlineOnly','spotlight','minimal','rf-speaking-now'));
      activeIndex = -1;
      const out = $('#rf-now');
      if (out) out.textContent = 'Not reading';
    }
    function setActiveByChar(charIndex) {
      if (settings.follow === 'off') return;
      const hit = chunks.find(c => charIndex >= c.start && charIndex <= c.end) || chunks[chunks.length - 1];
      if (!hit || hit.index === activeIndex) return;
      clearActive();
      activeIndex = hit.index;
      hit.el.classList.add('active-read', settings.follow, 'rf-speaking-now');
      const out = $('#rf-now');
      if (out) out.textContent = `Reading ${hit.index + 1} of ${chunks.length}: ${hit.text.slice(0, 90)}${hit.text.length > 90 ? '…' : ''}`;
      if (settings.autoScroll) hit.el.scrollIntoView({ block:'center', behavior:'smooth' });
    }
    function stop() {
      try { window.speechSynthesis?.cancel?.(); } catch(e) {}
      speaking = false;
      const b = $('#rf-read');
      if (b) b.textContent = '▶ Read aloud';
      const status = $('#rf-status');
      if (status) status.textContent = 'Stopped';
    }
    function read() {
      if (speaking) return stop();
      buildChunks();
      const text = chunks.map(c => c.text).join('\n\n');
      if (!text) {
        const status = $('#rf-status');
        if (status) status.textContent = 'No readable text found in this section.';
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      const selected = voiceList().find(v => v.voiceURI === settings.voice);
      if (selected) u.voice = selected;
      u.rate = Math.max(.5, Math.min(7, Number(settings.rate) || 1));
      u.pitch = Math.max(0, Math.min(2, Number(settings.pitch) || 1));
      u.volume = Math.max(0, Math.min(1, Number(settings.vol) || 1));
      u.onboundary = e => { if (typeof e.charIndex === 'number') setActiveByChar(e.charIndex); };
      u.onend = stop;
      u.onerror = () => { const status = $('#rf-status'); if (status) status.textContent = 'Voice failed. Try another voice.'; stop(); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      speaking = true;
      const b = $('#rf-read');
      if (b) b.textContent = '■ Stop';
      const status = $('#rf-status');
      if (status) status.textContent = `Reading at ${fmt('rate', settings.rate)}`;
      setActiveByChar(0);
    }
    function range(id, label, min, max, step, key) {
      return `<label class="rf-row"><span>${label}<b id="rfv-${id}">${fmt(key, settings[key])}</b></span><input id="rf-${id}" data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></label>`;
    }
    function select(id, label, key, options) {
      return `<label class="rf-row"><span>${label}</span><select id="rf-${id}" data-key="${key}">${options}</select></label>`;
    }
    function renderPanel() {
      const themeOptions = Object.entries(THEMES).map(([k,v]) => `<option value="${k}">${v[0]}</option>`).join('');
      const fontOptions = FONTS.map(f => `<option value="${f}">${f}</option>`).join('');
      const voiceOptions = voiceList().map(v => `<option value="${v.voiceURI}">${v.name} ${v.lang ? '(' + v.lang + ')' : ''}</option>`).join('') || '<option value="">No voices found</option>';
      const followOptions = '<option value="off">Off</option><option value="paragraphWash">Highlight paragraph</option><option value="underlineOnly">Underline spoken section</option><option value="spotlight">Spotlight focus</option><option value="minimal">Left edge marker</option>';
      const body = settings.tab === 'appearance'
        ? `${select('theme','Theme','theme',themeOptions)}${select('font','Font','font',fontOptions)}${range('size','Font size',12,42,1,'size')}${range('line','Line height',1.1,2.6,.05,'line')}${range('gap','Paragraph gap',.4,3,.1,'gap')}${range('margin','Margins',12,110,2,'margin')}${range('width','Text width',520,1250,10,'width')}${select('align','Text alignment','align','<option value="left">Left</option><option value="justify">Justify</option><option value="center">Center</option>')}`
        : settings.tab === 'focus'
          ? `${select('follow','Follow-along style','follow',followOptions)}<label class="rf-check"><input id="rf-autoScroll" type="checkbox" ${settings.autoScroll ? 'checked' : ''}> Auto-scroll to spoken text</label><button id="rf-full" class="rf-primary">⛶ Full screen</button><div class="rf-now" id="rf-now">Not reading</div>`
          : `<button id="rf-read" class="rf-primary">${speaking ? '■ Stop' : '▶ Read aloud'}</button><button id="rf-voices" class="rf-secondary">Refresh voices</button>${select('voice','Voice','voice',voiceOptions)}${range('rate','Speed',.5,7,.1,'rate')}${range('pitch','Pitch',0,2,.1,'pitch')}${range('vol','Volume',0,1,.05,'vol')}<div id="rf-status" class="rf-status">Speed is ${fmt('rate', settings.rate)}</div>`;
      $('#rf-dock').innerHTML = `<div class="rf-head"><div><b>Reader tools</b><small>Built into the right side</small></div></div><div class="rf-tabs"><button data-tab="appearance">Appearance</button><button data-tab="voice">Voice</button><button data-tab="focus">Follow</button></div><div class="rf-body">${body}</div>`;
      bindPanel();
    }
    function bindPanel() {
      $$('#rf-dock [data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === settings.tab);
        btn.onclick = () => { settings.tab = btn.dataset.tab; save(); renderPanel(); };
      });
      $$('#rf-dock [data-key]').forEach(el => {
        el.value = settings[el.dataset.key];
        el.oninput = el.onchange = () => {
          settings[el.dataset.key] = el.type === 'range' ? Number(el.value) : el.value;
          save(); apply();
          const out = $('#rfv-' + el.id.replace('rf-',''));
          if (out) out.textContent = fmt(el.dataset.key, settings[el.dataset.key]);
          if (el.dataset.key === 'rate') { const st = $('#rf-status'); if (st) st.textContent = `Speed is ${fmt('rate', settings.rate)}`; }
          if (el.dataset.key === 'follow') clearActive();
        };
      });
      const auto = $('#rf-autoScroll');
      if (auto) auto.onchange = () => { settings.autoScroll = auto.checked; save(); };
      const full = $('#rf-full');
      if (full) full.onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      const readBtn = $('#rf-read');
      if (readBtn) readBtn.onclick = read;
      const refresh = $('#rf-voices');
      if (refresh) refresh.onclick = () => { renderPanel(); const st = $('#rf-status'); if (st) st.textContent = `Found ${voiceList().length} voices. Speed is ${fmt('rate', settings.rate)}`; };
    }
    function installDock() {
      if (!$('.reader-screen')) return removeDock();
      if (!$('#rf-dock')) {
        document.body.insertAdjacentHTML('beforeend', '<aside id="rf-dock"></aside>');
        document.head.insertAdjacentHTML('beforeend', `<style id="rf-dock-style">
          #rf-dock{position:fixed;top:94px;right:14px;bottom:14px;width:350px;z-index:29;overflow:auto;border-radius:26px;padding:16px;color:var(--reader-text);background:var(--reader-panel);border:1px solid color-mix(in srgb,var(--reader-text),transparent 85%);box-shadow:0 24px 70px rgba(0,0,0,.25);backdrop-filter:blur(22px)}
          .rf-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.rf-head b{font-size:18px}.rf-head small{display:block;opacity:.65;margin-top:3px}.rf-tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:5px;border-radius:17px;background:color-mix(in srgb,var(--reader-text),transparent 92%);margin-bottom:14px}.rf-tabs button{border:0;border-radius:12px;padding:10px;color:var(--reader-text);background:transparent;font-weight:800}.rf-tabs button.active{background:color-mix(in srgb,var(--reader-accent),transparent 78%)}
          .rf-body{display:grid;gap:10px}.rf-row{display:grid;gap:8px;padding:10px;border-radius:16px;background:color-mix(in srgb,var(--reader-text),transparent 94%)}.rf-row span{display:flex;justify-content:space-between;gap:8px;font-weight:800;font-size:13px;opacity:.82}.rf-row b{font-size:12px;opacity:.75}.rf-row input,.rf-row select,#rf-dock button{width:100%;border:1px solid color-mix(in srgb,var(--reader-text),transparent 82%);border-radius:12px;padding:9px 10px;color:var(--reader-text);background:color-mix(in srgb,var(--reader-bg),white 8%)}.rf-check{display:flex;gap:10px;align-items:center;padding:11px;border-radius:16px;background:color-mix(in srgb,var(--reader-text),transparent 94%);font-weight:800}.rf-check input{width:auto}
          .rf-primary{background:var(--reader-accent)!important;color:white!important;font-weight:900}.rf-secondary{font-weight:850}.rf-status,.rf-now{padding:12px;border-radius:16px;background:color-mix(in srgb,var(--reader-text),transparent 94%);font-size:13px;line-height:1.35}.rf-speaking-now{transition:background .15s,box-shadow .15s,outline .15s}
        </style>`);
      }
      renderPanel();
      apply();
    }
    function removeDock() {
      stop();
      $('#rf-dock')?.remove();
      $('#rf-dock-style')?.remove();
    }
    setInterval(installDock, 700);
    window.speechSynthesis?.addEventListener?.('voiceschanged', () => { if ($('#rf-dock')) renderPanel(); });
    document.addEventListener('fullscreenchange', apply);
  } catch (e) {
    console.error('ReadForge reader tools failed', e);
  }
})();
