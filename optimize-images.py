#!/usr/bin/env python3
"""Converte in WebP le immagini di images/ e aggiorna i riferimenti nei progetti.

I PNG esportati dai programmi di grafica pesano anche 3 MB l'uno: in WebP
scendono del 85-95% senza differenze visibili. Da rilanciare dopo aver
caricato nuove immagini dalla dashboard:

    python3 optimize-images.py
    python3 generate-lqip.py

L'originale viene cancellato solo se la versione WebP è più leggera, e resta
comunque recuperabile dalla cronologia di git.
"""
import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(ROOT, 'images')
CONVERTIBLE = {'.png', '.jpg', '.jpeg'}
QUALITY = 90  # alto: sono immagini di portfolio


def has_real_alpha(im):
    """True solo se la trasparenza viene davvero usata."""
    if im.mode not in ('RGBA', 'LA', 'P'):
        return False
    if im.mode == 'P' and 'transparency' not in im.info:
        return False
    alpha = im.convert('RGBA').getchannel('A')
    return alpha.getextrema()[0] < 255


def convert(path):
    """Ritorna il percorso WebP se la conversione conviene, altrimenti None."""
    target = os.path.splitext(path)[0] + '.webp'
    if os.path.exists(target):
        return None
    with Image.open(path) as im:
        im = im.convert('RGBA') if has_real_alpha(im) else im.convert('RGB')
        im.save(target, 'WEBP', quality=QUALITY, method=6)
    if os.path.getsize(target) >= os.path.getsize(path):
        os.remove(target)  # raro, ma su file già minuscoli può succedere
        return None
    return target


def main():
    mapping = {}
    before = after = 0

    for dirpath, _, filenames in os.walk(IMG_DIR):
        for name in sorted(filenames):
            if os.path.splitext(name)[1].lower() not in CONVERTIBLE:
                continue
            source = os.path.join(dirpath, name)
            try:
                target = convert(source)
            except Exception as err:
                print(f'  saltata {os.path.relpath(source, ROOT)}: {err}')
                continue
            if not target:
                continue
            before += os.path.getsize(source)
            after += os.path.getsize(target)
            mapping[os.path.relpath(source, ROOT)] = os.path.relpath(target, ROOT)
            os.remove(source)

    if not mapping:
        print('Nessuna immagine da convertire.')
        return

    # I percorsi nei JSON compaiono sia come "images/..." sia come "/images/...":
    # sostituendo la parte relativa si coprono entrambi i casi.
    touched = []
    for json_path in sorted(glob.glob(os.path.join(ROOT, 'projects', '*.json'))):
        with open(json_path, encoding='utf-8') as f:
            text = original = f.read()
        for old, new in mapping.items():
            text = text.replace(old, new)
        if text != original:
            with open(json_path, 'w', encoding='utf-8') as f:
                f.write(text)
            touched.append(os.path.basename(json_path))

    print(f'{len(mapping)} immagini convertite: '
          f'{before / 1024 / 1024:.1f} MB -> {after / 1024 / 1024:.1f} MB '
          f'(-{100 - 100 * after / before:.1f}%)')
    print('progetti aggiornati:', ', '.join(touched) if touched else 'nessuno')
    print('Ora rilancia: python3 generate-lqip.py')


if __name__ == '__main__':
    main()
