document.getElementById('tg').onclick=function(){var d=document.documentElement,n=d.dataset.theme==='light'?'dark':'light';d.dataset.theme=n;try{localStorage.setItem('mn-theme',n)}catch(e){}};
(function(){
var c=document.getElementById('gl');if(!c)return;var st=c.parentElement;
/* Smooth the side-wall normals along the outline (caps stay flat) so the chrome reflects evenly instead of per-facet. */
function smooth(geo,deg){
  var p=geo.attributes.position,e=geo.attributes.normal,n=p.count,th=Math.cos(deg*Math.PI/180),F=[],K=[],map={},N=new Float32Array(n*3),i,v,k,
      A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),cap=function(o){return Math.abs(o.u.z)>.9995};
  for(i=0;i<n;i+=3){
    A.fromBufferAttribute(p,i);B.fromBufferAttribute(p,i+1);C.fromBufferAttribute(p,i+2);
    var f=B.clone().sub(A).cross(C.clone().sub(A)),L=f.length(),o;
    if(L)f.divideScalar(L);
    if(f.x*e.getX(i)+f.y*e.getY(i)+f.z*e.getZ(i)<0)f.negate();
    o={w:L,u:f};
    for(v=0;v<3;v++){k=Math.round(p.getX(i+v)*1e4)+','+Math.round(p.getY(i+v)*1e4)+','+Math.round(p.getZ(i+v)*1e4);F[i+v]=o;K[i+v]=k;(map[k]=map[k]||[]).push(o)}
  }
  for(i=0;i<n;i++){
    var c=F[i],s=new THREE.Vector3();
    if(cap(c))s.copy(c.u);else map[K[i]].forEach(function(q){if(!cap(q)&&q.u.dot(c.u)>th)s.addScaledVector(q.u,q.w)});
    if(!s.lengthSq())s.copy(c.u);
    s.normalize();N[i*3]=s.x;N[i*3+1]=s.y;N[i*3+2]=s.z;
  }
  geo.setAttribute('normal',new THREE.BufferAttribute(N,3));
}
try{
var R=new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:true});
R.setPixelRatio(Math.min(devicePixelRatio,2));R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.05;
var S=new THREE.Scene(),cam=new THREE.PerspectiveCamera(32,1,.1,50);cam.position.set(0,0,9);
var E=new THREE.Scene();E.background=new THREE.Color(0x011745);
function panel(w,h,x,y,z,col){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);E.add(m)}
panel(10,3,0,8,2,new THREE.Color(1.1,1.25,1.6));panel(3,9,-8,1,3,new THREE.Color(1,1.15,1.5));panel(2,6,7,0,4,new THREE.Color(0x0F70C2).multiplyScalar(2.8));panel(12,2,0,-7,3,new THREE.Color(.8,.95,1.3));
S.environment=new THREE.PMREMGenerator(R).fromScene(E,.04).texture;
var U={uT:{value:0},uA:{value:0},uC:{value:new THREE.Vector2()}},ct=-1,ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
var M=new THREE.MeshStandardMaterial({color:0xffffff,metalness:1,roughness:.22}),g=new THREE.Group();S.add(g);
/* click ripple: bends the normals per pixel so the reflected light bends, no geometry change needed */
M.onBeforeCompile=function(sh){
  sh.uniforms.uT=U.uT;sh.uniforms.uA=U.uA;sh.uniforms.uC=U.uC;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vXY;varying vec3 vTX;varying vec3 vTY;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvXY=position.xy;vTX=normalize(normalMatrix*vec3(1.,0.,0.));vTY=normalize(normalMatrix*vec3(0.,1.,0.));');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uT;uniform float uA;uniform vec2 uC;varying vec2 vXY;varying vec3 vTX;varying vec3 vTY;')
    .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec2 wd=vXY-uC;float wr=length(wd)+1e-4;float wx=(wr-uT*3.2)/.9;float wg=-2.*wx*exp(-wx*wx)*uA*.6;vec2 wn=wd/wr;normal=normalize(normal+(vTX*wn.x+vTY*wn.y)*wg);');
};
var D=window.MARK,K=4/(D.mb[2]-D.mb[0]),cx=(D.mb[0]+D.mb[2])/2,cy=(D.mb[1]+D.mb[3])/2;
function pts(a){var r=[];for(var i=0;i<a.length;i+=2)r.push(new THREE.Vector2((a[i]-cx)*K,-(a[i+1]-cy)*K));return r}
var sh=D.g.map(function(o){var s=new THREE.Shape(pts(o.o));o.h.forEach(function(h){s.holes.push(new THREE.Path(pts(h)))});return s});
/* bevelOffset = -bevelSize keeps the side walls exactly on the logo outline, so neighbouring pieces (7px apart) never grow into each other. */
var geo=new THREE.ExtrudeGeometry(sh,{depth:.34,bevelEnabled:true,bevelThickness:.05,bevelSize:.016,bevelOffset:-.016,bevelSegments:3,curveSegments:1});
geo.translate(0,0,-.17);smooth(geo,35);var mesh=new THREE.Mesh(geo,M);g.add(mesh);
c.addEventListener('pointerdown',function(e){
  if(rm)return;var b=c.getBoundingClientRect();ndc.set((e.clientX-b.left)/b.width*2-1,-((e.clientY-b.top)/b.height)*2+1);
  ray.setFromCamera(ndc,cam);var hit=ray.intersectObject(mesh)[0];if(!hit)return;
  var p=mesh.worldToLocal(hit.point.clone());U.uC.value.set(p.x,p.y);ct=0;
});
function rs(){var w=st.clientWidth;R.setSize(w,w,false)}
new ResizeObserver(rs).observe(st);rs();
var mx=0,my=0,vis=true,rm=matchMedia('(prefers-reduced-motion:reduce)').matches,t0=performance.now();
new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(st);
var T=0,last=0;
(function f(now){requestAnimationFrame(f);if(!vis||document.hidden){last=0;return}
var dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!rm)T+=dt;
if(ct>=0){ct+=dt;U.uT.value=ct;U.uA.value=Math.exp(-ct*.9);if(ct>3.2){ct=-1;U.uA.value=0}}
g.rotation.y+=((T*.25+mx*.4)-g.rotation.y)*.05;g.rotation.x+=((my*.5-.12)-g.rotation.x)*.05;g.position.y=Math.sin(T*.8)*.1;R.render(S,cam)})(performance.now());
}catch(e){st.classList.add('nogl')}
})();

(function(){
var h=document.querySelector('header');
function s(){h.classList.toggle('sm',scrollY>60)}
addEventListener('scroll',s,{passive:true});s();
})();

(function(){
var box=document.querySelector('.stats');
if(!box||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
var items=[].slice.call(box.querySelectorAll('.st')),timers=[],running=false;
function later(f,ms){timers.push(setTimeout(f,ms))}
function reset(){
  timers.forEach(clearTimeout);timers=[];running=false;
  items.forEach(function(el){el.classList.remove('roll','hit');el.classList.add('pend');var b=el.querySelector('b');b.textContent=b.dataset.count+(b.dataset.suf||'')});
}
function roll(k){
  if(k>=items.length)return;
  var el=items[k],b=el.querySelector('b'),n=+b.dataset.count,suf=b.dataset.suf||'',max=Math.pow(10,String(n).length),iv;
  el.classList.remove('pend');el.classList.add('roll');
  iv=setInterval(function(){b.textContent=Math.floor(Math.random()*max)+suf},45);
  timers.push(iv);
  later(function(){
    clearInterval(iv);b.textContent=n+suf;
    el.classList.remove('roll');el.classList.add('hit');
    later(function(){roll(k+1)},250);
  },700);
}
reset();
/* the count plays once per page load */
var sio=new IntersectionObserver(function(e){
  if(e[0].intersectionRatio>=.25&&!running){running=true;roll(0);sio.disconnect()}
},{threshold:[0,.25]});
sio.observe(box.closest('section'));
})();

(function(){
var sec=document.querySelector('.values');if(!sec)return;
var vk=sec.querySelector('.vk'),items=[].slice.call(sec.querySelectorAll('.vi')),n=items.length,line=sec.querySelector('.vline'),segs=[],cur=-1,tick=false;
line.innerHTML='';for(var k=0;k<n;k++){var s=document.createElement('i');s.innerHTML='<b></b><em>0'+(k+1)+'</em>';line.appendChild(s);segs.push(s)}
sec.style.setProperty('--n',n+1);sec.classList.add('on');
function upd(){
  tick=false;
  var r=vk.getBoundingClientRect(),total=r.height-innerHeight,prog=total>0?Math.min(1,Math.max(0,-r.top/total)):0,idx=Math.min(n,Math.floor(prog*(n+1)));
  if(idx===cur)return;cur=idx;sec.classList.toggle('all',idx===n);
  items.forEach(function(el,k){el.classList.toggle('cur',k===idx);el.classList.toggle('past',k<idx);segs[k].classList.toggle('on',k===idx);segs[k].style.setProperty('--d',k===idx?1:0)});
  sec.style.setProperty('--gp',idx%2);
}
function req(){if(!tick){tick=true;requestAnimationFrame(upd)}}
addEventListener('scroll',req,{passive:true});addEventListener('resize',req);upd();
})();

(function(){
var nav=document.querySelector('.nav'),raf=0,ev,tm=0;
if(!nav||!matchMedia('(hover:hover)').matches)return;
var rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
function set(x,y,rx,ry){nav.style.setProperty('--px',x);nav.style.setProperty('--py',y);nav.style.setProperty('--rx',rx);nav.style.setProperty('--ry',ry)}
function enter(){clearTimeout(tm);tm=0;nav.classList.add('near')}
function leave(){if(tm||!nav.classList.contains('near'))return;tm=setTimeout(function(){tm=0;nav.classList.remove('near');set('50%','50%','0deg','0deg')},400)}
document.addEventListener('pointermove',function(e){ev=e;if(raf)return;raf=requestAnimationFrame(function(){raf=0;
  var r=nav.getBoundingClientRect();
  /* the pill, a margin around it and everything above it up to the top of the window count as hovering */
  if(ev.clientX>=r.left-56&&ev.clientX<=r.right+56&&ev.clientY<=r.bottom+30){
    enter();
    if(!rm){var x=Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width)),y=Math.min(1,Math.max(0,(ev.clientY-r.top)/r.height));set(x*100+'%',y*100+'%',(.5-y)*8+'deg',(x-.5)*7+'deg')}
  }else leave();
})},{passive:true});
document.documentElement.addEventListener('mouseleave',leave);
})();

(function(){
var t=document.querySelector('.track');if(!t)return;
var base=[].slice.call(t.children),w=t.scrollWidth+base.length*20,reps=Math.max(1,Math.ceil(Math.max(innerWidth,screen.width)/w)),i;
for(i=1;i<reps;i++)base.forEach(function(c){t.appendChild(c.cloneNode(true))});
[].slice.call(t.children).forEach(function(c){var d=c.cloneNode(true);d.setAttribute('aria-hidden','true');d.tabIndex=-1;t.appendChild(d)});
t.style.animationDuration=Math.round(w*reps/60)+'s';
})();

/* Anchor links that would scroll through the pinned values section or the services stack jump over them instead. */
(function(){
var raf=0,stop=false;
['wheel','touchstart','keydown'].forEach(function(ev){addEventListener(ev,function(){stop=true},{passive:true})});
function ranges(){
  var r=[],sec=document.querySelector('.values'),vk=sec&&sec.querySelector('.vk'),sk=document.querySelector('.sk');
  if(vk)r.push({el:sec,S:vk.getBoundingClientRect().top+scrollY,L:Math.max(0,vk.offsetHeight-innerHeight)});
  if(sk)r.push({el:sk,S:sk.getBoundingClientRect().top+scrollY,L:sk.offsetHeight});
  r=r.filter(function(x){return x.L>0}).sort(function(a,b){return a.S-b.S});
  var cum=0;r.forEach(function(x){x.V=x.S-cum;cum+=x.L});
  return r;
}
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;
  var id=a.getAttribute('href').slice(1),el=id&&document.getElementById(id);if(!el)return;
  var R=ranges(),pad=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0,max=document.documentElement.scrollHeight-innerHeight,
      t=Math.min(max,Math.max(0,el.getBoundingClientRect().top+scrollY-pad)),c=scrollY,k;
  for(k=0;k<R.length;k++)if(t>R[k].S&&t<R[k].S+R[k].L)return;
  function f(p){var v=p;R.forEach(function(r){if(p>=r.S+r.L)v-=r.L;else if(p>r.S)v-=p-r.S});return v}
  function g(u){var s=0;R.forEach(function(r){if(u>r.V)s+=r.L});return u+s}
  var from=f(c),to=f(t);
  R.forEach(function(r){if(c>r.S&&c<r.S+r.L&&t>=r.S+r.L)from=Math.max(from,r.V+.01)});
  if(Math.abs(t-c)-Math.abs(to-from)<2)return;
  e.preventDefault();history.pushState(null,'',a.getAttribute('href'));
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){scrollTo({top:t,behavior:'instant'});return}
  cancelAnimationFrame(raf);stop=false;
  function done(){R.forEach(function(r){r.el.classList.remove('skip')})}
  var d=Math.min(1200,Math.max(600,Math.abs(to-from)*.35)),t0=performance.now();
  (function step(now){
    if(stop){done();return}
    var x=Math.min(1,(now-t0)/d),q=x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
    var u=from+(to-from)*q;R.forEach(function(r){r.el.classList.toggle('skip',u>=r.V-1)});scrollTo({top:g(u),behavior:'instant'});
    if(x<1)raf=requestAnimationFrame(step);else done();
  })(t0);
});
})();


/* zoom reveal: sections appear and disappear while scrolling */
(function(){
if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
var io=new IntersectionObserver(function(es){es.forEach(function(e){var t=e.target;if(e.isIntersecting){t.classList.add('in');t.classList.remove('up')}else{t.classList.remove('in');t.classList.toggle('up',e.boundingClientRect.top<0)}})},{rootMargin:'-6% 0px -6% 0px',threshold:.1});
[].forEach.call(document.querySelectorAll('.hd,#nosotros .two>h2,#nosotros .two>div>p,#nosotros .mv,#servicios .grid,.w>h2,.stats,.stats~.chips,.row,.tech-sec,.end,[data-rv]'),function(el){if(el.closest('.hero,.vs,footer,.ctm')||el.classList.contains('rv'))return;el.classList.add('rv');io.observe(el)});
})();

/* region picker */
(function(){
var dlg=document.getElementById('region-dlg'),btn=document.querySelector('.rg-open'),last;if(!dlg||!btn)return;
function set(o){dlg.classList.toggle('open',o);btn.setAttribute('aria-expanded',o);document.documentElement.style.overflow=o?'hidden':'';if(o){last=document.activeElement;dlg.querySelector('.rg-x').focus()}else if(last)last.focus()}
btn.addEventListener('click',function(){set(true)});
dlg.addEventListener('click',function(e){if(e.target.closest('[data-close],[data-region]'))set(false)});
addEventListener('keydown',function(e){if(e.key==='Escape'&&dlg.classList.contains('open'))set(false)});
})();

/* contact forms (Formspree), the home section and the pop-up, with typing placeholder */
[].forEach.call(document.querySelectorAll('form.cf'),function(f){
var btn=f.querySelector('.cf-btn'),s1=btn.querySelector('.cf-s'),s2=btn.querySelector('.cf-w'),st=f.querySelector('.cf-st'),ta=f.querySelector('textarea'),src=f.querySelector('.cf-ph'),pi=0,ci=0,del=false,tm;
function show(k,ok){[].forEach.call(st.children,function(c){c.hidden=c.dataset.s!==k});st.className='cf-st '+(ok?'ok':'bad');st.hidden=false}
function type(){
  if(document.activeElement===ta||ta.value.length){ta.placeholder='';return}
  var list=src.textContent.split('|'),cur=list[pi%list.length];
  if(!del){ta.placeholder=cur.substring(0,ci+1);ci++;if(ci>=cur.length){del=true;tm=setTimeout(type,1500);return}}
  else{ta.placeholder=cur.substring(0,Math.max(0,ci-1));ci--;if(ci<=0){ci=0;del=false;pi=(pi+1)%list.length}}
  tm=setTimeout(type,del?40:80);
}
f.addEventListener('submit',function(e){
  e.preventDefault();
  if(/YOUR_FORM_ID/.test(f.action)){show('err',false);return}
  btn.disabled=true;s1.hidden=true;s2.hidden=false;st.hidden=true;
  fetch(f.action,{method:'POST',body:new FormData(f),headers:{Accept:'application/json'}})
    .then(function(r){if(r.ok){show('ok',true);f.reset();clearTimeout(tm);type()}else show('err',false)})
    .catch(function(){show('net',false)})
    .then(function(){btn.disabled=false;s1.hidden=false;s2.hidden=true});
});
ta.addEventListener('focus',function(){clearTimeout(tm);ta.placeholder=''});
ta.addEventListener('blur',function(){if(!ta.value){clearTimeout(tm);type()}});
if(matchMedia('(prefers-reduced-motion:reduce)').matches)ta.placeholder=src.textContent.split('|')[0];else type();
});

/* intro network: nodes drift around fixed spots, the pointer pushes them, a click sends a pulse of energy along the lines across the whole grid, and a fixed number of nodes glow at any time */
(function(){
var sec=document.querySelector('.nx'),c=sec&&sec.querySelector('canvas');if(!c)return;
var x=c.getContext('2d'),rm=matchMedia('(prefers-reduced-motion:reduce)').matches,W=0,H=0,N=[],P=[],adj,lit=[],pl=[],px=-9999,py=-9999,pa=0,pt=0,vis=true,last=0,T=0,R=190,SPEED=950,TRAIL=320;
var sp=document.createElement('canvas');sp.width=sp.height=64;
(function(){var g=sp.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(190,225,255,1)');r.addColorStop(.22,'rgba(90,165,255,.5)');r.addColorStop(1,'rgba(40,120,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)})();
function pick(){var i,k=0;do{i=Math.floor(Math.random()*N.length);k++}while(k<40&&lit.some(function(l){return l.i===i}));return i}
function build(){
  var b=sec.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);W=b.width;H=b.height;
  c.width=Math.round(W*d);c.height=Math.round(H*d);x.setTransform(d,0,0,d,0,0);
  var n=Math.max(30,Math.min(110,Math.round(W*H/12000))),cols=Math.max(4,Math.round(Math.sqrt(n*W/H))),rows=Math.max(3,Math.round(n/cols)),cw=(W+120)/cols,ch=(H+120)/rows,i,j;
  N=[];pl=[];
  for(i=0;i<cols;i++)for(j=0;j<rows;j++)N.push({hx:-60+(i+.15+Math.random()*.7)*cw,hy:-60+(j+.15+Math.random()*.7)*ch,ox:0,oy:0,a:Math.random()*6.28,b:Math.random()*6.28,sa:.12+Math.random()*.25,sb:.12+Math.random()*.25,r:10+Math.random()*22,s:1+Math.random()*1.4,big:Math.random()<.14,lit:0});
  P=N.map(function(){return{x:0,y:0}});adj=new Uint8Array(N.length*N.length);
  lit=[];var K=Math.max(5,Math.round(N.length*.12));
  if(!rm)for(i=0;i<K;i++){var life=4+Math.random()*3;lit.push({i:pick(),age:Math.random()*life,life:life})}
  draw();
}
function tickLit(dt){
  N.forEach(function(s){s.lit=0});
  lit.forEach(function(l){l.age+=dt;if(l.age>=l.life){l.i=pick();l.age=0;l.life=4+Math.random()*3}var k=Math.sin(Math.PI*l.age/l.life);N[l.i].lit=k*k});
}
/* shortest path along the lines from the node nearest to the click; every node gets its distance from the source */
function makePulse(cx,cy){
  var n=N.length,src=0,best=1e12,i,j,k;
  for(i=0;i<n;i++){var dx=P[i].x-cx,dy=P[i].y-cy,d=dx*dx+dy*dy;if(d<best){best=d;src=i}}
  var dist=new Float32Array(n).fill(Infinity),done=new Uint8Array(n),d0=Math.sqrt(best);dist[src]=d0;
  for(k=0;k<n;k++){
    var u=-1,m=Infinity;for(i=0;i<n;i++)if(!done[i]&&dist[i]<m){m=dist[i];u=i}
    if(u<0)break;done[u]=1;
    for(j=0;j<n;j++)if(adj[u*n+j]&&!done[j]){var ex=P[u].x-P[j].x,ey=P[u].y-P[j].y,nd=m+Math.sqrt(ex*ex+ey*ey);if(nd<dist[j])dist[j]=nd}
  }
  var mx=0;for(i=0;i<n;i++)if(dist[i]<Infinity&&dist[i]>mx)mx=dist[i];
  return{t:0,dist:dist,max:mx,src:src,cx:cx,cy:cy,d0:d0};
}
function pg(ax,ay){if(pa<=0.001)return 0;var dx=ax-px,dy=ay-py;return Math.max(0,1-Math.sqrt(dx*dx+dy*dy)/(R*1.15))*pa}
/* bright head with a fading tail from (ax,ay) to (bx,by); h is how far the head has travelled along it */
function beam(ax,ay,bx,by,len,h){
  if(h<=0||h-TRAIL>len||len<1)return;
  var hp=Math.min(1,h/len),a0=Math.max(0,Math.min(1,1-h/TRAIL)),a1=Math.max(0,Math.min(1,1-(h-len)/TRAIL)),g=x.createLinearGradient(ax,ay,bx,by);
  g.addColorStop(0,'rgba(215,236,255,'+a0*.95+')');g.addColorStop(hp,'rgba(235,246,255,'+a1+')');
  if(hp<1){g.addColorStop(Math.min(1,hp+.002),'rgba(235,246,255,0)');g.addColorStop(1,'rgba(235,246,255,0)')}
  x.strokeStyle=g;x.lineWidth=2.4;x.beginPath();x.moveTo(ax,ay);x.lineTo(bx,by);x.stroke();
  if(h<len){var hx=ax+(bx-ax)*hp,hy=ay+(by-ay)*hp;x.globalAlpha=.9;x.drawImage(sp,hx-14,hy-14,28,28);x.globalAlpha=1}
}
function draw(){
  if(!adj)return;
  var n=N.length,D=Math.max(120,Math.min(200,W*.14)),D2=D*D,i,j,k,s,p,q,G=new Float32Array(n),w;
  x.clearRect(0,0,W,H);
  for(i=0;i<n;i++){
    s=N[i];var bx=s.hx+Math.cos(T*s.sa+s.a)*s.r,by=s.hy+Math.sin(T*s.sb+s.b)*s.r,tx=0,ty=0,dx=bx-px,dy=by-py,d2=dx*dx+dy*dy,d,f;
    if(pa>0&&d2<R*R&&d2>1){d=Math.sqrt(d2);f=Math.pow(1-d/R,2)*80;tx=dx/d*f;ty=dy/d*f}
    s.ox+=(tx-s.ox)*.08;s.oy+=(ty-s.oy)*.08;P[i].x=bx+s.ox;P[i].y=by+s.oy;
    G[i]=pg(P[i].x,P[i].y);
  }
  adj.fill(0);
  for(i=0;i<n;i++)for(j=i+1;j<n;j++){var ex=P[i].x-P[j].x,ey=P[i].y-P[j].y;if(ex*ex+ey*ey<D2)adj[i*n+j]=adj[j*n+i]=1}
  for(i=0;i<n;i++)for(j=i+1;j<n;j++){if(!adj[i*n+j])continue;for(k=j+1;k<n;k++){if(!adj[i*n+k]||!adj[j*n+k])continue;
    var cx=(P[i].x+P[j].x+P[k].x)/3,cy=(P[i].y+P[j].y+P[k].y)/3,l=pg(cx,cy),tw=.5+.5*Math.sin(T*.6+i*1.7+j*.9+k*.4);
    x.fillStyle='rgba(70,150,255,'+(.025+.035*tw+.16*l+.04*(N[i].lit+N[j].lit+N[k].lit))+')';x.beginPath();x.moveTo(P[i].x,P[i].y);x.lineTo(P[j].x,P[j].y);x.lineTo(P[k].x,P[k].y);x.closePath();x.fill()}}
  for(i=0;i<n;i++)for(j=i+1;j<n;j++){if(!adj[i*n+j])continue;
    p=P[i];q=P[j];var fx=p.x-q.x,fy=p.y-q.y,a=1-Math.sqrt(fx*fx+fy*fy)/D,l2=pg((p.x+q.x)/2,(p.y+q.y)/2);
    x.strokeStyle='rgba(130,195,255,'+Math.min(1,a*.5+l2*.7+(N[i].lit+N[j].lit)*.25*a)+')';x.lineWidth=.8+l2*1.4;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke()}
  /* energy pulses travelling along the lines */
  pl.forEach(function(u){
    var F=u.t*SPEED,dd=u.dist;
    beam(u.cx,u.cy,P[u.src].x,P[u.src].y,u.d0,F);
    for(i=0;i<n;i++)for(j=i+1;j<n;j++){if(!adj[i*n+j])continue;
      var lo=dd[i]<=dd[j]?i:j,hi=lo===i?j:i;if(dd[lo]===Infinity)continue;
      var ex=P[hi].x-P[lo].x,ey=P[hi].y-P[lo].y;beam(P[lo].x,P[lo].y,P[hi].x,P[hi].y,Math.sqrt(ex*ex+ey*ey),F-dd[lo])}
    for(i=0;i<n;i++){var ag=(F-dd[i])/TRAIL;if(ag>=0&&ag<1)G[i]=Math.max(G[i],1-ag)}
  });
  if(pa>0.01){for(i=0;i<n;i++){p=P[i];var ddx=p.x-px,ddy=p.y-py,dd2=Math.sqrt(ddx*ddx+ddy*ddy);if(dd2<R){x.strokeStyle='rgba(190,225,255,'+(1-dd2/R)*.8*pa+')';x.lineWidth=1;x.beginPath();x.moveTo(px,py);x.lineTo(p.x,p.y);x.stroke()}}
    x.globalAlpha=.55*pa;x.drawImage(sp,px-110,py-110,220,220);x.globalAlpha=1}
  for(i=0;i<n;i++){s=N[i];p=P[i];var g=Math.max(G[i],s.lit);
    if(s.big||g>.05){var z=(s.big?34:18)+g*34;x.globalAlpha=Math.min(1,(s.big?.9:.4)+g);x.drawImage(sp,p.x-z/2,p.y-z/2,z,z);x.globalAlpha=1}
    x.fillStyle='rgba(215,235,255,'+(.7+.3*g)+')';x.beginPath();x.arc(p.x,p.y,s.s+(s.big?1:0)+g*1.6,0,6.283);x.fill()}
}
function move(e){var b=sec.getBoundingClientRect();px=e.clientX-b.left;py=e.clientY-b.top;pt=1}
function out(){pt=0}
function click(e){var b=sec.getBoundingClientRect();px=e.clientX-b.left;py=e.clientY-b.top;if(!adj)return;pl.push(makePulse(px,py));if(pl.length>3)pl.shift()}
if(!rm){sec.addEventListener('pointermove',move,{passive:true});sec.addEventListener('pointerdown',click,{passive:true});sec.addEventListener('pointerleave',out);sec.addEventListener('pointercancel',out);sec.addEventListener('pointerup',function(e){if(e.pointerType!=='mouse')out()})}
new ResizeObserver(build).observe(sec);
new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(sec);
if(!rm)(function f(now){requestAnimationFrame(f);if(!vis||document.hidden){last=0;return}
  var dt=last?Math.min(.05,(now-last)/1000):0;last=now;T+=dt;pa+=(pt-pa)*Math.min(1,dt*6);
  pl.forEach(function(u){u.t+=dt});pl=pl.filter(function(u){return u.t*SPEED<u.max+TRAIL+80});
  tickLit(dt);draw()})(performance.now());
})();

/* services: stacked panels. Tabs and the side pill scroll so the chosen panel lands on its stack position. */
(function(){
var stack=document.querySelector('.sk');if(!stack)return;
var ps=[].slice.call(stack.querySelectorAll('.sp')),nav=document.querySelector('.sk-nav'),bs=nav?[].slice.call(nav.querySelectorAll('button')):[],cur=-1,tick=false;
function top(i){return parseFloat(getComputedStyle(ps[i]).top)||0}
function go(i){
  var gap=parseFloat(getComputedStyle(stack).rowGap)||0,y=stack.getBoundingClientRect().top+scrollY,k;
  for(k=0;k<i;k++)y+=ps[k].offsetHeight+gap;
  scrollTo({top:y-top(i)+1,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
}
function upd(){
  tick=false;
  var r=stack.getBoundingClientRect(),idx=0;
  ps.forEach(function(p,i){if(p.getBoundingClientRect().top<=top(i)+24)idx=i});
  if(nav)nav.classList.toggle('show',r.top<innerHeight*.6&&r.bottom>innerHeight*.5);
  if(idx===cur)return;cur=idx;
  bs.forEach(function(b,i){b.classList.toggle('on',i===idx);if(i===idx)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
}
function req(){if(!tick){tick=true;requestAnimationFrame(upd)}}
ps.forEach(function(p,i){p.querySelector('.sp-tab').addEventListener('click',function(){go(i)})});
bs.forEach(function(b,i){b.addEventListener('click',function(){go(i)})});
addEventListener('scroll',req,{passive:true});addEventListener('resize',req);upd();
})();

/* dropdowns: ArrowDown moves from a nav link into its panel, Escape comes back */
[].forEach.call(document.querySelectorAll('.links [data-mm]'),function(a){
  var p=document.getElementById(a.getAttribute('aria-controls'));if(!p)return;
  a.addEventListener('keydown',function(e){if(e.key==='ArrowDown'){e.preventDefault();p.querySelector('a').focus()}});
  p.addEventListener('keydown',function(e){
    var l=[].slice.call(p.querySelectorAll('a')),i=l.indexOf(document.activeElement);
    if(e.key==='Escape'){a.focus()}
    else if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();l[(i+1)%l.length].focus()}
    else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();l[(i-1+l.length)%l.length].focus()}
  });
});



/* Client logos float only in free space: every spot is checked against the real text boxes of the stats section and against the other logos. */
(function(){
var box=document.querySelector('.qa .fl-logos'),sec=box&&box.parentElement;
if(!box||!box.animate||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
var SRC=['pepsico.svg','BBVAProvincial.svg','TopCommuications.png','Montana.png','ISGAM.png','Vseguros.png','ecuador.png','Netuno.jpg','LaFloresta.png'].map(function(f){return'Assets/Costumers/'+f}),
    COUNT=4,PAD=26,DRIFT=14,EDGE=10,info={},bag=[],slots=[],vis=false;
var rg=document.createRange();
/* transparent logos whose artwork is white need the opposite treatment to stay visible */
function isLight(i){
  try{var c=document.createElement('canvas'),x,d,k,n=0,s=0;c.width=48;c.height=24;x=c.getContext('2d');x.drawImage(i,0,0,48,24);d=x.getImageData(0,0,48,24).data;
    if(d[3]>10)return false;
    for(k=0;k<d.length;k+=4)if(d[k+3]>25){n++;s+=d[k]*.299+d[k+1]*.587+d[k+2]*.114}
    return n>0&&s/n>190}catch(e){return false}
}
SRC.forEach(function(u){var i=new Image();i.onload=function(){info[u]={r:i.naturalWidth&&i.naturalHeight?i.naturalWidth/i.naturalHeight:2,lt:isLight(i)}};i.src=u});
new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(sec);
function shuffle(a){for(var i=a.length-1,j,t;i>0;i--){j=Math.floor(Math.random()*(i+1));t=a[i];a[i]=a[j];a[j]=t}return a}
function pick(){
  var shown=slots.map(function(s){return s.rect&&s.u});
  if(!bag.length)bag=shuffle(SRC.filter(function(u){return info[u]&&shown.indexOf(u)<0}));
  return bag.pop();
}
/* text boxes relative to the section; the zoom-reveal transform (scale + shift) of a text block is undone so spots stay valid once the block has finished appearing */
function plain(e){var l=0,t=0,n=e;while(n&&n!==sec){l+=n.offsetLeft;t+=n.offsetTop;n=n.offsetParent}return{l:l,t:t,w:e.offsetWidth,h:e.offsetHeight}}
function blocks(){
  var o=sec.getBoundingClientRect(),r=[],m=[];
  [].forEach.call(sec.querySelectorAll('.w h2,.stats .st b,.stats .st span'),function(t){
    var e=t.closest('.rv'),q,c=e&&m.filter(function(x){return x.e===e})[0];
    if(e&&!c){q=e.getBoundingClientRect();c={e:e,b:{x:q.left-o.left+q.width/2,y:q.top-o.top+q.height/2,w:q.width,h:q.height},p:plain(e)};m.push(c)}
    rg.selectNodeContents(t);
    [].forEach.call(rg.getClientRects(),function(q){
      if(!q.width||!q.height)return;
      var l=q.left-o.left,tp=q.top-o.top,rt=q.right-o.left,bt=q.bottom-o.top;
      if(c&&c.b.w&&c.b.h){
        var kx=c.p.w/c.b.w,ky=c.p.h/c.b.h,cx=c.p.l+c.p.w/2,cy=c.p.t+c.p.h/2;
        l=cx+(l-c.b.x)*kx;rt=cx+(rt-c.b.x)*kx;tp=cy+(tp-c.b.y)*ky;bt=cy+(bt-c.b.y)*ky;
      }
      r.push({l:l-PAD,t:tp-PAD,r:rt+PAD,b:bt+PAD});
    });
  });
  return{w:o.width,h:o.height,r:r};
}
function hit(a,b){return a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t}
/* a free box for the logo (drift included), biggest size first; null when the layout leaves no room */
function spot(u,me){
  var G=blocks(),base=Math.max(72,Math.min(112,G.w*.08)),taken=slots.filter(function(s){return s!==me&&s.rect}).map(function(s){return s.rect}),k,s,mw,mh,w,h,x,y,c,i,ok;
  for(k=0;k<80;k++){
    s=[1,.85,.72,.62][Math.floor(k/20)];mw=base*s;mh=mw*.62;
    if(info[u].r>=mw/mh){w=mw;h=w/info[u].r}else{h=mh;w=h*info[u].r}
    if(G.w-2*EDGE<w||G.h-2*(EDGE+DRIFT)<h)continue;
    x=EDGE+Math.random()*(G.w-w-2*EDGE);y=EDGE+DRIFT+Math.random()*(G.h-h-2*(EDGE+DRIFT));
    c={l:x,t:y-DRIFT,r:x+w,b:y+h+DRIFT};
    ok=!G.r.some(function(b){return hit(c,b)})&&!taken.some(function(t){return hit({l:c.l-PAD,t:c.t-PAD,r:c.r+PAD,b:c.b+PAD},t)});
    if(ok)return{x:x,y:y,w:w,h:h,l:c.l,t:c.t,r:c.r,b:c.b};
  }
  return null;
}
function later(el,ms){el.tm=setTimeout(function(){show(el)},ms)}
function show(el){
  var u=vis&&!document.hidden&&pick(),p=u&&spot(u,el),life;
  if(!p){if(u)bag.push(u);return later(el,u?2000:800)}
  el.u=u;el.rect=p;el.src=u;el.className=info[u].lt?'fl-logo lt':'fl-logo';
  el.style.width=p.w+'px';el.style.height=p.h+'px';el.style.left=p.x+'px';el.style.top=p.y+'px';
  life=7000+Math.random()*3000;
  el.a=el.animate([{opacity:0,transform:'translateY('+DRIFT+'px)'},{opacity:.65,offset:.2},{opacity:.65,offset:.8},{opacity:0,transform:'translateY(-'+DRIFT+'px)'}],{duration:life,easing:'ease-in-out'});
  el.tm=setTimeout(function(){end(el);later(el,600+Math.random()*1600)},life);
}
function end(el){clearTimeout(el.tm);if(el.a)el.a.cancel();el.a=null;el.rect=null;el.style.cssText=''}
for(var n=0;n<COUNT;n++)(function(el){
  el.className='fl-logo';el.alt='';el.decoding='async';box.appendChild(el);slots.push(el);later(el,900+n*1700+Math.random()*900);
})(new Image());
var rt;new ResizeObserver(function(){clearTimeout(rt);rt=setTimeout(function(){slots.forEach(function(el){if(el.rect){end(el);later(el,400)}})},150)}).observe(sec);
})();
