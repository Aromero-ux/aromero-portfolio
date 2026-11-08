/* Carreras: draws the roles and filters from js/site-data.js, then filters, sorts and opens them. Loaded before i18n.js so the new nodes get translated too. */
(function(){
var S=window.MEDIANET_SITE,list=document.getElementById('cr-ls');if(!list||!S)return;
var jobs=S.jobs||[],TX=S.taxonomy,form=document.getElementById('cr-f'),q=document.getElementById('cr-q'),rng=document.getElementById('cr-p'),
    pv=document.getElementById('cr-pv'),sortEl=document.getElementById('cr-sort'),shown=document.getElementById('cr-shown'),total=document.getElementById('cr-total'),empty=document.getElementById('cr-e'),
    top=Math.max.apply(null,jobs.map(function(j){return j.max}).concat(1)),
    PIN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    CHV='<svg class="jb-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function money(n){return'$'+n.toLocaleString('en-US')}
function lis(j,arr,p){return arr.map(function(x,i){return'<li data-i18n="'+j.id+'.'+p+(i+1)+'">'+esc(x)+'</li>'}).join('')}
function row(j){
  var lab=function(f){return esc(TX[f].values[j[f]])},key=function(f){return TX[f].key+'.'+j[f]},d=j.date.split('-'),
      loc=j.lk?'<span data-i18n="'+j.lk+'">'+esc(j.loc)+'</span>':esc(j.loc);
  return'<article class="jb" data-id="'+j.id+'" data-area="'+j.area+'" data-mode="'+j.mode+'" data-type="'+j.type+'" data-min="'+j.min+'" data-max="'+j.max+'" data-date="'+j.date+'">'+
  '<button class="jb-h" type="button" aria-expanded="false" aria-controls="'+j.id+'">'+
    '<span class="jb-t"><b data-i18n="'+j.id+'.t">'+esc(j.t)+'</b><small data-i18n="'+key('area')+'">'+lab('area')+'</small></span>'+
    '<span class="jb-l">'+PIN+loc+'</span>'+
    '<span class="jb-m"><i data-i18n="'+key('mode')+'">'+lab('mode')+'</i></span>'+
    '<span class="jb-ty" data-i18n="'+key('type')+'">'+lab('type')+'</span>'+
    '<span class="jb-p"><b>'+money(j.min)+' – '+money(j.max)+'</b><small data-i18n="cr.pm">USD / mes</small><span class="jb-bar"><i></i></span></span>'+
    '<span class="jb-d"><time datetime="'+j.date+'">'+d[2]+'.'+d[1]+'.'+d[0]+'</time></span>'+CHV+
  '</button>'+
  '<div class="jb-b" id="'+j.id+'" hidden>'+
    '<div><h4 data-i18n="cr.d1">Sobre el rol</h4><p data-i18n="'+j.id+'.p">'+esc(j.p)+'</p><a class="btn sm" href="mailto:info@medianet.com.ve?subject='+encodeURIComponent('Postulación - '+j.t)+'" data-i18n="cr.ap">Postularme ›</a></div>'+
    '<div><h4 data-i18n="cr.d2">Lo que harás</h4><ul>'+lis(j,j.a,'a')+'</ul></div>'+
    '<div><h4 data-i18n="cr.d3">Lo que buscamos</h4><ul>'+lis(j,j.b,'b')+'</ul></div>'+
  '</div></article>';
}
list.innerHTML=jobs.map(row).join('');

/* one checkbox per value that has at least one role, with how many it has */
[].forEach.call(form.querySelectorAll('fieldset[data-f]'),function(fs){
  var f=fs.dataset.f,tx=TX[f];
  Object.keys(tx.values).forEach(function(v){
    var n=jobs.filter(function(j){return j[f]===v}).length;
    if(n)fs.insertAdjacentHTML('beforeend','<label class="ck"><input type="checkbox" name="'+f+'" value="'+v+'"><span data-i18n="'+tx.key+'.'+v+'">'+esc(tx.values[v])+'</span><em>'+n+'</em></label>');
  });
});
rng.max=Math.max(100,Math.ceil(top/100)*100);

var els=[].slice.call(list.querySelectorAll('.jb')),mid=function(j){return(+j.dataset.min+ +j.dataset.max)/2};

/* hero numbers come from the data */
function stat(id,n){var b=document.getElementById(id);if(b){b.dataset.count=n;b.textContent=n}}
var areas={};jobs.forEach(function(j){areas[j.area]=1});
stat('cr-n1',jobs.length);stat('cr-n2',Object.keys(areas).length);stat('cr-n3',jobs.filter(function(j){return j.mode==='rem'}).length);
total.textContent=jobs.length;

/* pay bar: where each range sits between 0 and the highest pay on the page */
els.forEach(function(j){var b=j.querySelector('.jb-bar i');b.style.setProperty('--lo',(+j.dataset.min/top*100)+'%');b.style.setProperty('--w',((+j.dataset.max-+j.dataset.min)/top*100)+'%')});

function picked(name){return[].map.call(form.querySelectorAll('input[name='+name+']:checked'),function(c){return c.value})}
function apply(){
  var a=picked('area'),m=picked('mode'),t=picked('type'),min=+rng.value,txt=q.value.trim().toLowerCase(),n=0;
  pv.textContent=money(min);
  els.forEach(function(j){
    var ok=(!a.length||a.indexOf(j.dataset.area)>-1)&&(!m.length||m.indexOf(j.dataset.mode)>-1)&&(!t.length||t.indexOf(j.dataset.type)>-1)&&+j.dataset.max>=min&&(!txt||j.textContent.toLowerCase().indexOf(txt)>-1);
    j.hidden=!ok;if(ok)n++;
  });
  shown.textContent=n;empty.hidden=n>0;
  document.getElementById('cr-e1').hidden=!jobs.length;document.getElementById('cr-e0').hidden=!!jobs.length;
  document.getElementById('cr-reset').hidden=!jobs.length;
}
function sort(){
  var v=sortEl.value,s=els.slice().sort(function(x,y){return v==='hi'?mid(y)-mid(x):v==='lo'?mid(x)-mid(y):(y.dataset.date>x.dataset.date?1:-1)});
  s.forEach(function(j){list.appendChild(j)});
}
form.addEventListener('input',apply);
form.addEventListener('reset',function(){setTimeout(apply,0)});
form.addEventListener('submit',function(e){e.preventDefault()});
sortEl.addEventListener('change',sort);
document.getElementById('cr-reset').addEventListener('click',function(){form.reset()});

/* open and close each role; carreras.html#j3 opens that role */
function toggle(j,o){var h=j.querySelector('.jb-h');h.setAttribute('aria-expanded',String(o));j.querySelector('.jb-b').hidden=!o;j.classList.toggle('open',o)}
els.forEach(function(j){j.querySelector('.jb-h').addEventListener('click',function(){toggle(j,this.getAttribute('aria-expanded')!=='true')})});
sort();apply();
(function(){var j=location.hash&&list.querySelector('.jb[data-id="'+location.hash.slice(1)+'"]');if(j){toggle(j,true);setTimeout(function(){j.scrollIntoView({block:'center'})},300)}})();
})();
