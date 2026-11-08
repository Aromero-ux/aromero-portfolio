/* The one place for what the careers page, the chat (js/chat.js) and the AI backend (api/chat.js) all need to know.
   It is plain data and runs both in the browser (window.MEDIANET_SITE) and in Node (require), so none of them keeps its own copy.

   PAGES  key -> where the assistant can take a visitor. url and label (an i18n.js key) are required.
          kw  (optional) words, as a regex source, that make the offline assistant pick this page; free:true = no "take me to" verb needed.
          parent (optional) makes it a sub-page that is only picked together with its parent (news categories).
          desc is read by the AI.
   JOBS   one object per open role. To open a role: add an object. To close it: delete it. Nothing else to touch.
          Text is Spanish; translations are optional and live in i18n.js under <id>.t, <id>.p, <id>.a1.., <id>.b1.. (Spanish shows if missing).
          area, mode and type must exist in TAXONOMY. Pay is USD per month. These roles and pay are EXAMPLES. */
(function(root,make){
  var d=make();
  if(typeof module==='object'&&module.exports)module.exports=d;else root.MEDIANET_SITE=d;
})(typeof window!=='undefined'?window:this,function(){
return {
pages:{
  about:{url:'nosotros.html',label:'nav.about',kw:'nosotros|about|mision|vision|valores|values|equipo|team|quienes',desc:'About us: mission, vision, commitment to Venezuela, values'},
  services:{url:'index.html#servicios',label:'nav.services',kw:'servicio|service',desc:'Services section of the home page (the 8 services)'},
  clients:{url:'clientes.html',label:'nav.clients',kw:'cliente|client',desc:'Clients: logos, featured projects and testimonials'},
  countries:{url:'clientes.html#mundo',label:'mm.c2',kw:'pais|countr|globo|globe|mapa|\\bmap\\b',desc:'Interactive globe with the countries where clients are'},
  news:{url:'noticias.html',label:'nav.news',free:true,kw:'noticia|novedad|\\bblog\\b|\\bnews\\b|articulo|article|notizie|nachricht|actualite|notici|新闻|新聞|ニュース|뉴스|новост',desc:'News page: articles and category tabs'},
  'news:datos':{parent:'news',url:'noticias.html#datos',label:'nc.d',kw:'\\bdatos\\b|\\bdata\\b',desc:'News filtered by Data'},
  'news:web':{parent:'news',url:'noticias.html#web',label:'nc.w',kw:'\\bweb\\b|sitio|website',desc:'News filtered by Web'},
  'news:ia':{parent:'news',url:'noticias.html#ia',label:'nc.i',kw:'\\b(ia|ai)\\b|inteligencia|artificial|chatbot',desc:'News filtered by Artificial intelligence'},
  'news:apps':{parent:'news',url:'noticias.html#apps',label:'nc.a',kw:'\\bapps?\\b|movil|mobile|android|\\bios\\b',desc:'News filtered by Mobile apps'},
  'news:nube':{parent:'news',url:'noticias.html#nube',label:'nc.n',kw:'nube|cloud|hosting',desc:'News filtered by Cloud and hosting'},
  'news:seguridad':{parent:'news',url:'noticias.html#seguridad',label:'nc.s',kw:'seguridad|security|ciber|cyber',desc:'News filtered by Security'},
  newsletter:{url:'noticias.html#boletin',label:'mm.sub',desc:'Newsletter sign-up block (monthly: news, ideas and cases to automate a business; no spam)'},
  careers:{url:'carreras.html',label:'nav.careers',desc:'Careers page: why Medianet, how applying works, open roles'},
  roles:{url:'carreras.html#vacantes',label:'mm.rb',desc:'Open roles dashboard with filters for area, work mode, type and pay'},
  contact:{url:'index.html#contacto',label:'nav.contact',kw:'contact',desc:'Contact card with email, phones and a message form (opens as a pop-up)'}
},
taxonomy:{
  area:{key:'cr.ar',values:{dev:'Desarrollo',dis:'Diseño',sop:'Soporte',inf:'Infraestructura',ven:'Ventas'}},
  mode:{key:'cr.md',values:{rem:'Remoto',hib:'Híbrido',pre:'Presencial'}},
  type:{key:'cr.ty',values:{ft:'Tiempo completo',pt:'Medio tiempo',int:'Pasantía'}}
},
jobs:[
 {id:'j1',area:'dev',mode:'hib',type:'ft',loc:'Los Altos Mirandinos',min:1100,max:1600,date:'2026-10-30',
  t:'Desarrollador/a Full-Stack',
  p:'Construirás y mantendrás sistemas a la medida para empresas de Venezuela y la región, junto a diseño y soporte.',
  a:['Desarrollar módulos web con PHP y JavaScript','Integrar sistemas existentes y APIs','Revisar código y documentar'],
  b:['3+ años de experiencia','PHP, JavaScript y SQL','Ganas de aprender y trabajar en equipo']},
 {id:'j2',area:'dev',mode:'rem',type:'ft',loc:'Remoto · Venezuela',lk:'cr.loc.rem',min:1200,max:1800,date:'2026-10-27',
  t:'Desarrollador/a de apps móviles',
  p:'Diseñarás y publicarás apps para iOS y Android, del prototipo a las tiendas.',
  a:['Desarrollar y mantener apps móviles','Conectar las apps con servicios y bases de datos','Publicar y dar seguimiento en las tiendas'],
  b:['2+ años en apps móviles','Swift/Kotlin o frameworks multiplataforma','Cuidado por la experiencia de uso']},
 {id:'j3',area:'dis',mode:'hib',type:'ft',loc:'Caracas',min:800,max:1200,date:'2026-10-22',
  t:'Diseñador/a UX/UI',
  p:'Llevarás ideas a interfaces claras y atractivas para web y apps, trabajando de cerca con desarrollo.',
  a:['Investigar, prototipar y diseñar interfaces','Mantener sistemas de diseño','Acompañar la implementación'],
  b:['Portafolio con proyectos reales','Figma y prototipado','Sensibilidad por la accesibilidad']},
 {id:'j4',area:'dis',mode:'pre',type:'pt',loc:'Los Altos Mirandinos',min:450,max:700,date:'2026-10-18',
  t:'Diseñador/a gráfico/a',
  p:'Crearás identidades visuales y materiales de marca, impresos y digitales, para nuestros clientes.',
  a:['Diseñar logotipos, paletas y piezas de marca','Preparar archivos para impresión y web','Presentar propuestas a clientes'],
  b:['Dominio de herramientas de diseño','Criterio tipográfico y de color','Disponibilidad medio tiempo']},
 {id:'j5',area:'sop',mode:'pre',type:'ft',loc:'Los Altos Mirandinos',min:500,max:750,date:'2026-10-15',
  t:'Especialista de soporte técnico',
  p:'Serás el primer contacto de nuestros clientes ante cualquier duda o incidencia.',
  a:['Atender solicitudes por correo, teléfono y chat','Resolver incidencias y escalar cuando haga falta','Documentar soluciones'],
  b:['Buena comunicación escrita y oral','Conocimientos básicos de redes y sistemas','Vocación de servicio']},
 {id:'j6',area:'inf',mode:'rem',type:'ft',loc:'Remoto · Venezuela',lk:'cr.loc.rem',min:1500,max:2200,date:'2026-10-12',
  t:'Ingeniero/a DevOps (AWS / Google Cloud)',
  p:'Diseñarás y operarás la infraestructura donde viven los sistemas de nuestros clientes.',
  a:['Diseñar y automatizar ambientes en la nube','Monitoreo, respaldos y costos','Responder a incidentes'],
  b:['3+ años con AWS o Google Cloud','Linux, contenedores y CI/CD','Mentalidad de seguridad']},
 {id:'j7',area:'ven',mode:'hib',type:'ft',loc:'Caracas',min:600,max:900,date:'2026-10-08',
  t:'Ejecutivo/a de cuentas',
  p:'Entenderás las necesidades de cada empresa y las conectarás con la solución adecuada. Incluye comisión.',
  a:['Prospectar y dar seguimiento a clientes','Preparar propuestas junto al equipo técnico','Mantener relaciones a largo plazo'],
  b:['Experiencia en ventas B2B','Interés por la tecnología','Orientación a resultados']},
 {id:'j8',area:'dev',mode:'pre',type:'int',loc:'Los Altos Mirandinos',min:250,max:350,date:'2026-11-01',
  t:'Pasante de desarrollo web',
  p:'Aprenderás haciendo, acompañado por desarrolladores con experiencia, en proyectos reales.',
  a:['Apoyar el desarrollo de sitios y sistemas','Probar y corregir errores','Aprender buenas prácticas'],
  b:['Estudiante o recién egresado/a','Bases de HTML, CSS y JavaScript','Curiosidad y disciplina']}
]
};
});
