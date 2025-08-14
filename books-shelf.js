/* books-shelf.js — Drag carousel of blog cards with 3D wireframe hover */

function __ensureCarouselStyles__() {
  if (document.getElementById('blog-carousel-styles')) return;
  const css = `
  :root{--page-bg: transparent}
  .bc-wrap{position:relative;overflow:hidden;padding:72px 0;perspective:900px}
  .bc-stage{transform-style:preserve-3d;will-change:transform;transition:transform .18s ease}
  .bc-track{display:flex;gap:24px;will-change:transform;padding:0 16px}
  /* drag strip at bottom */
  .bc-dragstrip{position:absolute;left:0;right:0;bottom:0;height:88px;cursor:grab}
  .bc-dragstrip.dragging{cursor:grabbing}
  /* 1:1.5 ratio (width:height), default as 2D black rectangle */
  .bc-card{position:relative;flex:0 0 var(--card-w,200px);aspect-ratio:2/3;background:var(--page-bg);color:#111;border:1px solid #111;border-radius:0;padding:12px 14px;display:flex;flex-direction:column;justify-content:center;transform-style:preserve-3d;transition:transform .2s ease;--d:22px;--bw:1px;--dx: calc(-1 * var(--d)); --dy: calc(-1 * var(--d)); --len: calc(var(--d) * 1.41421356); text-decoration:none}
  /* back face for wireframe (appears on hover) */
  .bc-card::before{content:'';position:absolute;inset:0;border:1px solid #111;border-radius:0;transform:translate(calc(var(--dx) + var(--bw)), calc(var(--dy) + var(--bw)));opacity:0;transition:opacity .15s ease}
  /* connecting edges (appear on hover) */
  .bc-edges{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .15s ease}
  .bc-edges .e{position:absolute;height:var(--bw);width:var(--len);background:#111;border-radius:0}
  .bc-edges .e.tl{top:calc(-1 * var(--bw));left:calc(-1 * var(--bw));transform-origin:left center;transform:rotate(45deg)}
  .bc-edges .e.tr{top:calc(-1 * var(--bw));right:calc(-1 * var(--bw));transform-origin:right center;transform:rotate(-45deg)}
  .bc-edges .e.bl{bottom:calc(-1 * var(--bw));left:calc(-1 * var(--bw));transform-origin:left center;transform:rotate(-45deg)}
  .bc-edges .e.br{bottom:calc(-1 * var(--bw));right:calc(-1 * var(--bw));transform-origin:right center;transform:rotate(45deg)}
  .bc-card h3{font-family:'Baskervville',serif;font-size:20px;line-height:1.12;margin:0 0 4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
  .bc-card p{margin:0;color:#333;font-size:12px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
  /* hover: show 3D wireframe box */
  .bc-card:hover{transform:translateZ(22px) rotateX(16deg) rotateY(14deg)}
  .bc-card:hover::before{opacity:1}
  .bc-card:hover .bc-edges{opacity:1}
  /* arrows removed */
  `;
  const style = document.createElement('style'); style.id='blog-carousel-styles'; style.textContent = css; document.head.appendChild(style);
}

window.mountBooksShelf = function mountBooksShelf(container, cards=[]) {
  __ensureCarouselStyles__();

  // Use exactly the articles provided (from RSS/Substack JSON); no placeholders
  const list = Array.isArray(cards) ? cards.slice(0) : [];

  const wrap = document.createElement('div'); wrap.className = 'bc-wrap';
  const stage = document.createElement('div'); stage.className = 'bc-stage';
  const track = document.createElement('div'); track.className = 'bc-track';

  list.forEach((c)=>{
    const a = document.createElement('a'); a.className='bc-card'; a.href=c.url||'#'; a.target='_blank'; a.rel='noopener noreferrer';
    const h = document.createElement('h3'); h.textContent=(c.title||'Untitled').trim();
    const p = document.createElement('p'); p.textContent=c.subtitle||'';
    const edges = document.createElement('div'); edges.className='bc-edges';
    ;['tl','tr','bl','br'].forEach(k=>{ const e=document.createElement('div'); e.className='e '+k; edges.appendChild(e); });
    a.appendChild(h); if(p.textContent) a.appendChild(p);
    a.appendChild(edges);
    track.appendChild(a);
  });

  stage.appendChild(track);
  wrap.appendChild(stage);
  container.innerHTML='';
  const bg = getComputedStyle(document.body).backgroundColor || '#fff';
  document.documentElement.style.setProperty('--page-bg', bg);
  container.appendChild(wrap);

  // Dragging with momentum
  let offset = 0; let startX = 0; let startOffset = 0; let moved = 0; let dragging=false;
  let lastTime=0; let lastOffset=0; let velocity=0; let raf=null;

  function trackWidth(){ return track.scrollWidth; }
  function wrapWidth(){ return wrap.clientWidth; }
  function bounds(){
    const tw = trackWidth(); const ww = wrapWidth();
    const maxOff = Math.max(0, tw - ww);
    const overscroll = Math.max(40, Math.min(ww * 0.15, 120));
    return { maxOff, overscroll };
  }
  function clamp(v){ const { maxOff, overscroll } = bounds(); return Math.max(-overscroll, Math.min(v, maxOff + overscroll)); }
  function apply(){ track.style.transform = `translateX(${-offset}px)`; }
  function stop(){ if (raf) cancelAnimationFrame(raf), raf=null; }
  function glide(){ stop(); const friction=0.92, min=0.02; function step(){ velocity*=friction; if (Math.abs(velocity)<min) return; offset=clamp(offset - velocity*16); apply(); raf=requestAnimationFrame(step);} raf=requestAnimationFrame(step); }

  const dragstrip = document.createElement('div'); dragstrip.className='bc-dragstrip'; wrap.appendChild(dragstrip);
  let preventClick = false;
  function onDown(e){ dragging=true; moved=0; preventClick=false; startX=e.clientX; startOffset=offset; lastOffset=offset; lastTime=performance.now(); stop(); dragstrip.classList.add('dragging'); dragstrip.setPointerCapture(e.pointerId); }
  function onMove(e){ if(!dragging) return; const dx=e.clientX-startX; moved=Math.max(moved,Math.abs(dx)); if (moved>3) preventClick=true; offset=clamp(startOffset - dx); const now=performance.now(), dt=Math.max(1, now-lastTime); velocity=(offset-lastOffset)/dt; lastOffset=offset; lastTime=now; apply(); }
  function onUp(e){
    dragstrip.releasePointerCapture?.(e.pointerId); dragging=false; dragstrip.classList.remove('dragging');
    if (moved>6){
      const { maxOff } = bounds();
      if (offset < 0 || offset > maxOff) { tweenTo(Math.max(0, Math.min(offset, maxOff))); }
      else { glide(); }
    }
  }
  dragstrip.addEventListener('pointerdown', onDown);
  dragstrip.addEventListener('pointermove', onMove);
  dragstrip.addEventListener('pointerup', onUp);
  // disable wheel scrolling of carousel per request

  function gapPx(){ const g = getComputedStyle(track).gap || '24px'; return parseFloat(g) || 24; }
  function cardWidth(){ const first = track.querySelector('.bc-card'); return first ? first.getBoundingClientRect().width : 200; }
  function step(){ return cardWidth() + gapPx(); }
  function tweenTo(target){ target = clamp(target); stop(); function stepper(){ const diff=target-offset; if (Math.abs(diff)<0.5){ offset=target; apply(); return; } offset += diff*0.18; apply(); raf=requestAnimationFrame(stepper);} stepper(); }

  // 3D plane tilt based on pointer position (disabled while dragging)
  let tiltX = 0, tiltY = 0; const maxTilt = 12;
  function applyTilt(){ stage.style.transform = `rotateX(${tiltY}deg) rotateY(${tiltX}deg)`; }
  wrap.addEventListener('mousemove',(e)=>{
    if (dragging) return; const r = wrap.getBoundingClientRect();
    const nx = ((e.clientX - r.left)/r.width - 0.5) * 2; // -1..1
    const ny = ((e.clientY - r.top)/r.height - 0.5) * 2;
    tiltX = Math.max(-maxTilt, Math.min(maxTilt, nx * maxTilt));
    tiltY = Math.max(-maxTilt, Math.min(maxTilt, -ny * maxTilt));
    applyTilt();
  });
  wrap.addEventListener('mouseleave',()=>{ tiltX=0; tiltY=0; applyTilt(); });

  const ro = new ResizeObserver(()=>{ offset=clamp(offset); apply(); }); ro.observe(wrap);
  // Custom cursor that shows the word DRAG when hovering the drag strip
  const dragSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"64\" viewBox=\"0 0 64 64\"><circle cx=\"32\" cy=\"32\" r=\"22\" stroke=\"#111\" stroke-width=\"1\" fill=\"none\"/><text x=\"32\" y=\"38\" text-anchor=\"middle\" font-family=\"Baskervville, serif\" font-style=\"italic\" font-size=\"12\" fill=\"#111\">DRAG</text></svg>";
  const dragCursorUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(dragSvg)}") 16 16, grab`;
  dragstrip.addEventListener('mouseenter', ()=>{ dragstrip.style.cursor = dragCursorUrl; });
  dragstrip.addEventListener('mouseleave', ()=>{ dragstrip.style.cursor = ''; });
};


