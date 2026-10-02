/* Pannable SVG drawings, persistent zoom and a deliberate release-to-commit editor. */
(function(root){'use strict';
// Drawing titles stay one screen size: --u is the drawing's units per screen pixel (from its screen transform), read by
// .dwg-title in sheet.css. Kept current on zoom, pan and resize.
function fitTitle(svg){const m=svg.getScreenCTM?.();if(!m||!m.a)return;svg.style.setProperty('--u',String(1/Math.hypot(m.a,m.b)));}
const titleRO=root.ResizeObserver?new ResizeObserver(es=>es.forEach(e=>fitTitle(e.target))):null;
const views=new Map();let focus='split';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function panel(id,label,svg){return `<section class="ex-view" data-view="${esc(id)}"><div class="ex-view-tools"><strong>${esc(label)}</strong><button data-view-action="pan" aria-pressed="false" title="Toggle pan; middle-drag also pans">Pan</button><button data-view-action="in" aria-label="Zoom in">+</button><button data-view-action="out" aria-label="Zoom out">−</button><button data-view-action="fit">Fit</button>${(id==='design-massing'||id==='reference-mass')&&root.SITE_CONTEXT?`<button data-view-action="context" aria-pressed="${root.SITE_CONTEXT.on}" title="Show streets, lane and approximate neighbouring buildings within ${root.SITE_CONTEXT.RADIUS} m">Context</button>`:''}${id!=='design-massing'?'<button data-view-action="full" aria-pressed="false" title="Open the design workspace (F)">Open workspace</button>':''}</div><div class="ex-canvas">${svg}</div></section>`;}
function toolbar(planLabel='Focus plan'){return `<div class="ex-workspace-tools"><span>WORKSPACE</span>${[['split','Split view'],['plan',planLabel],['massing','Focus massing']].map(([v,t])=>`<button data-focus="${v}" aria-pressed="${focus===v}">${t}</button>`).join('')}${root.DRAWING_MOTION?'<button data-replay-drawing title="Draft the plan and massing again">Replay drawing</button>':''}<small>Pan mode or middle-drag · + / − zoom · Fit resets</small></div>`;}
function zoom(box,factor,anchor=[.5,.5]){const f=Math.min(2,Math.max(.5,factor));return [box[0]+box[2]*anchor[0]*(1-f),box[1]+box[3]*anchor[1]*(1-f),box[2]*f,box[3]*f];}
function bind(stage){
 const grid=stage.querySelector('[data-workspace]');if(grid?.dataset.workspace==='conflict')focus='plan';
 const applyFocus=()=>{if(grid)grid.setAttribute('data-focus-mode',focus);stage.querySelectorAll('[data-focus]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.focus===focus)));};
 stage.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{focus=b.dataset.focus;applyFocus();});applyFocus();
 stage.querySelectorAll('[data-view]').forEach(panel=>{const svg=panel.querySelector('svg'),canvas=panel.querySelector('.ex-canvas');if(!svg||!canvas)return;titleRO?.observe(svg);const home=(svg.getAttribute('viewBox')||'0 0 900 620').split(/[ ,]+/).map(Number),id=panel.dataset.view;let saved=views.get(id),box=saved?.home===home.join(',')?saved.box.slice():home.slice(),pan=!!saved?.pan;
  const apply=()=>{svg.setAttribute('viewBox',box.join(' '));fitTitle(svg);canvas.setAttribute('data-pan',String(pan));const b=panel.querySelector('[data-view-action="pan"]');b?.setAttribute('aria-pressed',String(pan));views.set(id,{home:home.join(','),box:box.slice(),pan});};apply();
  const scale=f=>{const next=zoom(box,f);if(next[2]>=home[2]/8&&next[2]<=home[2]*4){box=next;apply();}};
  panel.querySelectorAll('[data-view-action]').forEach(b=>b.onclick=()=>{const action=b.dataset.viewAction;if(action==='full'){root.dispatchEvent(new CustomEvent('r3-plan-full'));return;}if(action==='context'){root.SITE_CONTEXT.on=!root.SITE_CONTEXT.on;root.APP?.refresh();return;}if(action==='pan')pan=!pan;else if(action==='fit')box=home.slice();else scale(action==='in'?.8:1.25);apply();});
  // Guard also makes the DOM contract harness explicit: pointer behaviour needs a real SVG DOM.
  if(!svg.createSVGPoint)return;
  const map=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());};
  canvas.addEventListener('pointerdown',e=>{if(e.button!==1&&!(pan&&e.button===0))return;e.preventDefault();e.stopPropagation();const start=map(e),origin=box.slice(),pointer=e.pointerId;const move=v=>{if(v.pointerId!==pointer)return;const p=map(v);box=[box[0]+start.x-p.x,box[1]+start.y-p.y,origin[2],origin[3]];apply();};const clear=()=>{root.removeEventListener('pointermove',move);root.removeEventListener('pointerup',end);root.removeEventListener('pointercancel',end);};const end=v=>{if(v.pointerId===pointer)clear();};root.addEventListener('pointermove',move);root.addEventListener('pointerup',end);root.addEventListener('pointercancel',end);},true);
 });
}
function dragDelta(start,event,point,origin,step=.1){if(Math.hypot(event.clientX-start.clientX,event.clientY-start.clientY)<6)return null;let dx=point.x-origin.x,dy=point.y-origin.y;if(event.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}return {dx:Math.round(dx/step)*step,dy:Math.round(dy/step)*step};}
function drag(el,event,{preview,commit,cancel,click}){
 if(event.button!==0||el.closest?.('[data-pan="true"]'))return;const svg=el.ownerSVGElement,frame=svg?.querySelector('[data-plan-frame]');if(!frame||!svg.createSVGPoint)return;
 event.preventDefault();event.stopPropagation();const pointer=event.pointerId,map=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(frame.getScreenCTM().inverse());},origin=map(event);let moved=false,latest=null;
 const move=e=>{if(e.pointerId!==pointer)return;const delta=dragDelta(event,e,map(e),origin);if(!delta&&!moved)return;latest=delta||{dx:0,dy:0};moved=true;preview(latest,e);};
 const clear=()=>{root.removeEventListener('pointermove',move);root.removeEventListener('pointerup',end);root.removeEventListener('pointercancel',abort);root.removeEventListener('keydown',key);};
 const end=e=>{if(e.pointerId!==pointer)return;clear();if(moved)commit(latest);else click?.();};const abort=e=>{if(e.pointerId!=null&&e.pointerId!==pointer)return;clear();cancel?.();};const key=e=>{if(e.key==='Escape'){e.preventDefault();abort(e);}};
 root.addEventListener('pointermove',move);root.addEventListener('pointerup',end);root.addEventListener('pointercancel',abort);root.addEventListener('keydown',key);
}
root.WORKSPACE_VIEW={panel,toolbar,bind,zoom,dragDelta,drag};
})(typeof window!=='undefined'?window:globalThis);
