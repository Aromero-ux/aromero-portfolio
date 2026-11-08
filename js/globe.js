/* Clientes: interactive globe. Countries and clients come from the logo wall (.cw li[data-c]); the map is js/world.js (Natural Earth 110m via world-atlas). */
(function(){
var cv=document.getElementById('gb-cv');if(!cv)return;
var root=document.documentElement,rm=matchMedia('(prefers-reduced-motion:reduce)').matches,K=Math.PI/180,ctx=cv.getContext('2d'),
tip=document.getElementById('gb-tip'),chEl=document.getElementById('gb-ch'),nmEl=document.getElementById('gb-nm'),nEl=document.getElementById('gb-n'),lsEl=document.getElementById('gb-ls');

/* ISO code -> [numeric id in the map, lon, lat of the capital]. A client in a country that is not listed here is ignored. */
var A={VE:[862,-66.9,10.5],PA:[591,-79.5,9],EC:[218,-78.5,-1.3],US:[840,-98,39],CO:[170,-74.1,4.7],ES:[724,-3.7,40.4],MX:[484,-99.1,19.4],PE:[604,-77,-12],CL:[152,-70.7,-33.4],AR:[32,-58.4,-34.6],BR:[76,-47.9,-15.8],DO:[214,-70.2,18.9],CR:[188,-84,9.9],GT:[320,-90.5,14.6],GB:[826,-1,52],DE:[276,13.4,52.5]};

var G={};
[].forEach.call(document.querySelectorAll('.cw li[data-c]:not([aria-hidden])'),function(li){
  var c=li.dataset.c,im=li.querySelector('img');if(!A[c])return;
  (G[c]=G[c]||[]).push({n:li.dataset.n||'',s:im?im.getAttribute('src'):'',k:im?im.className:''});
});
var codes=Object.keys(G).sort(function(a,b){return G[b].length-G[a].length});
if(!codes.length)return;
var cn=document.getElementById('cx-cn');if(cn){cn.dataset.count=codes.length;cn.textContent=codes.length}

var L0=A.VE[1]*K,P0=A.VE[2]*K*.8,W=0,R=0,cx=0,cy=0,sP=0,cP=0,sel=null,hov=null,F=[],byId={},drag=false,mv=0,px=0,py=0,vL=0,vP=0,tw=null,dirty=true,vis=false,raf=0,last=0,rest=0,SPIN=.1,o={x:0,y:0,c:0},bx=new Float32Array(8192),by=new Float32Array(8192),bc=new Float32Array(8192);

function dn(){try{var d=new Intl.DisplayNames([root.lang||'es'],{type:'region'});return function(c){return d.of(c)||c}}catch(e){return function(c){return c}}}
function wrap(d){return Math.atan2(Math.sin(d),Math.cos(d))}
function clampP(p){return Math.max(-1.25,Math.min(1.25,p))}

/* TopoJSON -> rings of [lon,lat]. Arcs are delta-encoded and quantised. */
function decode(t){
  var s=t.transform.scale,tr=t.transform.translate,arcs=t.arcs.map(function(a){var x=0,y=0;return a.map(function(p){x+=p[0];y+=p[1];return[x*s[0]+tr[0],y*s[1]+tr[1]]})});
  function ring(idx){var out=[];idx.forEach(function(i){var a=i<0?arcs[~i].slice().reverse():arcs[i];out.push.apply(out,out.length?a.slice(1):a)});return out}
  return t.objects.countries.geometries.filter(function(g){return +g.id!==10}).map(function(g){
    var polys=(g.type==='Polygon'?[g.arcs]:g.arcs).map(function(p){var r=p.map(ring),x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;r[0].forEach(function(q){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1])});return{r:r,b:[x0,y0,x1,y1]}});
    return{id:+g.id,p:polys};
  });
}

/* orthographic projection around (L0,P0); o.c > 0 means the point faces the viewer, otherwise it is pushed onto the horizon */
function pr(lon,lat){
  var l=lon*K-L0,p=lat*K,cp=Math.cos(p),sp=Math.sin(p),cl=Math.cos(l),x=cp*Math.sin(l),y=cP*sp-sP*cp*cl,c=sP*sp+cP*cp*cl,n;
  if(c<0){n=Math.hypot(x,y)||1;x/=n;y/=n}
  o.x=cx+R*x;o.y=cy-R*y;o.c=c;
}
function trace(f){
  var started=false;
  function emit(x,y){if(started)ctx.lineTo(x,y);else{ctx.moveTo(x,y);started=true}}
  function arc(a,b){var d=wrap(b-a),m=Math.max(1,Math.ceil(Math.abs(d)/.1)),j,t;for(j=1;j<=m;j++){t=a+d*j/m;emit(cx+R*Math.cos(t),cy+R*Math.sin(t))}}
  ctx.beginPath();
  f.p.forEach(function(poly){poly.r.forEach(function(r){
    var n=Math.min(r.length,bx.length),i,k,s=-1,hid=false,a0=0,aN=0;
    for(i=0;i<n;i++){pr(r[i][0],r[i][1]);bx[i]=o.x;by[i]=o.y;bc[i]=o.c;if(s<0&&o.c>0)s=i}
    if(s<0)return;
    started=false;
    for(k=0;k<n;k++){
      i=(s+k)%n;
      if(bc[i]>0){if(hid){arc(a0,aN);hid=false}emit(bx[i],by[i])}
      else{aN=Math.atan2(by[i]-cy,bx[i]-cx);if(!hid){hid=true;a0=aN;emit(bx[i],by[i])}}
    }
    if(hid)arc(a0,aN);
    ctx.closePath();
  })});
}

function draw(){
  var i,j,g,c,f,fill;
  sP=Math.sin(P0);cP=Math.cos(P0);
  ctx.clearRect(0,0,W,W);
  g=ctx.createRadialGradient(cx-R*.38,cy-R*.42,R*.05,cx,cy,R);g.addColorStop(0,'#1a6fe0');g.addColorStop(.5,'#0b3c96');g.addColorStop(1,'#031645');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R,0,6.2832);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,6.2832);ctx.clip();
  /* graticule */
  ctx.strokeStyle='rgba(170,210,255,.14)';ctx.lineWidth=1;ctx.beginPath();
  for(i=-180;i<180;i+=30){for(j=-80,c=false;j<=80;j+=5){pr(i,j);if(o.c>0){if(c)ctx.lineTo(o.x,o.y);else ctx.moveTo(o.x,o.y);c=true}else c=false}}
  for(j=-60;j<=60;j+=30){for(i=-180,c=false;i<=180;i+=5){pr(i,j);if(o.c>0){if(c)ctx.lineTo(o.x,o.y);else ctx.moveTo(o.x,o.y);c=true}else c=false}}
  ctx.stroke();
  /* land: client countries brighter, the selected one lit */
  ctx.lineJoin='round';
  F.forEach(function(f){
    var code=f.code,on=!!code;
    trace(f);
    if(code&&code===sel){ctx.fillStyle='#c4e2ff';ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.shadowColor='rgba(150,210,255,.9)';ctx.shadowBlur=16}
    else if(on){ctx.fillStyle=code===hov?'rgba(130,195,255,.85)':'rgba(95,170,255,.6)';ctx.strokeStyle='rgba(215,235,255,.8)';ctx.lineWidth=1}
    else{ctx.fillStyle='rgba(185,215,255,.15)';ctx.strokeStyle='rgba(185,215,255,.3)';ctx.lineWidth=.7}
    ctx.fill('evenodd');ctx.stroke();ctx.shadowBlur=0;
  });
  ctx.restore();
  /* limb light */
  g=ctx.createRadialGradient(cx,cy,R*.72,cx,cy,R);g.addColorStop(0,'rgba(2,10,34,0)');g.addColorStop(1,'rgba(2,10,34,.5)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R,0,6.2832);ctx.fill();
  ctx.strokeStyle='rgba(170,215,255,.45)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(cx,cy,R,0,6.2832);ctx.stroke();
}

function frame(t){
  raf=0;if(!vis){last=0;return}
  var dt=last?Math.min(.05,(t-last)/1000):0;last=t;
  if(tw){
    var dL=wrap(tw.L-L0),dP=tw.P-P0;
    if(Math.abs(dL)<.0008&&Math.abs(dP)<.0008){L0=tw.L;P0=tw.P;tw=null}else{L0+=dL*.1;P0+=dP*.1}
    dirty=true;
  }else if(!drag&&(vL||vP)){
    L0+=vL;P0=clampP(P0+vP);vL*=.94;vP*=.94;if(Math.abs(vL)<1e-5&&Math.abs(vP)<1e-5)vL=vP=0;dirty=true;
  }else if(!rm&&!drag&&!hov&&t>rest){L0-=SPIN*dt;dirty=true}
  if(!rm||dirty){draw();dirty=false}
  if(!rm||tw||vL||vP)kick();
}
function kick(){dirty=true;if(!raf&&vis)raf=requestAnimationFrame(frame)}

function size(){var b=cv.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);W=b.width;if(!W)return;cv.width=cv.height=Math.round(W*d);ctx.setTransform(d,0,0,d,0,0);R=W*.45;cx=cy=W/2;kick()}

/* screen point -> country code (only countries with clients can be hit); a marker has a generous hit area */
function hit(e){
  var b=cv.getBoundingClientRect(),X=e.clientX-b.left,Y=e.clientY-b.top,i,k,x,y,r,c,lat,lon,found=null;
  sP=Math.sin(P0);cP=Math.cos(P0);
  for(i=0;i<codes.length;i++){pr(A[codes[i]][1],A[codes[i]][2]);if(o.c>.1&&Math.hypot(o.x-X,o.y-Y)<16)return codes[i]}
  x=(X-cx)/R;y=-(Y-cy)/R;r=Math.hypot(x,y);if(r>1)return null;
  c=Math.asin(r);
  lat=r?Math.asin(Math.cos(c)*sP+y*Math.sin(c)*cP/r):P0;
  lon=(L0+(r?Math.atan2(x*Math.sin(c),r*cP*Math.cos(c)-y*sP*Math.sin(c)):0))/K;lon=((lon+540)%360)-180;lat/=K;
  codes.some(function(k){var f=byId[A[k][0]];return f&&f.p.some(function(p){
    var bb=p.b,r=p.r[0],n=r.length,j,l,ins=false;
    if(lon<bb[0]||lon>bb[2]||lat<bb[1]||lat>bb[3])return false;
    for(j=0,l=n-1;j<n;l=j++)if((r[j][1]>lat)!==(r[l][1]>lat)&&lon<(r[l][0]-r[j][0])*(lat-r[j][1])/(r[l][1]-r[j][1])+r[j][0])ins=!ins;
    if(ins)found=k;return ins})});
  return found;
}

function fly(k){
  var a=A[k];tw={L:a[1]*K,P:clampP(a[2]*K*.8)};rest=performance.now()+3500;
  if(rm){L0=tw.L;P0=tw.P;tw=null}
  vL=vP=0;kick();
}
function tile(it){
  var s=document.createElement('span'),im;s.className='gb-lg';
  if(it.s){im=document.createElement('img');im.src=it.s;im.alt='';im.loading='lazy';if(it.k)im.className=it.k;im.onerror=function(){s.textContent=it.n.charAt(0);im.remove()};s.appendChild(im)}
  else s.textContent=it.n.charAt(0);
  return s;
}
function render(){
  var N=dn(),i;
  chEl.textContent='';
  codes.forEach(function(k){
    var li=document.createElement('li'),b=document.createElement('button'),c=document.createElement('i');
    b.type='button';c.textContent=k;b.appendChild(c);b.appendChild(document.createTextNode(N(k)+' · '+G[k].length));
    b.setAttribute('aria-pressed',k===sel);b.onclick=function(){select(k,true)};
    li.appendChild(b);chEl.appendChild(li);
  });
  nmEl.textContent=N(sel);nEl.textContent=G[sel].length;
  lsEl.textContent='';
  G[sel].forEach(function(it,j){
    var li=document.createElement('li'),t=document.createElement('span');
    li.style.setProperty('--d',Math.min(j,12)*40+'ms');t.textContent=it.n;
    li.appendChild(tile(it));li.appendChild(t);lsEl.appendChild(li);
  });
  lsEl.scrollTop=0;
}
function select(k,go){sel=k;render();if(go)fly(k);else kick()}

cv.addEventListener('pointerdown',function(e){drag=true;mv=0;px=e.clientX;py=e.clientY;vL=vP=0;tw=null;try{cv.setPointerCapture(e.pointerId)}catch(x){}tip.hidden=true});
cv.addEventListener('pointermove',function(e){
  var h;
  if(drag){
    var dx=e.clientX-px,dy=e.clientY-py;px=e.clientX;py=e.clientY;mv+=Math.abs(dx)+Math.abs(dy);
    vL=-dx/R;vP=dy/R;L0+=vL;P0=clampP(P0+vP);kick();return;
  }
  h=hit(e);
  if(h!==hov){hov=h;cv.classList.toggle('hv',!!h);kick()}
  if(h){var s=cv.parentNode.getBoundingClientRect();tip.textContent=dn()(h);tip.style.left=e.clientX-s.left+'px';tip.style.top=e.clientY-s.top+'px';tip.hidden=false}else tip.hidden=true;
});
cv.addEventListener('pointerup',function(e){
  if(!drag)return;drag=false;rest=performance.now()+3500;
  if(mv<5){vL=vP=0;var h=hit(e);if(h)select(h,true)}else kick();
});
cv.addEventListener('pointercancel',function(){drag=false;kick()});
cv.addEventListener('pointerleave',function(){if(drag)return;hov=null;tip.hidden=true;cv.classList.remove('hv');kick()});
cv.addEventListener('keydown',function(e){
  var d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];if(!d)return;
  e.preventDefault();tw=null;rest=performance.now()+3500;L0+=d[0]*.12;P0=clampP(P0+d[1]*.12);kick();
});

new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)kick()},{rootMargin:'120px'}).observe(cv);
new ResizeObserver(size).observe(cv);
new MutationObserver(function(){render();kick()}).observe(root,{attributes:true,attributeFilter:['lang']});

select(codes.indexOf('VE')>-1?'VE':codes[0],false);
size();

/* map data is a script (js/world.js), not a fetch, so it also works when the page is opened from disk */
if(window.MEDIANET_WORLD){
  F=decode(window.MEDIANET_WORLD);
  F.forEach(function(f){byId[f.id]=f});
  codes.forEach(function(k){if(byId[A[k][0]])byId[A[k][0]].code=k});
  /* draw client countries last so their outlines stay on top */
  F.sort(function(a,b){return(a.code?1:0)-(b.code?1:0)});
  kick();
}
})();
