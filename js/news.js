/* Noticias: portada rotativa (inicio), filtro por categoría (noticias.html) y formulario del boletín. Cada bloque no hace nada si su HTML no está en la página. */
(function(){
var root=document.documentElement;

/* text in the current language, falling back to the Spanish default */
function tr(k,es){
  var l=root.lang,D=window.MEDIANET_LANGS,d;
  if(l==='es'||!D)return es;
  d=D[l]||D.en;
  return (d&&d[k])||(D.en&&D.en[k])||es;
}

/* home: one story at a time. The progress bar of the active headline ends, the next story comes in. */
var f=document.querySelector('[data-nwf]');
if(f){
  var w=f.querySelector('.nwf-w'),st=[].slice.call(w.querySelectorAll('.nwf-s')),bt=[].slice.call(f.querySelectorAll('.nwf-d')),cur=0;
  var go=function(n){
    cur=(n+st.length)%st.length;
    st.forEach(function(el,i){el.classList.toggle('cur',i===cur)});
    bt.forEach(function(b,i){b.classList.toggle('on',i===cur);if(i===cur)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
  };
  w.classList.add('on');go(0);
  bt.forEach(function(b,i){b.onclick=function(){go(i)}});
  f.addEventListener('animationend',function(e){if(e.animationName==='nwp')go(cur+1)});
}

/* the story image fades like film grain: a mask with per-pixel noise that is strongest halfway through the fade, drawn once at the real size and shared by every story */
var ims=[].slice.call(document.querySelectorAll('.nwf-im'));
if(ims.length){
  var sm=function(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)},tm=0,box=ims[0].closest('.nwf')||document.documentElement;
  var grain=function(){
    var K=1,W=ims[0].clientWidth,H=ims[0].clientHeight,w=Math.ceil(W/K),h=Math.ceil(H/K),vert=matchMedia('(max-width:860px)').matches,
        c=document.createElement('canvas'),x=c.getContext('2d'),id,px,i,j,u,v,g,k=0,seed=7,rnd;
    if(!W||!H)return;
    /* seeded, so the grain stays put after a resize */
    rnd=function(){seed=(seed+0x6D2B79F5)|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
    c.width=w;c.height=h;id=x.createImageData(w,h);px=id.data;
    for(j=0;j<h;j++){
      v=(j+.5)/h;
      for(i=0;i<w;i++){
        u=(i+.5)/w;
        g=vert?1-sm((v-.3)/.65):sm(u/.82)*sm((1-u)/.1)*sm(Math.min(v,1-v)/.3);
        g+=(rnd()-.5)*1.05*Math.pow(Math.sin(Math.PI*g),.6);
        px[k+3]=Math.max(0,Math.min(1,g))*255;k+=4;
      }
    }
    x.putImageData(id,0,0);
    box.style.setProperty('--gm','url('+c.toDataURL()+')');
  };
  grain();
  if(window.ResizeObserver)new ResizeObserver(function(){clearTimeout(tm);tm=setTimeout(grain,120)}).observe(ims[0]);
}

/* noticias.html: the hash picks the category (#datos, #web...). The first visible story becomes the big one. */
var g=document.querySelector('[data-nwg]');
if(g){
  var cards=[].slice.call(g.children),tabs=[].slice.call(document.querySelectorAll('[data-nwt]')),
      cats=tabs.map(function(t){return t.dataset.nwt}),num=document.querySelector('[data-nwn]'),c='todas';
  var apply=function(){
    var h=location.hash.slice(1),first=null,n=0;
    if(cats.indexOf(h)>-1)c=h;
    cards.forEach(function(el){
      var ok=c==='todas'||el.dataset.cat==='*'||el.dataset.cat===c;
      el.hidden=!ok;el.classList.remove('big');
      if(ok&&el.dataset.cat!=='*'){n++;if(!first)first=el}
    });
    if(first)first.classList.add('big');
    tabs.forEach(function(t){t.setAttribute('aria-current',String(t.dataset.nwt===c))});
    if(num)num.textContent=n;
  };
  addEventListener('hashchange',apply);apply();
}

/* newsletter. The send goes through window.MEDIANET_SUBMIT (defined in chat.js): connect your provider there, once, for the form and the chat. */
[].forEach.call(document.querySelectorAll('[data-nl]'),function(form){
  var i=form.querySelector('input'),m=form.querySelector('.nl-m');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var ok=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.value.trim());
    i.setAttribute('aria-invalid',String(!ok));
    if(!ok){m.textContent=tr('nl.err','Escribe un correo válido.');return}
    (window.MEDIANET_SUBMIT?window.MEDIANET_SUBMIT('newsletter',{email:i.value.trim(),lang:root.lang}):Promise.resolve()).then(function(){
      m.textContent=tr('nl.ok','¡Gracias! Revisa tu correo para confirmar tu suscripción.');form.reset();
    },function(){m.textContent=tr('ct.err','No se pudo enviar. Inténtalo de nuevo más tarde.')});
  });
});
})();
