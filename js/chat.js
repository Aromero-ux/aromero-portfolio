/* Talks to /api/chat (see api/chat.js); override with window.MEDIANET_CHAT_URL. Demo replies when opened from file://. Never put an AI API key in this file.
   The assistant can also act: take the visitor to a page, subscribe them to the newsletter, or guide a job application. The AI only picks the action (api/chat.js);
   the steps that collect personal data run here, in the browser, and are never sent to the AI. */
(function(){
var btn=document.getElementById('chat-btn'),panel=document.getElementById('chat-panel'),log=document.getElementById('chat-log'),
    form=document.getElementById('chat-form'),input=document.getElementById('chat-in'),sug=document.getElementById('chat-sug');
var T={
  es:{demo:'No tengo esa información a la mano. Escríbenos por WhatsApp o a info@medianet.com.ve y te atendemos.',err:'No pude responder en este momento. Inténtalo de nuevo o escríbenos por WhatsApp.'},
  en:{demo:'I don\'t have that information at hand. Message us on WhatsApp or at info@medianet.com.ve and we\'ll help you.',err:'I couldn\'t answer right now. Please try again or message us on WhatsApp.'}
};

/* Offline answers (used when there is no backend, or when it fails). Text comes from the site content only. */
var KB=[
 {id:'quote',k:/cotiz|presupuesto|precio|cuanto cuesta|costo|tarifa|quote|price|pricing|cost/,
  es:'No manejo precios porque dependen de cada proyecto. Cuéntanos qué necesitas automatizar o lanzar y escríbenos a info@medianet.com.ve o por WhatsApp (https://wa.link/5w0zws): te respondemos pronto con una cotización.',
  en:'Prices depend on each project, so I can\'t quote them here. Tell us what you need to automate or launch and write to info@medianet.com.ve or on WhatsApp (https://wa.link/5w0zws): we\'ll get back to you with a quote.'},
 {id:'contact',k:/contact|correo|email|e-mail|mail|telefono|phone|whatsapp|llamar|call|numero|number/,
  es:'Puedes escribirnos a info@medianet.com.ve, llamarnos al +58 212 372 77 82 o +58 212 714 46 41, o usar WhatsApp: https://wa.link/5w0zws.',
  en:'You can email info@medianet.com.ve, call +58 212 372 77 82 or +58 212 714 46 41, or use WhatsApp: https://wa.link/5w0zws.'},
 {id:'location',k:/donde|ubic|direccion|sede|oficina|located|where|address|location|office/,
  es:'Nuestra sede está en Los Altos Mirandinos, Venezuela. Escríbenos a info@medianet.com.ve o por WhatsApp para coordinar.',
  en:'We\'re based in Los Altos Mirandinos, Venezuela. Write to info@medianet.com.ve or on WhatsApp to get in touch.'},
 {id:'ai',k:/inteligencia|\bia\b|\bai\b|chatbot|artificial|automatiz|asistente virtual|automation/,
  es:'Integramos inteligencia artificial en tus procesos: chatbots y asistentes virtuales que atienden a tus clientes 24 horas, automatización de tareas repetitivas y herramientas que aprovechan tus propios datos. Empezamos por un caso concreto, medimos el resultado y lo escalamos.',
  en:'We bring AI into your processes: chatbots and virtual assistants that serve your customers around the clock, automation of repetitive tasks and tools that use your own data. We start with one concrete case, measure the result and scale it.'},
 {id:'mobile',k:/\bapps?\b|movil|\bios\b|android|mobile|celular/,
  es:'Diseñamos y desarrollamos apps para iOS y Android, desde el prototipo hasta su publicación en las tiendas, con diseño UX/UI y soporte para las actualizaciones posteriores.',
  en:'We design and build iOS and Android apps, from prototype to store release, with UX/UI design and support for later updates.'},
 {id:'web',k:/pagina|sitio|\bweb\b|portal|wordpress|website|catalogo|catalog|multilingue|multilingual/,
  es:'Creamos sitios corporativos, catálogos de productos y portales a la medida, rápidos, seguros y listos para varios idiomas. Pueden administrarse con WordPress o desarrollarse desde cero con PHP.',
  en:'We build custom corporate sites, product catalogs and portals that are fast, secure and multilingual. They can be managed with WordPress or built from scratch in PHP.'},
 {id:'cloud',k:/nube|cloud|hosting|\baws\b|google cloud|servidor|server|alojamiento/,
  es:'Alojamos tu sitio o aplicación en servidores optimizados y diseñamos entornos escalables en AWS y Google Cloud. También asesoramos en migración, respaldos, monitoreo y costos.',
  en:'We host your site or app on optimized servers and design scalable environments on AWS and Google Cloud, with advice on migration, backups, monitoring and costs.'},
 {id:'security',k:/seguridad|security|ciber|cyber|respaldo|backup|proteccion|hack/,
  es:'Hacemos auditorías de seguridad, aplicamos buenas prácticas de desarrollo y control de accesos, y armamos planes de respaldo y recuperación para proteger los datos de tu empresa y de tus clientes.',
  en:'We run security audits, apply secure development and access-control practices, and set up backup and recovery plans to protect your company and customer data.'},
 {id:'brand',k:/imagen corporativa|logo|marca|brand|identidad|grafic|disen/,
  es:'Definimos una identidad visual clara y coherente: logotipo, paleta, tipografía y materiales de marca, impresos y digitales.',
  en:'We define a clear, consistent visual identity: logo, palette, typography and brand materials, in print and digital.'},
 {id:'support',k:/soporte|asesor|support|consult|mantenimiento|maintenance|ayuda tecnica/,
  es:'Te acompañamos desde el análisis de tus necesidades hasta la puesta en marcha y después: ofrecemos soporte técnico, mantenimiento y asesoría para elegir soluciones según tu presupuesto.',
  en:'We guide you from analyzing your needs to launch and beyond, with technical support, maintenance and advice to choose solutions that fit your budget.'},
 {id:'custom',k:/medida|escritorio|intranet|integra|desktop|custom|software|sistema|system/,
  es:'Desarrollamos aplicaciones de escritorio, intranets y sistemas de gestión a la medida de tu operación, y conectamos tus sistemas existentes con nuevos módulos usando Java, .NET y PHP.',
  en:'We build custom desktop apps, intranets and management systems, and connect your existing systems with new modules using Java, .NET and PHP.'},
 {id:'tech',k:/tecnolog|technolog|java|\.net|\bphp\b|stack|lenguaje|language/,
  es:'Trabajamos con Java, .NET, PHP, WordPress, iOS, Android, AWS y Google Cloud.',
  en:'We work with Java, .NET, PHP, WordPress, iOS, Android, AWS and Google Cloud.'},
 {id:'clients',k:/cliente|client|customers|proyectos|projects|portafolio|portfolio|referencias|trabajado/,
  es:'Tenemos 154 clientes. Entre ellos, PepsiCo, BBVA Provincial, la Iglesia del Nazareno, Top Communications, ISGAM, Netuno y Vseguros. También desarrollamos proyectos como MetroArchivos, ACADI, IWIN y Shopi.',
  en:'We have 154 clients, including PepsiCo, BBVA Provincial, the Church of the Nazarene, Top Communications, ISGAM, Netuno and Vseguros. We also build projects like MetroArchivos, ACADI, IWIN and Shopi.'},
 {id:'about',k:/quienes|quien son|fundad|historia|experiencia|about|who are|founded|history|years|anos|equipo|team|mision|vision|valores|values/,
  es:'Soluciones Medianet C.A. se fundó en 2005 en Los Altos Mirandinos, Venezuela. Con más de 20 años de experiencia, combinamos diseñadores UX/UI y desarrolladores full-stack para automatizar y mejorar los procesos de nuestros clientes. Nuestros valores: integridad, calidad, responsabilidad, compromiso y trabajo en equipo.',
  en:'Soluciones Medianet C.A. was founded in 2005 in Los Altos Mirandinos, Venezuela. With 20+ years of experience, our UX/UI designers and full-stack developers help clients automate and improve their processes. Our values: integrity, quality, responsibility, commitment and teamwork.'},
 {id:'lang',k:/idioma|language|english|ingles|espanol|spanish/,
  es:'Atendemos en español e inglés, y nuestro sitio está disponible en varios idiomas.',
  en:'We work in Spanish and English, and our site is available in several languages.'},
 {id:'services',k:/servicio|service|ofrec|offer|hacen|hacer|what do you do|capabilities/,
  es:'Ofrecemos: inteligencia artificial (chatbots y automatización), apps móviles iOS/Android, páginas web y portales, desarrollos a la medida (escritorio, intranets, integración), hosting y asesoría en la nube (AWS, Google Cloud), imagen corporativa, soporte y asesoría, y ciberseguridad. ¿Cuál te interesa?',
  en:'We offer: artificial intelligence (chatbots and automation), iOS/Android apps, websites and portals, custom development (desktop, intranets, integration), hosting and cloud consulting (AWS, Google Cloud), corporate image, support and consulting, and cybersecurity. Which one interests you?'},
 {id:'hi',k:/^(hola|buenas|buenos|saludos|hi|hello|hey)\b/,
  es:'¡Hola! Puedo contarte sobre nuestros servicios, clientes, tecnologías o cómo contactarnos. ¿Qué te interesa?',
  en:'Hi! I can tell you about our services, clients, technologies or how to reach us. What are you interested in?'},
 {id:'thanks',k:/gracias|thanks|thank you/,
  es:'¡Con gusto! Si necesitas algo más, aquí estoy.',
  en:'You\'re welcome! Let me know if you need anything else.'}
];
function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function local(text,intent){
  var q=norm(text),l=L(),i;
  if(intent)for(i=0;i<KB.length;i++)if(KB[i].id===intent)return KB[i][l];
  for(i=0;i<KB.length;i++)if(KB[i].k.test(q))return KB[i][l];
  return null;
}
var S=window.MEDIANET_SITE||{pages:{},jobs:null},hist=[],busy=false,flow=null,shown=[],note=document.getElementById('chat-n'),KEY='mn-chat-note',SKEY='mn-chat';
function hideNote(){if(!note)return;note.classList.remove('show');btn.classList.remove('ping');try{sessionStorage.setItem(KEY,'1')}catch(e){}}
function seen(){try{return sessionStorage.getItem(KEY)}catch(e){return null}}
if(note&&!seen()){
  setTimeout(function(){if(panel.classList.contains('open'))return;note.classList.add('show');btn.classList.add('ping');try{sessionStorage.setItem(KEY,'1')}catch(e){}setTimeout(function(){note.classList.remove('show')},15000)},4500);
  note.querySelector('.chatn-b').onclick=function(){open(true)};
  note.querySelector('.chatn-x').onclick=hideNote;
}
function L(){return document.documentElement.lang==='es'?'es':'en'}
function open(o){panel.classList.toggle('open',o);btn.setAttribute('aria-expanded',o);if(o){hideNote();input.focus()}else btn.focus();save()}
btn.onclick=function(){open(!panel.classList.contains('open'))};
document.getElementById('chat-x').onclick=function(){open(false)};
addEventListener('keydown',function(e){if(e.key==='Escape'&&panel.classList.contains('open'))open(false)});

/* only messages without personal data are kept (sessionStorage) so the chat survives a page change */
function add(text,cls,norec){var p=document.createElement('p');p.className='msg '+cls;p.textContent=text;log.appendChild(p);log.scrollTop=log.scrollHeight;if(!norec&&cls.indexOf('typing')<0)shown.push({c:cls,t:text});return p}
/* the open/closed state is saved on every toggle and when the page is left, so the next page opens the chat only if it was open here */
function save(){try{sessionStorage.setItem(SKEY,JSON.stringify({o:panel.classList.contains('open'),m:shown.slice(-30),h:hist.slice(-10)}))}catch(e){}}
addEventListener('pagehide',save);
function restore(){
  var d;try{d=JSON.parse(sessionStorage.getItem(SKEY)||'null')}catch(e){d=null}
  if(!d)return;
  if(d.m&&d.m.length){d.m.forEach(function(m){add(m.t,m.c)});hist=d.h||[];sug.hidden=true}
  if(d.o){panel.classList.add('open');btn.setAttribute('aria-expanded','true');hideNote()}
}

/* ---- strings: i18n.js (ca.* and the menu labels); Spanish here is the fallback ---- */
var DEF={
 'ca.go':'Te llevo a «{x}»…','ca.sub1':'¡Claro! ¿A qué correo quieres que te suscriba a nuestro boletín?','ca.bad':'Ese correo no parece válido. Inténtalo de nuevo o escribe «cancelar».',
 'ca.sub2':'¡Listo! Revisa tu bandeja de entrada para confirmar tu suscripción.','ca.ap1':'Estas son las vacantes abiertas. Elige una para postularte o abre la lista completa:',
 'ca.ap0':'Ahora mismo no puedo cargar la lista de vacantes. Te llevo a la página de carreras.','ca.ap2':'Excelente: {x}. ¿Cómo te llamas (nombre y apellido)?','ca.ap3':'Gracias, {x}. ¿Cuál es tu correo electrónico?',
 'ca.ap4':'¿Quieres agregar algo (experiencia, enlace a tu portafolio o CV)? Escribe «omitir» para continuar.','ca.ap5':'Revisa tu postulación:','ca.lr':'Vacante','ca.ln':'Nombre','ca.le':'Correo','ca.lm':'Nota',
 'ca.send':'Enviar postulación','ca.no':'Cancelar','ca.skip':'Omitir','ca.ok1':'¡Postulación enviada! Nuestro equipo te contactará pronto.',
 'ca.ok2':'Listo: abrí un borrador de correo para nuestro equipo con tus datos. Adjunta tu CV y envíalo.','ca.cx':'De acuerdo, lo dejamos aquí. ¿En qué más te ayudo?','ca.all':'Ver todas las vacantes',
 'cr.none0':'Por ahora no hay vacantes abiertas.','cr.ep':'Guardamos tu perfil y te avisamos cuando abramos una vacante que encaje contigo.','cr.cv':'Enviar mi CV',
 'ca.rolebad':'No logré saber qué vacante quieres. Elige una de la lista de arriba.','ca.err':'No pude completar la acción. Escríbenos a info@medianet.com.ve.',
 'nav.about':'Nosotros','nav.services':'Servicios','nav.clients':'Clientes','nav.news':'Noticias','nav.careers':'Carreras','nav.contact':'Contacto','mm.rb':'Ver vacantes abiertas','mm.sub':'Suscríbete a nuestro boletín','mm.c2':'Países',
 'nc.d':'Datos','nc.w':'Web','nc.i':'Inteligencia artificial','nc.a':'Apps móviles','nc.n':'Nube y hosting','nc.s':'Seguridad'
};
function tr(k,v,es){
  var l=document.documentElement.lang||'es',P=window.MEDIANET_LANGS||{},d=l==='es'?null:(P[l]||P.en),r=d&&d[k]!=null?d[k]:(l!=='es'&&P.en&&P.en[k]!=null?P.en[k]:null);
  if(r==null)r=es!=null?es:(DEF[k]!=null?DEF[k]:k);
  return v?r.replace(/\{(\w+)\}/g,function(m,n){return v[n]!=null?v[n]:m}):r;
}

/* ---- sending: change the endpoint here, once, for the newsletter form and for the chat. kind is "newsletter" or "apply". ---- */
if(!window.MEDIANET_SUBMIT)window.MEDIANET_SUBMIT=function(kind,data){
  var url=window.MEDIANET_FORMS_URL;
  if(!url)return Promise.resolve({demo:true});
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:kind,data:data})}).then(function(r){if(!r.ok)throw new Error(r.status);return{demo:false}});
};

/* ---- where the assistant can take you: the pages in js/site-data.js. The AI only sends their keys, never a URL. ---- */
function go(key,silent){
  var t=S.pages[key];if(!t)return;
  if(!silent)add(tr('ca.go',{x:tr(t.label)}),'bot');
  save();
  setTimeout(function(){
    if(key==='contact'&&window.MEDIANET_CONTACT){window.MEDIANET_CONTACT.open();return}
    var page=t.url.split('#')[0],hash=t.url.split('#')[1]||'',here=location.pathname.split('/').pop()||'index.html',a;
    if(here!==page){location.href=t.url;return}
    if(hash){a=document.createElement('a');a.href='#'+hash;a.hidden=true;document.body.appendChild(a);a.click();a.remove()}
    else scrollTo({top:0,behavior:'smooth'});
    if(t.parent)setTimeout(function(){var g=document.querySelector('[data-nwg]');if(g)g.scrollIntoView({behavior:'smooth'})},60);
  },700);
}

/* ---- what the visitor means, in the words of a few languages (the AI covers the rest) ---- */
var RX={
 sub:/suscri|subscri|newsletter|boletin|boletim|abonn|iscri|anmeld|订阅|訂閱|購読|구독|рассылк|подпиш|inscrev/,
 job:/vacante|empleo|postul|contratac|contratando|unirme|quiero trabajar|busco trabajo|trabajar (con|en|para)|carreras|career|\bjobs?\b|hiring|apply|openings?|work (with|for) you|join (the |your |our )?team|recruit|emprego|\bvagas?\b|candidat|karriere|stellen|bewerb|emploi|recrut|lavora con|assunzion|招聘|求职|应聘|應徵|徵才|採用|応募|求人|채용|지원하|вакан/
};
var NAVV=/llev|ir a |ve a |vamos a|muestr|abre|abrir|ensen|take me|go to|show me|open |bring me|navigat|visit|quiero ver|ver (las|los|la|el) |leva |mostr|emmen|montre|ouvr|zeig|offn|portami|apri|带我|打开|前往|帶我|打開|連れて|開いて|열어|보여|이동|покаж|открой|перейд/;
var CANCEL=/^(cancelar|cancel|salir|exit|stop|annuler|abbrechen|annulla|取消|キャンセル|취소|отмена)$/,
    SKIP=/^(omitir|saltar|skip|no|nada|ninguno|ninguna|pular|passer|passe|uberspringen|salta|跳过|跳過|略過|スキップ|건너뛰기|пропустить)$/,
    YES=/^(si|yes|ok|okay|enviar|envia|send|confirmar|confirm|claro|sim|oui|ja|certo|senden|envoyer|invia|是|好|はい|네|да|отправить)$/,
    EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,RE={};
function re(src){return RE[src]||(RE[src]=new RegExp(src))}
/* a page from the visitor's words: each page's kw in site-data.js; a sub-page (news category) only together with its parent */
function pageOf(q){
  var P=S.pages,verb=NAVV.test(q),top=null,kid=null;
  Object.keys(P).forEach(function(k){var p=P[k];if(!top&&!p.parent&&p.kw&&re(p.kw).test(q)&&(p.free||verb))top=k});
  if(!top)return null;
  Object.keys(P).forEach(function(k){var p=P[k];if(!kid&&p.parent===top&&p.kw&&re(p.kw).test(q))kid=k});
  return kid||top;
}
function intentOf(text,intent){
  if(intent==='subscribe')return{t:'sub'};
  if(intent==='apply')return{t:'apply'};
  if(intent&&intent.indexOf('go:')===0)return{t:'go',v:intent.slice(3)};
  var q=norm(text),pg;
  if(RX.sub.test(q))return{t:'sub'};
  if(RX.job.test(q))return NAVV.test(q)&&/pagina|page|seccion|section|carreras|careers/.test(q)?{t:'go',v:'careers'}:{t:'apply'};
  pg=pageOf(q);
  return pg?{t:'go',v:pg}:null;
}

/* ---- a message from the assistant, with optional choice buttons ---- */
function say(text,chips,cls){
  var m=add(text,'bot'+(cls?' '+cls:''),!!(flow&&flow.d&&flow.d.name)),c;
  if(chips&&chips.length){
    c=document.createElement('div');c.className='ch-c';
    chips.forEach(function(x){var b=document.createElement('button');b.type='button';b.textContent=x.l;if(x.p)b.className='pri';b.onclick=function(){c.remove();add(x.l,'user',true);x.f()};c.appendChild(b)});
    log.appendChild(c);log.scrollTop=log.scrollHeight;
  }
  return m;
}
function cancel(){flow=null;say(tr('ca.cx'))}
function fail(){say(tr('ca.err'))}
function lang(){return document.documentElement.lang||'es'}

/* ---- job application: the roles are the ones in js/site-data.js, the same list the careers page draws ---- */
var roles=null;
function rt(r){return tr(r.k,null,r.es)}
function findRole(q){
  var best=null,top=0,w=q.split(/[^a-z0-9\u00c0-\uffff]+/).filter(function(x){return x.length>2});
  roles.forEach(function(r){var t=norm(rt(r)+' '+r.es),n=w.filter(function(x){return t.indexOf(x)>-1}).length;if(n>top){top=n;best=r}});
  return best;
}
function cvMail(){location.href='mailto:info@medianet.com.ve?subject='+encodeURIComponent('Postulación espontánea')}
function apply(pre){
  var rs=roles=S.jobs&&S.jobs.map(function(j){return{id:j.id,es:j.t,k:j.id+'.t'}});
  if(!rs){say(tr('ca.ap0'));go('careers',true);return}
  if(!rs.length){say(tr('cr.none0')+' '+tr('cr.ep'),[{l:tr('cr.cv'),p:1,f:cvMail}]);return}
  flow={k:'apply',step:'role',d:{}};
  var r=pre&&rs.filter(function(x){return x.id===pre})[0];
  if(r){pick(r);return}
  say(tr('ca.ap1'),rs.map(function(x){return{l:rt(x),f:function(){pick(x)}}}).concat([{l:tr('ca.all'),f:function(){flow=null;go('roles')}}]));
}
function pick(r){flow.d.role=r;flow.step='name';say(tr('ca.ap2',{x:rt(r)}))}
function review(){
  var d=flow.d;flow.step='confirm';
  say(tr('ca.ap5')+'\n'+tr('ca.lr')+': '+rt(d.role)+'\n'+tr('ca.ln')+': '+d.name+'\n'+tr('ca.le')+': '+d.email+(d.note?'\n'+tr('ca.lm')+': '+d.note:''),[{l:tr('ca.send'),p:1,f:sendApp},{l:tr('ca.no'),f:cancel}],'sum');
}
/* with no backend configured the application leaves as an email draft to the team, so nothing is lost */
function sendApp(){
  var d=flow.d,lines=['Vacante: '+d.role.es,'Nombre: '+d.name,'Correo: '+d.email];
  flow=null;if(d.note)lines.push('Nota: '+d.note);
  window.MEDIANET_SUBMIT('apply',{role:d.role.id,roleTitle:d.role.es,name:d.name,email:d.email,note:d.note,lang:lang()}).then(function(res){
    if(res&&res.demo){location.href='mailto:info@medianet.com.ve?subject='+encodeURIComponent('Postulación - '+d.role.es)+'&body='+encodeURIComponent(lines.concat(['','(Adjunta tu CV)']).join('\n'));say(tr('ca.ok2'))}
    else say(tr('ca.ok1'));
  },fail);
}

/* ---- one answer while a flow is running: never goes to the AI ---- */
function step(text){
  var v=text.trim(),q=norm(v),f=flow,d=f.d;
  if(f.k==='sub'){
    if(!EMAIL.test(v)){say(tr('ca.bad'));return}
    flow=null;window.MEDIANET_SUBMIT('newsletter',{email:v,lang:lang()}).then(function(){say(tr('ca.sub2'))},fail);return;
  }
  if(f.step==='role'){var r=/^\d+$/.test(q)?roles[+q-1]:findRole(q);if(r)pick(r);else say(tr('ca.rolebad'));return}
  if(f.step==='name'){
    if(v.length<2){say(tr('ca.ap2',{x:rt(d.role)}));return}
    d.name=v.slice(0,80);f.step='email';say(tr('ca.ap3',{x:d.name.split(' ')[0]}));return;
  }
  if(f.step==='email'){
    if(!EMAIL.test(v)){say(tr('ca.bad'));return}
    d.email=v;f.step='note';say(tr('ca.ap4'),[{l:tr('ca.skip'),f:function(){d.note='';review()}}]);return;
  }
  if(f.step==='note'){d.note=SKIP.test(q)?'':v.slice(0,300);review();return}
  if(YES.test(q))sendApp();else review();
}

function run(a){
  if(a.t==='go'){go(a.v);return}
  if(a.t==='sub'){flow={k:'sub'};say(tr('ca.sub1'),[{l:tr('ca.no'),f:cancel}]);return}
  apply(a.role);
}
/* the AI's pick, checked again here: only known keys and known role ids get through */
function doAction(a){
  if(!a)return;
  if(a.type==='navigate'&&S.pages[a.target])go(a.target,true);
  else if(a.type==='subscribe'){flow={k:'sub'};say(tr('ca.sub1'),[{l:tr('ca.no'),f:cancel}])}
  else if(a.type==='apply')apply(a.role);
}

function reply(msgs,intent){
  var url=window.MEDIANET_CHAT_URL||(location.protocol==='file:'?'':'/api/chat');
  if(!url)return new Promise(function(r){setTimeout(function(){r({reply:local(msgs[msgs.length-1].content,intent)||T[L()].demo})},700)});
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang:document.documentElement.lang||'es',messages:msgs.slice(-10)})})
    .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
    .then(function(d){return{reply:d.reply,action:d.action}});
}

function send(text,intent){
  text=text.trim();if(!text||busy)return;
  sug.hidden=true;[].forEach.call(log.querySelectorAll('.ch-c'),function(c){c.remove()});
  add(text,'user',!!flow);
  if(flow){if(CANCEL.test(norm(text)))cancel();else step(text);return}
  var a=intentOf(text,intent);
  if(a){run(a);save();return}
  busy=true;hist.push({role:'user',content:text});
  var typing=add('','bot typing');typing.innerHTML='<i></i><i></i><i></i>';
  reply(hist,intent).then(function(d){hist.push({role:'assistant',content:d.reply});return d},function(){return{reply:local(text,intent)||T[L()].err}})
    .then(function(d){typing.remove();add(d.reply,'bot');busy=false;doAction(d.action);save()});
}

form.onsubmit=function(e){e.preventDefault();var v=input.value;input.value='';send(v)};
[].forEach.call(sug.querySelectorAll('button'),function(b){b.onclick=function(){send(b.textContent,b.dataset.intent)}});
restore();
})();
