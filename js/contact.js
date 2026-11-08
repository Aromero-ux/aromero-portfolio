/* Contact card. One template draws the home-page section ([data-contact]) and the pop-up that every "contact" button opens, so both always match. */
(function(){
var T=[
'<div><h2 data-i18n="ct.h">Construyamos algo que <span style="opacity:.6">dure.</span></h2><p class="lead" data-i18n="ct.lead">Cuéntanos qué necesitas automatizar o lanzar y te respondemos pronto.</p><a class="btn" href="mailto:info@medianet.com.ve" data-i18n="ct.btn">Escríbenos ›</a></div>',
'<div class="info">',
'<div><small data-i18n="ct.mail">Correo</small>info@medianet.com.ve</div>',
'<div><small data-i18n="ct.tel">Teléfonos</small>+58 212 372 77 82<br>+58 212 714 46 41</div>',
'<div><small data-i18n="ct.loc">Sede</small>Los Altos Mirandinos, Venezuela</div>',
'<form class="cf" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">',/* replace YOUR_FORM_ID with your Formspree form ID */
'<div class="cf-r"><label><span data-i18n="ct.name">Nombre</span><input type="text" name="name" required autocomplete="name"></label><label><span data-i18n="ct.email">Correo</span><input type="email" name="email" required autocomplete="email"></label></div>',
'<label><span data-i18n="ct.msg">Mensaje</span><textarea name="message" rows="3" required></textarea></label>',
'<input type="text" name="_gotcha" class="cf-hp" tabindex="-1" autocomplete="off" aria-hidden="true">',
'<div class="cf-f"><button type="submit" class="cf-btn"><span class="cf-s" data-i18n="ct.send">Enviar</span><span class="cf-w" data-i18n="ct.sending" hidden>Enviando…</span></button>',
'<p class="cf-st" role="status" hidden><span data-s="ok" data-i18n="ct.ok" hidden>¡Mensaje enviado! Gracias por escribirnos.</span><span data-s="err" data-i18n="ct.err" hidden>No se pudo enviar. Inténtalo de nuevo más tarde.</span><span data-s="net" data-i18n="ct.net" hidden>Error de red. Revisa tu conexión e inténtalo de nuevo.</span></p></div>',
'<span class="cf-ph" data-i18n="ct.ph" hidden>¿Qué necesitas automatizar?|¿Cuál es tu idea?|¿Cómo podemos ayudar a tu equipo?|Construyamos algo que dure.</span>',
'</form></div>'
].join('');

[].forEach.call(document.querySelectorAll('[data-contact]'),function(n){n.innerHTML=T});

var dlg=document.createElement('div'),home=!!document.getElementById('contacto'),back;
dlg.className='ctm';dlg.setAttribute('role','dialog');dlg.setAttribute('aria-modal','true');dlg.setAttribute('aria-labelledby','ctm-t');
dlg.innerHTML='<div class="ctm-bg" data-close></div><div class="ctm-box end two">'+T+'<button type="button" class="ctm-x" data-close data-i18n-aria="rg.x" aria-label="Cerrar">×</button></div>';
dlg.querySelector('h2').id='ctm-t';
document.body.appendChild(dlg);

function set(o,from){
  dlg.classList.toggle('open',o);
  document.documentElement.style.overflow=o?'hidden':'';
  if(o){back=from||document.activeElement;dlg.querySelector('.ctm-x').focus()}
  else if(back&&back.isConnected&&back.focus)back.focus();
}
window.MEDIANET_CONTACT={open:function(from){set(true,from)},close:function(){set(false)}};

/* every link to #contacto opens the pop-up; on the home page the ones in the top menu still scroll to the section */
document.addEventListener('click',function(e){
  if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  var a=e.target.closest&&e.target.closest('a[href]'),h=a&&a.getAttribute('href');
  if(h!=='#contacto'&&h!=='index.html#contacto')return;
  if(home&&a.closest('header'))return;
  e.preventDefault();set(true,a);
});
dlg.addEventListener('click',function(e){if(e.target.closest('[data-close]'))set(false)});
addEventListener('keydown',function(e){
  if(!dlg.classList.contains('open'))return;
  if(e.key==='Escape'){set(false);return}
  if(e.key!=='Tab')return;
  var f=[].filter.call(dlg.querySelectorAll('a[href],button,input,textarea'),function(x){return !x.disabled&&x.tabIndex>=0&&x.offsetParent!==null}),i=f.indexOf(document.activeElement);
  if(!f.length)return;
  if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}
  else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}
});
})();
