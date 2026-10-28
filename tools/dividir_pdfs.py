"""Divide cada PDF de guias_fuente/gNN/<tema>/<guia>.pdf en partes y crea content/indice.json."""
import json, re, shutil, time
from pathlib import Path
from pypdf import PdfReader, PdfWriter

FUENTE = Path('guias_fuente')
SALIDA = Path('content/guias')
PAGS_POR_PARTE = 5

def bonito(nombre):
    t = re.sub(r'^\d+[_\-\s]+', '', nombre).replace('_', ' ').replace('-', ' ').strip()
    return t[:1].upper() + t[1:]

def main():
    indice = {'generado': time.strftime('%Y-%m-%d %H:%M'), 'grados': {}}
    if SALIDA.exists():
        shutil.rmtree(SALIDA)
    for gdir in sorted(FUENTE.glob('g*')):
        m = re.match(r'g(\d+)$', gdir.name)
        if not m or not gdir.is_dir():
            continue
        temas = []
        for tdir in sorted(p for p in gdir.iterdir() if p.is_dir()):
            guias = []
            for pdf in sorted(tdir.glob('*.pdf')):
                lector = PdfReader(str(pdf))
                n = len(lector.pages)
                base = SALIDA / gdir.name / tdir.name / pdf.stem
                base.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(pdf, base / 'completo.pdf')
                partes = []
                for ini in range(0, n, PAGS_POR_PARTE):
                    w = PdfWriter()
                    fin = min(ini + PAGS_POR_PARTE, n)
                    for k in range(ini, fin):
                        w.add_page(lector.pages[k])
                    f = base / ('parte%d.pdf' % (len(partes) + 1))
                    with open(f, 'wb') as fh:
                        w.write(fh)
                    partes.append({'archivo': f.as_posix(), 'desde': ini + 1, 'hasta': fin,
                                   'kb': max(1, round(f.stat().st_size / 1024))})
                guias.append({'id': pdf.stem, 'titulo': bonito(pdf.stem), 'paginas': n,
                              'completo': (base / 'completo.pdf').as_posix(),
                              'kb': round((base / 'completo.pdf').stat().st_size / 1024), 'partes': partes})
            if guias:
                temas.append({'id': tdir.name, 'titulo': bonito(tdir.name), 'guias': guias})
        indice['grados'][str(int(m.group(1)))] = {'temas': temas}
    Path('content').mkdir(exist_ok=True)
    Path('content/indice.json').write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding='utf-8')
    print('Guias procesadas:', sum(len(t['guias']) for g in indice['grados'].values() for t in g['temas']))

if __name__ == '__main__':
    main()
