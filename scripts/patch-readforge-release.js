const fs = require('fs')
const path = require('path')

const indexPath = path.join(process.cwd(), 'index.html')
const version = process.env.RELEASE_VERSION || '1.7.22'

let index = fs.readFileSync(indexPath, 'utf8')
index = index.replace(/ReadForge v\d+\.\d+\.\d+/g, `ReadForge v${version}`)

const tools = `
<script id="rf-reader-tools">
(function(){
try{
  const themes={library:['#f4ead9','#271c14','rgba(255,248,235,.92)','#956037'],light:['#f7f8fb','#1f242d','rgba(255,255,255,.92)','#5877e2'],dark:['#12141b','#eceff7','rgba(28,31,42,.92)','#8da2fb'],sepia:['#ead9bc','#2e2115','rgba(255,244,222,.92)','#8a5d36'],midnight:['#081321','#e5f0ff','rgba(14,31,54,.92)','#65a5ff'],forest:['#101b14','#edf8ee','rgba(23,44,30,.92)','#8bcf8b'],contrast:['#000','#fff','#111','#ff0']};
  const names={library:'Cozy Library',light:'Modern Light',dark:'Soft Dark',sepia:'Sepia',midnight:'Midnight Blue',forest:'Forest',contrast:'High Contrast'};
  const fonts=['Georgia','Cambria','Palatino Linotype','Segoe UI','Arial','Verdana','Tahoma','Times New Roman','Trebuchet MS','Calibri','Consolas','Courier New'];
  const def={theme:'library',font:'Georgia',size:20,line:1.75,gap:1.1,margin:44,width:860,align:'left',rate:1,pitch:1,vol:1,voice:''};
  let s=Object.assign(def,JSON.parse(localStorage.rfReaderTools||'{}')), speaking=false;
  const $=q=>document.querySelector(q), all=q=>Array.from(document.querySelectorAll(q));
  function save(){localStorage.rfReaderTools=JSON.stringify(s)}
  function apply(){let r=$('.reader-screen'); if(!r)return; let t=themes[s.theme]||themes.library; r.style.setProperty('--reader-bg',t[0]);r.style.setProperty('--reader-text',t[1]);r.style.setProperty('--reader-panel',t[2]);r.style.setProperty('--reader-accent',t[3]);r.style.setProperty('--font-family',s.font);r.style.setProperty('--font-size',s.size+'px');r.style.setProperty('--line-height',s.line);r.style.setProperty('--paragraph-spacing',s.gap+'em');r.style.setProperty('--reader-margin',s.margin+'px');r.style.setProperty('--text-width',s.width+'px');r.style.setProperty('--text-align',s.align)}
  function voices(){return speechSynthesis&&speechSynthesis.getVoices?speechSynthesis.getVoices():[]}
  function stop(){try{speechSynthesis.cancel()}catch(e){} speaking=false; let b=$('#rf-read'); if(b)b.textContent='▶ Read aloud'}
  function read(){if(speaking)return stop(); let text=($('.book-page')||document.body).innerText.replace(/\s+/g,' ').trim(); if(!text)return; let u=new SpeechSynthesisUtterance(text); let v=voices().find(x=>x.voiceURI===s.voice); if(v)u.voice=v; u.rate=Math.max(.5,Math.min(7,+s.rate||1)); u.pitch=Math.max(0,Math.min(2,+s.pitch||1)); u.volume=Math.max(0,Math.min(1,+s.vol||1)); u.onend=stop; speechSynthesis.cancel(); speechSynthesis.speak(u); speaking=true; $('#rf-read').textContent='■ Stop'}
  function panel(){ if($('#rf-tools'))return; document.body.insertAdjacentHTML('beforeend','<button id="rf-tools">⚙ Reader tools</button><div id="rf-panel"><b>Reader tools</b><button id="rf-close">×</button><label>Theme<select id="rf-theme"></select></label><label>Font<select id="rf-font"></select></label><label>Font size<input id="rf-size" type="range" min="12" max="42"></label><label>Line height<input id="rf-line" type="range" min="1.1" max="2.6" step=".05"></label><label>Paragraph gap<input id="rf-gap" type="range" min=".4" max="3" step=".1"></label><label>Margins<input id="rf-margin" type="range" min="12" max="110"></label><label>Text width<input id="rf-width" type="range" min="520" max="1250" step="10"></label><label>Align<select id="rf-align"><option>left</option><option>justify</option><option>center</option></select></label><hr><button id="rf-full">Full screen</button><button id="rf-voices">Refresh voices</button><label>Voice<select id="rf-voice"></select></label><label>Speed<input id="rf-rate" type="range" min=".5" max="7" step=".1"></label><label>Pitch<input id="rf-pitch" type="range" min="0" max="2" step=".1"></label><label>Volume<input id="rf-vol" type="range" min="0" max="1" step=".05"></label><button id="rf-read">▶ Read aloud</button></div>'); document.head.insertAdjacentHTML('beforeend','<style>#rf-tools{position:fixed;right:18px;bottom:18px;z-index:99998;border:0;border-radius:999px;padding:12px 16px;background:var(--reader-accent,#956037);color:#fff;font-weight:900}#rf-panel{display:none;position:fixed;right:18px;top:86px;bottom:18px;width:330px;overflow:auto;z-index:99999;padding:16px;border-radius:22px;background:var(--reader-panel,#fff8);color:var(--reader-text,#111);box-shadow:0 24px 70px #0008;border:1px solid #fff4}#rf-panel.open{display:block}#rf-panel label{display:grid;gap:5px;margin:10px 0;font-weight:800}#rf-panel input,#rf-panel select,#rf-panel button{width:100%;padding:9px;border-radius:12px;border:1px solid #7775;background:#0002;color:inherit}#rf-close{float:right;width:auto}.original-html img,.original-html svg{max-width:100%;height:auto;display:block;margin:1em auto}</style>'); Object.entries(names).forEach(([k,n])=>$('#rf-theme').insertAdjacentHTML('beforeend','<option value="'+k+'">'+n+'</option>')); fonts.forEach(f=>$('#rf-font').insertAdjacentHTML('beforeend','<option>'+f+'</option>')); bind(); fillVoices(); apply() }
  function bind(){let map={theme:'theme',font:'font',size:'size',line:'line',gap:'gap',margin:'margin',width:'width',align:'align',rate:'rate',pitch:'pitch',vol:'vol',voice:'voice'}; Object.keys(map).forEach(k=>{let e=$('#rf-'+k); if(!e)return; e.value=s[map[k]]; e.oninput=e.onchange=()=>{s[map[k]]=e.type==='range'?+e.value:e.value;save();apply()}}); $('#rf-tools').onclick=()=>$('#rf-panel').classList.add('open'); $('#rf-close').onclick=()=>$('#rf-panel').classList.remove('open'); $('#rf-full').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen(); $('#rf-read').onclick=read; $('#rf-voices').onclick=fillVoices }
  function fillVoices(){let e=$('#rf-voice'); if(!e)return; e.innerHTML=''; voices().forEach(v=>e.insertAdjacentHTML('beforeend','<option value="'+v.voiceURI+'">'+v.name+' '+(v.lang||'')+'</option>')); if(s.voice)e.value=s.voice}
  setInterval(()=>{ if($('.reader-screen')){panel();apply()} else {stop(); $('#rf-tools')?.remove(); $('#rf-panel')?.remove()} },700); if(speechSynthesis) speechSynthesis.onvoiceschanged=fillVoices;
}catch(e){console.error('ReadForge reader tools failed',e)}
})();
</script>`;
if (!index.includes('id="rf-reader-tools"')) index = index.replace('</body>', tools + '\n</body>')

fs.writeFileSync(indexPath, index, 'utf8')
console.log('Safe reader tools overlay applied. Reader source was not modified.')
