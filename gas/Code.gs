/**
 * SabIA 2.0 - Backend (Apps Script). Solo tutor + registros. El contenido vive en GitHub Pages.
 * Despliegue: Implementar > Nueva implementación > Aplicación web (Ejecutar como: Yo, Acceso: Cualquier usuario).
 * En Propiedades del script crea GEMINI_API_KEY.
 */
const SHEET_ID = 'PEGA_EL_ID_DE_TU_HOJA_DE_REGISTRO';
const CORREO_DOCENTE = 'tu_correo@gmail.com';
const TOKEN_APP = 'CAMBIA_ESTE_TOKEN';          // el mismo de js/config.js
const MODELO_GEMINI = 'gemini-3.5-flash-lite';
const MODELO_RESPALDO = 'gemini-2.5-flash-lite';

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return json_({ ok: true, servicio: 'SabIA API' }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.token !== TOKEN_APP) return json_({ error: 'no autorizado' });
    const a = req.args || [];
    switch (req.action) {
      case 'tutor':     return json_(preguntarTutor(a[0], a[1], a[2], a[3], a[4]));
      case 'resultado': return json_(guardarResultado(a[0], a[1], a[2], a[3]));
      case 'tutoria':   return json_(solicitarTutoriaHumana(a[0], a[1], a[2]));
      default:          return json_({ error: 'accion desconocida' });
    }
  } catch (err) { return json_({ error: err.message }); }
}

function obtenerClaveGemini_() {
  const k = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!k) throw new Error('Falta GEMINI_API_KEY en Propiedades del script.');
  return k.trim();
}

function llamarGemini_(modelo, apiKey, sistema, contenido) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent';
  const r = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': apiKey }, muteHttpExceptions: true,
    payload: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: contenido,
                              generationConfig: { temperature: 0.6, maxOutputTokens: 220 } })
  });
  return { status: r.getResponseCode(), rawText: r.getContentText() };
}

function preguntarTutor(mensaje, historial, contextoTema, imagen, grado) {
  try {
    const apiKey = obtenerClaveGemini_();
    const sistema =
      "Eres 'SabIA', tutor virtual socrático de MATEMÁTICAS EN GENERAL para estudiantes de básica secundaria y media (grados 6 a 11) en Colombia. " +
      (grado ? ("El estudiante cursa grado " + grado + ": adapta vocabulario, ejemplos y dificultad a ese nivel. ") : "No conoces el grado: ajusta el nivel según el ejercicio. ") +
      "Ayudas con aritmética, álgebra, geometría, trigonometría, estadística, probabilidad, funciones, vectores, cálculo básico o cualquier tema escolar de matemáticas. " +
      "SI ENVÍA UNA FOTO: analiza el ejercicio (raíces, exponentes, fracciones, gráficas, ecuaciones), di brevemente qué identificaste y haz tu primera pregunta guía. Si no se ve clara, pide otra foto con mejor luz. " +
      "NUNCA INVENTES CONTEXTO: no menciones 'tu tarea' ni 'el primer punto' si el estudiante no compartió un ejercicio (texto o foto). Si solo pide ayuda sin ejercicio, pídele que escriba o fotografíe el ejercicio exacto. " +
      "Si saluda o escribe algo casual, responde en una frase amable y pide el ejercicio. Si pide ayuda de otra materia, aclara con amabilidad que tu especialidad es matemáticas. " +
      "FORMATO: el chat es TEXTO PLANO. NUNCA uses LaTeX ni el símbolo $. Escribe operaciones con +, -, x, /, =, ^ o 'raíz cuadrada de'. " +
      "REGLA CLAVE: responde SIEMPRE en máximo 2-3 líneas cortas. Nunca des la respuesta directa: haz UNA pregunta guía o da UNA pista por turno. " +
      "Tono cercano y motivador, español sencillo, algún emoji ocasional. Si acierta, celebra y da el siguiente paso; si se equivoca, pregunta algo que lo lleve a notar el error. " +
      (contextoTema ? ("El estudiante viene de esta guía o tema (úsalo como pista, sin limitarte a él): " + contextoTema) : "");
    const contenido = [];
    (historial || []).slice(-6).forEach(function (m) {
      contenido.push({ role: m.rol === 'model' ? 'model' : 'user', parts: [{ text: m.texto }] });
    });
    const partes = [];
    if (imagen && imagen.base64 && imagen.mimeType) partes.push({ inline_data: { mime_type: imagen.mimeType, data: imagen.base64 } });
    partes.push({ text: mensaje && mensaje.trim() ? mensaje : 'Aquí está mi ejercicio en la foto.' });
    contenido.push({ role: 'user', parts: partes });

    let ultimo = null, espera = 700;
    for (let i = 1; i <= 2; i++) {
      const r = llamarGemini_(MODELO_GEMINI, apiKey, sistema, contenido);
      if (r.status === 200) return procesarOk_(r.rawText, mensaje || '[Foto]', grado);
      ultimo = r;
      if (!(r.status === 429 || r.status >= 500)) break;
      if (i < 2) { Utilities.sleep(espera); espera *= 2; }
    }
    if (ultimo && ultimo.status >= 500) {
      const rr = llamarGemini_(MODELO_RESPALDO, apiKey, sistema, contenido);
      if (rr.status === 200) return procesarOk_(rr.rawText, mensaje || '[Foto]', grado);
      ultimo = rr;
    }
    return errorAmable_(ultimo.status);
  } catch (err) {
    return { exito: false, respuesta: 'Error técnico: ' + err.message };
  }
}

function limpiar_(t) {
  return t.replace(/\$\$(.*?)\$\$/g, '$1').replace(/\$(.*?)\$/g, '$1')
    .replace(/\\div/g, '÷').replace(/\\times/g, 'x').replace(/\\cdot/g, 'x').replace(/\\\(/g, '').replace(/\\\)/g, '');
}
function procesarOk_(raw, pregunta, grado) {
  const d = JSON.parse(raw);
  let t = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts[0].text;
  if (!t) return { exito: false, respuesta: 'No pude generar una respuesta. Intenta reformular o toma la foto de nuevo.' };
  t = limpiar_(t);
  registrar_('Conversaciones_Tutor', ['Fecha', 'Grado', 'Pregunta', 'Respuesta'], [new Date(), grado || '', pregunta, t]);
  return { exito: true, respuesta: t };
}
function errorAmable_(s) {
  if (s === 503) return { exito: false, respuesta: '🤖 SabIA está muy solicitado. Espera unos segundos y vuelve a preguntar.' };
  if (s === 429) return { exito: false, respuesta: '🤖 Se alcanzó el límite de preguntas por minuto. Espera un momento.' };
  if (s === 400) return { exito: false, respuesta: '🤖 No pude procesar la foto. Prueba con una imagen más clara (JPG o PNG).' };
  return { exito: false, respuesta: 'Hubo un problema al conectar con el tutor (código ' + s + ').' };
}
function registrar_(hoja, cabecera, fila) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(hoja);
    if (!sh) { sh = ss.insertSheet(hoja); sh.appendRow(cabecera); }
    sh.appendRow(fila);
  } catch (e) { Logger.log('No se pudo registrar: ' + e.message); }
}
function guardarResultado(codigo, grado, puntaje, total) {
  registrar_('Resultados', ['Fecha', 'Codigo', 'Grado', 'Puntaje', 'Total', 'Porcentaje'],
    [new Date(), codigo, grado, puntaje, total, ((puntaje / total) * 100).toFixed(1) + '%']);
  return { exito: true, mensaje: 'Resultado guardado.' };
}
function solicitarTutoriaHumana(nombre, tema, ultimaPregunta) {
  const n = (nombre || '').trim();
  if (!n) return { exito: false, mensaje: 'Debes escribir tu nombre.' };
  let cuerpo = 'Solicitud de tutoría desde SabIA.\n\nEstudiante: ' + n + '\nTema: ' + (tema || 'No especificado') + '\n';
  if (ultimaPregunta) cuerpo += 'Última pregunta al tutor: "' + ultimaPregunta + '"\n';
  cuerpo += '\nFecha: ' + new Date().toLocaleString('es-CO');
  MailApp.sendEmail(CORREO_DOCENTE, 'SabIA: solicitud de tutoría - ' + n, cuerpo);
  registrar_('Solicitudes_Tutoria', ['Fecha', 'Nombre', 'Tema', 'Ultima pregunta'], [new Date(), n, tema, ultimaPregunta || '']);
  return { exito: true, mensaje: '¡Gracias ' + n + '! Tu solicitud fue enviada al profe.' };
}
