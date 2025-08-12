/* books-shelf.js — 3D glass books on a shelf (Three.js + cannon-es)
   Usage: window.mountBooksShelf(containerEl, [{title, url, id, subtitle}...]) */

const __THREE_MODULE__ = "https://unpkg.com/three@0.160.0/build/three.module.js";
const __ORBIT_MODULE__ = "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
const __CANNON_MODULE__ = "https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js";

async function __loadShelfDeps__() {
  const THREE = await import(__THREE_MODULE__);
  const { OrbitControls } = await import(__ORBIT_MODULE__);
  const C = await import(__CANNON_MODULE__);
  return { THREE, OrbitControls, C };
}

function __makeLabelTexture__(THREE, renderer, title, subtitle) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 44px Inter, system-ui, sans-serif";
  const t = (title || "Untitled").toUpperCase();
  const words = t.split(" "); const lines = []; let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > 18) { lines.push(line.trim()); line = w; }
    else line += " " + w;
  }
  if (line) lines.push(line.trim());
  const y0 = 256 - (lines.length-1) * 36;
  lines.slice(0,3).forEach((ln,i)=> ctx.fillText(ln, 256, y0 + i*72));
  if (subtitle) { ctx.fillStyle="#666"; ctx.font = "28px Inter, system-ui, sans-serif"; ctx.fillText(subtitle, 256, 400); }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 1; tex.needsUpdate = true; return tex;
}

function __makeGlassyBook__(THREE, renderer, { title, subtitle, url }) {
  const w=4.5, h=7.2, d=0.7; // book dims
  const geo = new THREE.BoxGeometry(w,h,d,1,1,1);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness:0, roughness:0.08, transmission:0.92, thickness:0.35, ior:1.45, clearcoat:1, clearcoatRoughness:0.05, transparent:true });
  const cover = new THREE.Mesh(geo, glass);
  const edges = new THREE.EdgesGeometry(geo); cover.add(new THREE.LineSegments(edges,new THREE.LineBasicMaterial({ color:0x111111, opacity:0.9, transparent:true })));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(w*0.82,h*0.44), new THREE.MeshBasicMaterial({ map: __makeLabelTexture__(THREE, renderer, title, subtitle), transparent:true }));
  plate.position.set(0,0,d/2 + 0.001); cover.add(plate);
  const spine = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5,h*0.9,d*0.98)), new THREE.LineBasicMaterial({ color:0x333333 })); spine.position.x = -w/2 + 0.3; cover.add(spine);
  cover.userData = { url, title };
  return { mesh: cover, size: { w, h, d } };
}

function __addShelf__(THREE, scene, C, world, y=0) {
  const plank = new THREE.Mesh(new THREE.BoxGeometry(40,0.5,8), new THREE.MeshStandardMaterial({ color:0xdddddd, roughness:0.7, metalness:0.1 })); plank.position.set(0,y,0); scene.add(plank);
  const wallMat = new THREE.MeshStandardMaterial({ color:0xcccccc, roughness:0.8 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(40,2.0,0.5), wallMat); back.position.set(0,y+1,-3.9); scene.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.5,1.5,8), wallMat); left.position.set(-19.75,y+0.5,0); scene.add(left);
  const right= new THREE.Mesh(new THREE.BoxGeometry(0.5,1.5,8), wallMat); right.position.set(19.75,y+0.5,0); scene.add(right);
  const shelfBody = new C.Body({ mass:0, shape:new C.Box(new C.Vec3(20,0.25,4)), position:new C.Vec3(0,y,0)});
  const backBody  = new C.Body({ mass:0, shape:new C.Box(new C.Vec3(20,1,0.25)), position:new C.Vec3(0,y+1,-3.75)});
  const leftBody  = new C.Body({ mass:0, shape:new C.Box(new C.Vec3(0.25,0.75,4)), position:new C.Vec3(-19.75,y+0.5,0)});
  const rightBody = new C.Body({ mass:0, shape:new C.Box(new C.Vec3(0.25,0.75,4)), position:new C.Vec3(19.75,y+0.5,0)});
  world.addBody(shelfBody); world.addBody(backBody); world.addBody(leftBody); world.addBody(rightBody);
  return { plank, bodies:[shelfBody, backBody, leftBody, rightBody] };
}

function __syncFromBody__(mesh, body) { mesh.position.set(body.position.x, body.position.y, body.position.z); mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w); }

window.mountBooksShelf = async function mountBooksShelf(container, cards=[]) {
  const { THREE, OrbitControls, C } = await __loadShelfDeps__();

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(devicePixelRatio);
  const cw = container.offsetWidth || container.clientWidth || (container.parentElement && container.parentElement.clientWidth) || window.innerWidth;
  const height = Math.max(420, cw * 0.5);
  renderer.setSize(cw, height); renderer.setClearAlpha(0);
  container.innerHTML = ""; container.appendChild(renderer.domElement);
  container.style.minHeight = height + 'px';

  const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(45, renderer.domElement.width/renderer.domElement.height, 0.1, 1000);
  cam.position.set(14, 10, 22);
  const orbit = new OrbitControls(cam, renderer.domElement); orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.minDistance=10; orbit.maxDistance=60; orbit.target.set(0,3.5,0);
  // Mobile-friendly: disable right-click/pan inertia issues and allow touch
  orbit.enablePan = true; orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  scene.add(new THREE.AmbientLight(0xffffff, 0.55)); const dir = new THREE.DirectionalLight(0xffffff, 0.85); dir.position.set(6,12,8); scene.add(dir);

  const world = new C.World({ gravity: new C.Vec3(0,-9.82,0) }); world.broadphase = new C.SAPBroadphase(world); world.allowSleep = true;
  const matShelf = new C.Material("shelf"), matBook = new C.Material("book");
  world.addContactMaterial(new C.ContactMaterial(matBook, matBook, { friction:0.35, restitution:0.05 }));
  world.addContactMaterial(new C.ContactMaterial(matBook, matShelf, { friction:0.6, restitution:0.0 }));

  __addShelf__(THREE, scene, C, world, 0);

  const pickables = []; const spacing = 5.2; const originX = -Math.min(cards.length-1, 6) * (spacing/2);
  cards.forEach((card, i) => {
    const { mesh, size } = __makeGlassyBook__(THREE, renderer, card, i);
    mesh.position.set(originX + i*spacing, 1.0 + (Math.random()*0.4), (Math.random()-0.5)*1.8); mesh.rotation.y = (Math.random()*0.6 - 0.3);
    scene.add(mesh);
    const shape = new C.Box(new C.Vec3(size.w/2, size.h/2, size.d/2));
    const body = new C.Body({ mass:1.4, shape, material:matBook, position:new C.Vec3(mesh.position.x, mesh.position.y + size.h/2, mesh.position.z), angularDamping:0.2, linearDamping:0.06 });
    body.quaternion.setFromEuler(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z, "XYZ"); world.addBody(body);
    mesh.userData.__body = body; mesh.userData.onClick = () => { const url = card.url || '#'; if (url !== '#') window.open(url,'_blank'); };
    pickables.push(mesh);
  });

  const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let justDragged = false;
  renderer.domElement.addEventListener('pointerup', (ev)=>{
    if (justDragged) { justDragged=false; return; }
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left)/r.width)*2 - 1; mouse.y = -((ev.clientY - r.top)/r.height)*2 + 1; ray.setFromCamera(mouse, cam);
    const hit = ray.intersectObjects(pickables, true)[0]; if (hit) { let root = hit.object; while (root && !root.userData?.__body && root.parent) root = root.parent; root?.userData?.onClick?.(); }
  });

  // drag helper
  (function makeDraggable(){
    const rayc = new THREE.Raycaster(); const mouse2 = new THREE.Vector2();
    let active=null, grabLocal=new THREE.Vector3(), dragPlane=new THREE.Plane(), planeNormal=new THREE.Vector3();
    function getIntersect(ev, objs){ const rect = renderer.domElement.getBoundingClientRect(); mouse2.x=((ev.clientX-rect.left)/rect.width)*2-1; mouse2.y=-((ev.clientY-rect.top)/rect.height)*2+1; rayc.setFromCamera(mouse2, cam); return rayc.intersectObjects(objs,true)[0]; }
    renderer.domElement.addEventListener('pointerdown',(ev)=>{ const hit=getIntersect(ev,pickables); if(!hit) return; let root=hit.object; while(root && !root.userData?.__body && root.parent) root=root.parent; if(!root?.userData?.__body) return; active=root; const body=active.userData.__body; body.angularVelocity.set(0,0,0); body.angularDamping=1; planeNormal.copy(cam.getWorldDirection(new THREE.Vector3())).normalize(); dragPlane.setFromNormalAndCoplanarPoint(planeNormal, hit.point.clone()); grabLocal.copy(hit.point).sub(active.position); renderer.domElement.setPointerCapture(ev.pointerId); });
    renderer.domElement.addEventListener('pointermove',(ev)=>{ if(!active) return; const rect=renderer.domElement.getBoundingClientRect(); mouse2.x=((ev.clientX-rect.left)/rect.width)*2-1; mouse2.y=-((ev.clientY-rect.top)/rect.height)*2+1; rayc.setFromCamera(mouse2, cam); const target=new THREE.Vector3(); if(rayc.ray.intersectPlane(dragPlane,target)){ target.sub(grabLocal); const body=active.userData.__body; body.velocity.set(0,0,0); body.angularVelocity.set(0,0,0); body.position.x += (target.x - body.position.x) * 0.35; body.position.y += (target.y - body.position.y) * 0.35; body.position.z += (target.z - body.position.z) * 0.35; justDragged=true; setTimeout(()=>justDragged=false,60);} });
    renderer.domElement.addEventListener('pointerup',(ev)=>{ if(!active) return; const body=active.userData.__body; body.angularDamping=0.2; active=null; renderer.domElement.releasePointerCapture?.(ev.pointerId); });
  })();

  const clock=new THREE.Clock();
  function loop(){ const dt=Math.min(0.033, clock.getDelta()); world.step(1/60, dt, 3); pickables.forEach(m=>__syncFromBody__(m, m.userData.__body)); renderer.render(scene, cam); requestAnimationFrame(loop); }
  loop();

  const ro = new ResizeObserver(()=>{ const w=container.offsetWidth || container.clientWidth || (container.parentElement && container.parentElement.clientWidth) || window.innerWidth; const h=Math.max(360, w*0.75); renderer.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix(); }); ro.observe(container);
};


