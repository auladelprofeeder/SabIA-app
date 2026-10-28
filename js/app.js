'use strict';
const $ = id => document.getElementById(id);
const esNativa = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
const BASE = esNativa() ? CONFIG.CONTENIDO_BASE : '';
const url = p => BASE + p;
const COLORES = ['#8B5CF6', '#FF3D81', '#14D8C4', '#FFC93C', '#3B82F6', '#FF7A45'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = g => String(g).padStart(2, '0');
const vacio = (i, t) => '<div class="vacio"><i>' + i + '</i><p>' + t + '</p></div>';

/* ---------- almacenamiento local (IndexedDB) ---------- */
function idb() {
  return new Promise((ok, err) => {
    const r = indexedDB.open('sabia_db', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
  });
}
async function idbGet(k) { const db = await idb(); return new Promise(ok => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); }); }
async function idbSet(k, v) { const db = await idb(); return new Promise(ok => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = ok; }); }
async function idbDel(k) { const db = await idb(); return new Promise(ok => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = ok; }); }

/* ---------- perfil, XP y racha ---------- */
let perfil = JSON.parse(localStorage.getItem('perfil') || 'null') ||
  { grado: null, xp: 0, racha: 0, ultimoDia: null, hechas: {}, codigo: 'EST-' + Math.random().toString(36).slice(2, 8).toUpperCase() };
const dia = (d = new Date()) => d.toLocaleDateString('en-CA');
function guardarPerfil() { localStorage.setItem('perfil', JSON.stringify(perfil)); pintarChips(); }
function actualizarRacha() {
  const h = dia(); if (perfil.ultimoDia === h) return;
  perfil.racha = perfil.ultimoDia === dia(new Date(Date.now() - 864e5)) ? perfil.racha + 1 : 1;
  perfil.ultimoDia = h; guardarPerfil();
}
function sumarXP(n, msj) { perfil.xp += n; guardarPerfil(); if (msj) toast('⭐ +' + n + ' XP · ' + msj); }
function pintarChips() {
  $('chipRacha').textContent = '🔥 ' + perfil.racha;
  $('chipXP').textContent = '⭐ ' + perfil.xp;
  $('chipConex').textContent = navigator.onLine ? '🟢' : '🔴 offline';
  $('chatEstado').textContent = navigator.onLine ? 'Listo para ayudarte' : 'Sin conexión: SabIA necesita internet para pensar 🤔';
}
let tt; function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('on'), 2400); }

/* ---------- navegación ---------- */
function ir(v) {
  document.querySelectorAll('.vista').forEach(s => s.classList.toggle('activa', s.id === v));
  document.querySelectorAll('.bottom button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  window.scrollTo(0, 0);
}
document.querySelectorAll('.bottom button').forEach(b => b.onclick = () => ir(b.dataset.v));

function pintarGrados() {
  const h = CONFIG.GRADOS.map(g => '<button class="gchip ' + (perfil.grado === g ? 'on' : '') + '" onclick="elegirGrado(' + g + ')">' + g + '°</button>').join('');
  $('gradosInicio').innerHTML = h; $('gradosContenido').innerHTML = h;
}
function elegirGrado(g) {
  perfil.grado = g; guardarPerfil(); pintarGrados();
  $('saludo').textContent = 'Grado ' + g + '° · ¡a darle!';
  pintarTemas(); cargarQuiz();
}

/* ---------- índice de guías (viene de GitHub Pages) ---------- */
let indice = { grados: {} };
async function cargarIndice() {
  try {
    const r = await fetch(url('content/indice.json'), { cache: 'no-cache' });
    if (r.ok) { indice = await r.json(); await idbSet('indice', indice); return; }
  } catch (e) {}
  indice = (await idbGet('indice')) || { grados: {} };
}
const temasGrado = () => (indice.grados[perfil.grado] || { temas: [] }).temas;

async function pintarTemas() {
  const cont = $('listaTemas');
  if (!perfil.grado) { cont.innerHTML = vacio('🎓', 'Elige tu grado arriba para ver tus guías'); return; }
  const temas = temasGrado();
  if (!temas.length) { cont.innerHTML = vacio('🚧', 'Aún no hay guías para este grado. ¡Pronto habrá!'); return; }
  const desc = (await idbGet('descargadas')) || {};
  cont.innerHTML = temas.map((t, ti) => '<div class="tema" style="--c:' + COLORES[ti % COLORES.length] + '"><h3>' + esc(t.titulo) + '</h3>' +
    t.guias.map((g, gi) => {
      const off = desc[g.completo];
      const kbT = g.partes.reduce((a, p) => a + p.kb, 0);
      return '<div class="guia"><b>' + esc(g.titulo) + '</b><small>' + g.paginas + ' págs · ' + g.partes.length + ' partes · ~' + kbT + ' KB</small> ' +
        (off ? '<span class="ok">✅ offline</span>' : '') +
        '<div class="fila"><button class="mini verde" onclick="leer(' + ti + ',' + gi + ')">📖 Leer en la app</button>' +
        (off ? '<button class="mini rojo" onclick="borrarDescarga(' + ti + ',' + gi + ')">🗑️ Quitar</button>'
             : '<button class="mini" onclick="descargarGuia(' + ti + ',' + gi + ')">⬇️ Guardar offline</button>') +
        '<button class="mini gris" onclick="pdfCompleto(' + ti + ',' + gi + ')">📄 PDF completo</button></div></div>';
    }).join('') + '</div>').join('');
}

/* ---------- descargas por partes ---------- */
async function descargarPartes(g, enProgreso) {
  for (let i = 0; i < g.partes.length; i++) {
    const p = g.partes[i];
    if (!(await idbGet('pdf:' + p.archivo))) {
      const r = await fetch(url(p.archivo));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await idbSet('pdf:' + p.archivo, await r.arrayBuffer());
    }
    if (enProgreso) enProgreso(i + 1, g.partes.length);
  }
  const d = (await idbGet('descargadas')) || {}; d[g.completo] = true; await idbSet('descargadas', d);
}
async function descargarGuia(ti, gi) {
  if (!navigator.onLine) return toast('Necesitas internet para descargar');
  const g = temasGrado()[ti].guias[gi];
  try { await descargarPartes(g, (a, b) => toast('⬇️ Descargando ' + a + '/' + b)); toast('✅ Guía lista para leer offline'); }
  catch (e) { toast('No se pudo descargar: ' + e.message); }
  pintarTemas();
}
async function borrarDescarga(ti, gi) {
  const g = temasGrado()[ti].guias[gi];
  for (const p of g.partes) await idbDel('pdf:' + p.archivo);
  const d = (await idbGet('descargadas')) || {}; delete d[g.completo]; await idbSet('descargadas', d);
  pintarTemas();
}
function pdfCompleto(ti, gi) {
  const g = temasGrado()[ti].guias[gi], u = url(g.completo);
  if (!navigator.onLine) return toast('Necesitas internet para bajar el PDF completo');
  if (esNativa() && Capacitor.Plugins && Capacitor.Plugins.Browser) Capacitor.Plugins.Browser.open({ url: u });
  else window.open(u, '_blank');
}

/* ---------- visor de la app (PDF.js, una parte a la vez) ---------- */
let vis = { g: null, parte: 0, doc: null, pag: 1 };
let contextoTema = '';
async function leer(ti, gi) {
  if (!window.pdfjsLib) return toast('Falta instalar PDF.js (mira el LEEME)');
  const g = temasGrado()[ti].guias[gi];
  const ant = JSON.parse(localStorage.getItem('prog:' + g.completo) || 'null');
  vis = { g, parte: ant ? ant.parte : 0, doc: null, pag: ant ? ant.pag : 1 };
  contextoTema = g.titulo + ' (' + temasGrado()[ti].titulo + ')';
  $('visorTitulo').textContent = g.titulo;
  $('visor').classList.add('abierto');
  await abrirParte(vis.parte, vis.pag);
}
async function abrirParte(i, pag) {
  const p = vis.g.partes[i];
  let buf = await idbGet('pdf:' + p.archivo);
  if (!buf) {
    if (!navigator.onLine) return toast('Esta parte no está descargada y no hay internet');
    $('visorEstado').textContent = 'Cargando…';
    buf = await (await fetch(url(p.archivo))).arrayBuffer();
  }
  vis.doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  vis.parte = i; vis.pag = Math.min(pag || 1, vis.doc.numPages);
  await pintarPagina();
}
async function pintarPagina() {
  const page = await vis.doc.getPage(vis.pag);
  const c = $('visorLienzo'), dpr = window.devicePixelRatio || 1;
  const ancho = c.parentElement.clientWidth - 16;
  const escala = ancho / page.getViewport({ scale: 1 }).width;
  const vp = page.getViewport({ scale: escala * dpr });
  c.width = vp.width; c.height = vp.height; c.style.width = (vp.width / dpr) + 'px';
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  $('visorEstado').textContent = 'Parte ' + (vis.parte + 1) + '/' + vis.g.partes.length + ' · pág ' + vis.pag + '/' + vis.doc.numPages;
  localStorage.setItem('prog:' + vis.g.completo, JSON.stringify({ parte: vis.parte, pag: vis.pag }));
  $('visorLienzo').parentElement.scrollTop = 0;
}
async function paso(d) {
  if (!vis.doc) return;
  if (d > 0) {
    if (vis.pag < vis.doc.numPages) { vis.pag++; return pintarPagina(); }
    if (vis.parte < vis.g.partes.length - 1) return abrirParte(vis.parte + 1, 1);
    if (!perfil.hechas[vis.g.completo]) { perfil.hechas[vis.g.completo] = true; sumarXP(10, '¡Guía terminada!'); }
    localStorage.removeItem('prog:' + vis.g.completo); return cerrarVisor();
  }
  if (vis.pag > 1) { vis.pag--; return pintarPagina(); }
  if (vis.parte > 0) return abrirParte(vis.parte - 1, 9999);
}
function cerrarVisor() { $('visor').classList.remove('abierto'); }
function preguntarSobreGuia() { cerrarVisor(); ir('tutor'); msg('bot', 'Hablemos de "' + contextoTema + '" 🤖 Cuéntame tu duda o envía una foto del ejercicio.'); }

/* ---------- tutor SabIA ---------- */
let historial = [], foto = null;
function msg(rol, texto, img) {
  const c = $('chatMsgs'), d = document.createElement('div');
  d.className = 'msg ' + rol;
  const p = document.createElement('div'); p.textContent = texto; d.appendChild(p);
  if (img) { const i = document.createElement('img'); i.src = img; d.appendChild(i); }
  c.appendChild(d); c.scrollTop = c.scrollHeight;
  historial.push({ rol: rol === 'bot' ? 'model' : 'user', texto });
}
function menu(items) {
  const c = $('chatMsgs'), d = document.createElement('div'); d.className = 'menu';
  items.forEach(([t, fn]) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { d.remove(); fn(); }; d.appendChild(b); });
  c.appendChild(d); c.scrollTop = c.scrollHeight;
}
function menuInicial() {
  menu([
    ['✏️ Tengo un ejercicio', () => { msg('bot', '¡Perfecto! Escríbelo o toca 📎 para enviar una foto.'); $('chatInput').focus(); }],
    ['📖 No entiendo un tema', () => { msg('bot', 'Cuéntame qué tema de mates se te está dificultando 🤔'); $('chatInput').focus(); }],
    ['🔄 Quiero repasar', () => enviar('Quiero repasar un tema de matemáticas de mi grado. Hazme preguntas.')]
  ]);
}
function escribiendo() {
  const c = $('chatMsgs'), d = document.createElement('div'); d.className = 'msg bot'; d.textContent = 'SabIA está pensando… 🤔';
  c.appendChild(d); c.scrollTop = c.scrollHeight; return d;
}
function reducir(dataUrl, max = 1280) {
  return new Promise(ok => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/jpeg', 0.8));
    };
    im.src = dataUrl;
  });
}
function fotoElegida(ev) {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  if (!f.type.startsWith('image/')) return toast('Elige una imagen');
  const l = new FileReader();
  l.onload = async e => {
    const u = await reducir(e.target.result);
    foto = { base64: u.split(',')[1], mime: 'image/jpeg', preview: u };
    $('imgPrevia').src = u; $('previa').style.display = 'flex';
  };
  l.readAsDataURL(f);
}
function quitarFoto() { foto = null; $('previa').style.display = 'none'; $('imgPrevia').src = ''; }
const cola = (k, v) => { const c = JSON.parse(localStorage.getItem(k) || '[]'); if (v) { c.push(v); localStorage.setItem(k, JSON.stringify(c)); } return c; };

async function enviar(forzado) {
  const inp = $('chatInput'), texto = (typeof forzado === 'string' ? forzado : inp.value).trim();
  if (!texto && !foto) return;
  inp.value = '';
  const f = foto; quitarFoto();
  msg('yo', texto || '📎 Foto del ejercicio', f && f.preview);
  const previo = historial.slice(0, -1);
  const imagen = f ? { base64: f.base64, mimeType: f.mime } : null;
  const guardar = () => cola('cola_chat', { texto, previo, ctx: contextoTema, grado: perfil.grado });
  if (!navigator.onLine) {
    if (f) return msg('bot', 'Sin conexión: las fotos necesitan internet. Inténtalo cuando tengas señal 📶');
    guardar(); return msg('bot', 'Sin conexión. Guardé tu pregunta 📥 y la respondo cuando vuelva el internet.');
  }
  const esp = escribiendo();
  try {
    const r = await api('tutor', texto, previo, contextoTema, imagen, perfil.grado);
    esp.remove(); msg('bot', r.exito ? r.respuesta : '⚠️ ' + r.respuesta); sumarXP(2);
    menu([['✅ Entendí, ¿qué sigue?', () => enviar('Sí, entendí. ¿Qué sigue?')], ['🤔 No entendí', () => enviar('No entendí, explícamelo de otra forma')]]);
  } catch (e) {
    esp.remove();
    if (!f) { guardar(); msg('bot', 'No pude conectarme. Guardé tu pregunta y la envío cuando mejore la señal.'); }
    else msg('bot', 'No pude enviar la foto. Inténtalo de nuevo.');
  }
}
async function pedirTutoria() {
  const n = $('nombreTutoria').value.trim();
  if (!n) { $('nombreTutoria').style.borderColor = '#FF3D81'; return toast('Escribe tu nombre'); }
  if (!navigator.onLine) return toast('Necesitas internet para pedir la tutoría');
  const ult = [...historial].reverse().find(m => m.rol === 'user');
  try {
    const r = await api('tutoria', n, contextoTema || ('Grado ' + (perfil.grado || '?')), ult ? ult.texto : '');
    $('nombreTutoria').value = ''; msg('bot', (r.exito ? '✅ ' : '⚠️ ') + r.mensaje); ir('tutor');
  } catch (e) { toast('No se pudo enviar. Intenta de nuevo'); }
}

/* ---------- evaluación ---------- */
let quiz = [], resp = [];
async function cargarQuiz() {
  const a = $('quizArea');
  if (!perfil.grado) { a.innerHTML = vacio('🎓', 'Elige tu grado para ver tu evaluación'); return; }
  try {
    const r = await fetch(url('content/quiz/g' + pad(perfil.grado) + '.json'), { cache: 'no-cache' });
    if (!r.ok) throw 0;
    quiz = await r.json(); await idbSet('quiz' + perfil.grado, quiz);
  } catch (e) { quiz = (await idbGet('quiz' + perfil.grado)) || []; }
  if (!quiz.length) { a.innerHTML = vacio('📝', 'Aún no hay evaluación para este grado. ¡Pronto!'); return; }
  resp = new Array(quiz.length).fill(null);
  a.innerHTML = quiz.map((q, i) => '<div class="pregunta"><h4>' + (i + 1) + '. ' + esc(q.pregunta) + '</h4>' +
    q.opciones.map((o, j) => '<div class="op" onclick="elegirOp(' + i + ',' + j + ',this)">' + esc(o) + '</div>').join('') + '</div>').join('') +
    '<button class="btn grande" onclick="enviarQuiz()">Enviar respuestas 🚀</button><div id="quizRes"></div>';
}
function elegirOp(i, j, el) {
  resp[i] = j; el.parentElement.querySelectorAll('.op').forEach(o => o.classList.remove('sel')); el.classList.add('sel');
}
async function enviarQuiz() {
  if (resp.includes(null)) return toast('Responde todas las preguntas');
  const puntaje = quiz.filter((q, i) => resp[i] === q.correcta).length;
  sumarXP(puntaje * 10);
  $('quizRes').innerHTML = '<div class="res">🎉 Obtuviste ' + puntaje + ' de ' + quiz.length + ' · +' + (puntaje * 10) + ' XP</div>';
  cola('cola_res', { codigo: perfil.codigo, grado: 'Grado ' + perfil.grado, puntaje, total: quiz.length });
  vaciarColas();
}

/* ---------- juegos ---------- */
async function cargarJuegos() {
  let j = [];
  try { const r = await fetch(url('content/juegos.json'), { cache: 'no-cache' }); if (r.ok) j = (await r.json()).juegos || []; } catch (e) {}
  $('listaJuegos').innerHTML = j.length
    ? j.map(x => '<div class="juego-card" onclick="abrirJuego(\'' + esc(x.ruta) + '\',\'' + esc(x.titulo) + '\')"><i>' + esc(x.icono || '🎮') + '</i><div><b>' + esc(x.titulo) + '</b><br><small>' + esc(x.descripcion || '') + '</small></div></div>').join('')
    : vacio('🎮', '¡Los juegos llegan pronto! Prepárate para retar a tus amigos');
}
function abrirJuego(ruta, titulo) { $('juegoTitulo').textContent = titulo; $('juegoMarco').src = url(ruta); $('juego').classList.add('abierto'); }
function cerrarJuego() { $('juego').classList.remove('abierto'); $('juegoMarco').src = 'about:blank'; }

/* ---------- colas offline ---------- */
async function vaciarColas() {
  if (!navigator.onLine) return;
  const ch = cola('cola_chat'); localStorage.setItem('cola_chat', '[]');
  for (const x of ch) {
    try { const r = await api('tutor', x.texto, x.previo, x.ctx, null, x.grado); msg('bot', r.exito ? r.respuesta : '⚠️ ' + r.respuesta); }
    catch (e) { cola('cola_chat', x); }
  }
  const rs = cola('cola_res'); localStorage.setItem('cola_res', '[]');
  for (const x of rs) {
    try { await api('resultado', x.codigo, x.grado, x.puntaje, x.total); } catch (e) { cola('cola_res', x); }
  }
}
window.addEventListener('online', () => { pintarChips(); vaciarColas(); });
window.addEventListener('offline', pintarChips);

window.addEventListener('load', async () => {
  actualizarRacha(); pintarChips(); pintarGrados();
  if (perfil.grado) $('saludo').textContent = 'Grado ' + perfil.grado + '° · ¡a darle!';
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  msg('bot', '¡Hola! Soy SabIA 🤖 Te ayudo con cualquier tema de matemáticas. Elige una opción o escribe abajo.');
  menuInicial();
  await cargarIndice(); pintarTemas(); cargarQuiz(); cargarJuegos(); vaciarColas();
  if ('serviceWorker' in navigator && !esNativa()) navigator.serviceWorker.register('sw.js');
});
