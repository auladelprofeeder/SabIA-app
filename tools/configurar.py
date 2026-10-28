"""Uso: python3 tools/configurar.py TU_USUARIO_GITHUB NOMBRE_DEL_REPO
Escribe js/sitio.js y genera los QR (qr/qr_apk.png y qr/qr_web.png).
Requiere: pip install "qrcode[pil]" """
import sys
from pathlib import Path
import qrcode

usuario, repo = sys.argv[1], sys.argv[2]
Path('js/sitio.js').write_text("const SITIO = { usuario: '%s', repo: '%s' };\n" % (usuario, repo), encoding='utf-8')
web = 'https://%s.github.io/%s/' % (usuario, repo)
apk = 'https://github.com/%s/%s/releases/latest/download/sabia.apk' % (usuario, repo)
Path('qr').mkdir(exist_ok=True)
qrcode.make(apk).save('qr/qr_apk.png')
qrcode.make(web).save('qr/qr_web.png')
print('Web:', web)
print('APK:', apk)
