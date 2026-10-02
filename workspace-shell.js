/* One design workspace for every step after site selection: workflow bar on top, the drawing or model in the centre,
   the current mode's controls at the side, and the next action at the bottom. Steps change the editing mode, not the page. */
(function(root){'use strict';
// Corridor editing by hand is a mode of Plan setup, reached from its Manual adjustments; it is not a numbered step.
const STEPS=[['capacity','1','Massing'],['massing','2','Plan setup'],['units','3','Units'],['egress','4','Review'],['presentation','5','Presentation']];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let on=true,view='plan',el=null,hosted=null,lastViews=[],pair=null,lastStep=null;
function ensure(){if(el)return el;el=document.createElement('div');el.className='ws';el.hidden=true;
 el.innerHTML=`<header class="ws-top"><div class="ws-site"><button class="ws-back" data-ws="site" title="Choose another site" aria-label="Back to site">← Site</button><span class="ws-addr"></span></div><nav class="ws-steps" aria-label="Design workflow"></nav><div class="ws-views" role="tablist" aria-label="View"></div><button class="ws-help" type="button" title="Help and glossary (?)" onclick="window.HELP&&window.HELP.open()">Help</button><button class="ws-sheet" data-ws="sheet" title="Leave the workspace for the sheet view (F)">Sheet view</button></header>
 <aside class="ws-side" aria-label="Mode controls"><div class="ws-figs"></div><div class="ws-mode"></div><details class="ws-more"><summary>More settings</summary><div class="ws-more-slot"></div></details></aside>
 <footer class="ws-bottom"><div class="ws-status" aria-live="polite"></div><div class="ws-secondary"></div><div class="ws-primary"></div></footer>`;
 document.body.appendChild(el);
 el.addEventListener('click',e=>{const b=e.target.closest('[data-ws]');if(!b)return;const a=b.dataset.ws;if(a==='site')root.APP.showTab('site');else if(a==='sheet')set(false);else if(a.startsWith('step:'))root.APP.showTab(a.slice(5));else if(a.startsWith('view:')){view=a.slice(5);root.dispatchEvent(new CustomEvent('ws-view',{detail:view}));apply();}});
 return el;}
// Move a settings panel (with its live bindings) into "More settings"; return it home when the workspace closes or the host changes.
function host(node){if(hosted&&hosted.node===node)return;unhost();if(!node)return;hosted={node,parent:node.parentNode,next:node.nextSibling};el.querySelector('.ws-more-slot').appendChild(node);}
function unhost(){if(!hosted)return;const {node,parent,next}=hosted;hosted=null;if(parent)parent.insertBefore(node,next&&next.parentNode===parent?next:null);}
// 'split' puts the step's pair of views side by side; narrow screens fall back to the first of the pair.
function apply(){const two=view==='split'&&pair?pair.map(id=>lastViews.find(x=>x.id===id)).filter(Boolean):[],split=two.length===2&&root.innerWidth>820,v=split?null:lastViews.find(x=>x.id===view&&x.node)||(two[0]||lastViews.find(x=>x.node)),shown=split?two:[v].filter(Boolean);
 for(const x of lastViews){x.node?.classList.toggle('ws-center',shown.includes(x));x.node?.classList.toggle('ws-half-a',split&&x===two[0]);x.node?.classList.toggle('ws-half-b',split&&x===two[1]);}
 el.querySelectorAll('.ws-views [data-ws]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ws==='view:'+(split||view==='split'&&pair?'split':v?.id))));
 requestAnimationFrame(()=>shown.forEach(x=>x.node.querySelector('[data-view-action="fit"]')?.click()));}
// cfg: {step, states, site, views:[{id,label,node}], figures:[[label,value]], mode:Node|html, bindMode(box), more:Node,
//       primary:{label,onClick,disabled,title}, secondary:[{label,onClick,disabled,title,pressed}], status}
function render(cfg){if(!on){hide();return;}ensure();el.hidden=false;document.body.classList.add('ws-on');
 {const ad=el.querySelector('.ws-addr');ad.textContent=cfg.site||'';ad.title=cfg.site||'';}
 el.querySelector('.ws-steps').innerHTML=STEPS.map(([k,n,label],i)=>{const s=cfg.states?.[k]||'todo',cur=k===cfg.step||(k==='massing'&&cfg.step==='corridor');return `${i?'<span class="ws-arrow" aria-hidden="true">→</span>':''}<button data-ws="step:${k}" data-state="${s}" ${cur?'aria-current="step"':''} title="${esc(label)} · ${s==='done'?'up to date':s==='stale'?'needs update':'not done yet'}"><b>${n}</b> ${esc(label)}${s==='stale'?' <i>update</i>':s==='done'&&!cur?' <i>✓</i>':''}</button>`;}).join('');
 lastViews=(cfg.views||[]).filter(v=>v.node);pair=cfg.split&&cfg.split.every(id=>lastViews.some(v=>v.id===id))?cfg.split:null;
 // a step opens on its own default view (side by side where it has a pair); within the step the choice is kept
 if(cfg.step!==lastStep){lastStep=cfg.step;if(cfg.defaultView)view=cfg.defaultView;}
 if(!lastViews.some(v=>v.id===view)&&!(view==='split'&&pair))view=lastViews[0]?.id||'plan';
 el.querySelector('.ws-views').innerHTML=lastViews.length>1?(pair?`<button data-ws="view:split" aria-pressed="${view==='split'}">Side by side</button>`:'')+lastViews.map(v=>`<button data-ws="view:${v.id}" aria-pressed="${v.id===view}">${esc(v.label)}</button>`).join(''):'';
 figures(cfg.figures);
 const mode=el.querySelector('.ws-mode');if(cfg.mode instanceof Node)mode.replaceChildren(cfg.mode);else mode.innerHTML=cfg.mode||'';cfg.bindMode?.(mode);
 if(cfg.more)host(cfg.more);else unhost();el.querySelector('.ws-more').hidden=!cfg.more;
 const prim=el.querySelector('.ws-primary');prim.innerHTML='';if(cfg.primary){const b=document.createElement('button');b.className='ex-primary ws-go';if(cfg.primary.id)b.id=cfg.primary.id;b.textContent=cfg.primary.label;b.disabled=!!cfg.primary.disabled;if(cfg.primary.title)b.title=cfg.primary.title;b.onclick=cfg.primary.onClick;prim.appendChild(b);}
 const sec=el.querySelector('.ws-secondary');sec.innerHTML='';for(const s of cfg.secondary||[]){if(s.node){sec.appendChild(s.node);continue;}const b=document.createElement('button');b.textContent=s.label;b.disabled=!!s.disabled;if(s.title)b.title=s.title;if(s.pressed!=null)b.setAttribute('aria-pressed',String(s.pressed));b.onclick=s.onClick;sec.appendChild(b);}
 el.querySelector('.ws-status').textContent=cfg.status||'';el.querySelector('.ws-status').title=cfg.status||'';apply();}
function figures(list){if(el)el.querySelector('.ws-figs').innerHTML=(list||[]).map(([l,v])=>`<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('');}
function status(text){if(!el)return;const n=el.querySelector('.ws-status');n.textContent=text||'';n.title=text||'';}
function hide(){unhost();for(const x of lastViews)x.node?.classList.remove('ws-center','ws-half-a','ws-half-b');lastViews=[];document.body.classList.remove('ws-on');if(el)el.hidden=true;}
// In sheet view the tab bar carries the way back.
function syncReturn(){const b=document.getElementById('ws-return');if(!b)return;b.hidden=on||!root.APP||root.APP.state.tab==='site';if(!b.onclick)b.onclick=()=>set(true);}
function set(v){on=!!v;if(!on)hide();syncReturn();root.APP?.refresh();}
root.addEventListener('r3-tab',e=>{if(e.detail==='site')hide();setTimeout(syncReturn);});
root.WORKSPACE_SHELL={render,hide,set,status,figures,isOn:()=>on,getView:()=>view,setView:v=>{view=v;},STEPS};
})(typeof window!=='undefined'?window:globalThis);
