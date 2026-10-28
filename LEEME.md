# SabIA 2.0 (base sin contenido)

App de matemáticas 6° a 11°: Inicio, Guías, Tutor SabIA, Juegos y Evaluación.
Contenido en GitHub Pages; tutor y registros en Apps Script.

## Arranque rápido
1. Crea un repositorio PÚBLICO en GitHub (ej. `sabia`) y sube TODO este contenido (rama `main`).
2. Settings > Pages > Source: **GitHub Actions**.
3. En tu Mac: `pip3 install "qrcode[pil]"` y luego `python3 tools/configurar.py TU_USUARIO sabia`
   (escribe js/sitio.js y crea los QR). Haz commit y push.
4. Instala PDF.js: `npm run pdfjs` (copia pdf.min.js y pdf.worker.min.js a vendor/pdfjs/). Commit y push.
5. Apps Script: crea un proyecto, pega gas/Code.gs y gas/appsscript.json, rellena SHEET_ID, CORREO_DOCENTE y TOKEN_APP,
   crea la propiedad GEMINI_API_KEY, e Implementar > Aplicación web. Copia la URL /exec en js/config.js (API_URL) y el mismo TOKEN_APP.
6. Abre https://TU_USUARIO.github.io/sabia/ : prueba el tutor. La página /descargar.html muestra enlace y QR.

## Cargar guías (cuando quieras)
Guarda cada PDF así: `guias_fuente/g09/plano-cartesiano/01_introduccion.pdf`
(grado / tema / guía). Haz push: GitHub Actions las parte en bloques de 5 págs (tools/dividir_pdfs.py) y actualiza content/indice.json.
Evaluaciones: `content/quiz/g09.json` con `[{ "pregunta": "...", "opciones": ["a","b","c","d"], "correcta": 1 }]`.
Juegos: carpeta `juegos/mi-juego/index.html` + entrada en `content/juegos.json`:
`{ "juegos": [{ "titulo": "Reto", "icono": "🧩", "descripcion": "...", "ruta": "juegos/mi-juego/index.html" }] }`

## APK (Android)
```
npm init -y            # solo la primera vez (no sobrescribas package.json: copia los scripts de este)
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/browser
npm run dividir && npm run build
npx cap add android
npx cap sync android
npx cap open android
```
En android/app/src/main/AndroidManifest.xml deja INTERNET y añade CAMERA.
Android Studio: Build > Build APK(s). Renombra el archivo a **sabia.apk** y súbelo en GitHub > Releases > Draft a new release.
El enlace https://github.com/USUARIO/REPO/releases/latest/download/sabia.apk ya está en descargar.html y en el QR.
Cada versión nueva: sube un release nuevo con el mismo nombre sabia.apk.

## iOS (después)
`npm i @capacitor/ios && npx cap add ios && npx cap open ios` (Xcode, en tu Mac). Mientras tanto: iPhone usa la web (Safari > Compartir > Añadir a pantalla de inicio).
