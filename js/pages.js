/* Nosotros and Clientes: photo slots, client wall, testimonials. Every block does nothing when its markup is not on the page. */
(function(){
var rm=matchMedia('(prefers-reduced-motion:reduce)').matches;

/* photo slots: a file that is missing keeps the placeholder underneath, a loaded one hides the hint */
[].forEach.call(document.querySelectorAll('img[data-ph]'),function(i){
  var box=i.closest('[data-phbox]');
  function ok(){if(box)box.classList.add('has')}
  function no(){i.remove()}
  if(i.complete){if(i.naturalWidth)ok();else no()}else{i.addEventListener('load',ok);i.addEventListener('error',no)}
});

/* client wall: until every logo exists (data-fill), the real ones repeat so the full grid can be judged. The copies are hidden from screen readers. */
var wall=document.querySelector('.cw');
if(wall){
  var total=+wall.dataset.fill||0,base=[].slice.call(wall.children),k,c,im;
  for(k=base.length;k<total&&base.length;k++){c=base[k%base.length].cloneNode(true);c.setAttribute('aria-hidden','true');im=c.querySelector('img');if(im)im.alt='';wall.appendChild(c)}
  /* a logo that fails to load shows the client's name instead */
  wall.addEventListener('error',function(e){var i=e.target,s;if(i.tagName!=='IMG')return;s=document.createElement('span');s.className='cn';s.textContent=i.closest('li').dataset.n||'';i.replaceWith(s)},true);
  [].forEach.call(wall.querySelectorAll('img'),function(i){if(i.complete&&!i.naturalWidth)i.dispatchEvent(new Event('error'))});
  /* tiles rise in as their row scrolls into view, a few ms apart */
  if(!rm){
    var io=new IntersectionObserver(function(es){
      var n=0;es.forEach(function(e){if(!e.isIntersecting)return;e.target.style.setProperty('--d',Math.min(n++,10)*45+'ms');e.target.classList.add('in');io.unobserve(e.target)})
    },{rootMargin:'0px 0px -4% 0px'});
    [].forEach.call(wall.children,function(li){io.observe(li)});
  }
}

/* testimonials: the animation of the active dot ends when it is time for the next quote, so hovering (which pauses it) also pauses the autoplay */
var ts=document.querySelector('.ts-s');
if(ts){
  var it=[].slice.call(ts.querySelectorAll('.ts-i')),dots=[].slice.call(ts.querySelectorAll('.ts-d')),cur=0,x0=null;
  var go=function(n){
    cur=(n+it.length)%it.length;
    it.forEach(function(el,j){el.classList.toggle('cur',j===cur);el.classList.toggle('past',j<cur)});
    dots.forEach(function(d,j){d.classList.toggle('on',j===cur);if(j===cur)d.setAttribute('aria-current','true');else d.removeAttribute('aria-current')});
  };
  ts.classList.add('on');go(0);
  ts.querySelector('.ts-p').onclick=function(){go(cur-1)};
  ts.querySelector('.ts-n').onclick=function(){go(cur+1)};
  dots.forEach(function(d,j){d.onclick=function(){go(j)}});
  ts.addEventListener('animationend',function(e){if(e.animationName==='tsp')go(cur+1)});
  ts.addEventListener('pointerdown',function(e){x0=e.clientX});
  ts.addEventListener('pointerup',function(e){if(x0===null)return;var d=e.clientX-x0;x0=null;if(Math.abs(d)>50)go(cur+(d<0?1:-1))});
}
})();
