#!/usr/bin/env python3
"""Genera lqip.json: per ogni immagine in images/ crea una miniatura minuscola
(base64) che il sito mostra sfocata mentre l'immagine vera sta caricando.

Va rilanciato dopo aver caricato nuove immagini dalla dashboard:

    python3 generate-lqip.py

Le immagini senza miniatura non danno errore: il sito usa uno sfondo neutro.
"""
import base64
import io
import json
import os
import shutil
import subprocess
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(ROOT, 'images')
OUT_FILE = os.path.join(ROOT, 'lqip.json')
EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.avif'}
VIDEO_EXTS = {'.mp4', '.webm'}
MAX_W = 16  # tanto viene sfocata: più grande sarebbe peso sprecato

HAS_QUICKLOOK = shutil.which('qlmanage') is not None


def video_thumbnail(path, workdir):
    """Primo fotogramma del video via QuickLook (macOS). None se non riesce."""
    if not HAS_QUICKLOOK:
        return None
    subprocess.run(
        ['qlmanage', '-t', '-s', '256', '-o', workdir, path],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
    )
    shot = os.path.join(workdir, os.path.basename(path) + '.png')
    return shot if os.path.exists(shot) else None


def encode_preview(path):
    with Image.open(path) as im:
        im = im.convert('RGB')
        w, h = im.size
        height = max(1, round(MAX_W * h / w))
        im = im.resize((MAX_W, height), Image.LANCZOS)
        buf = io.BytesIO()
        # Senza ICC/EXIF: su file così piccoli i metadati peserebbero
        # più dell'immagine stessa.
        im.save(buf, 'JPEG', quality=40, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


previews = {}
skipped = []
workdir = tempfile.mkdtemp(prefix='lqip-')

for dirpath, _, filenames in os.walk(IMG_DIR):
    for name in sorted(filenames):
        ext = os.path.splitext(name)[1].lower()
        if ext not in EXTS and ext not in VIDEO_EXTS:
            continue
        full = os.path.join(dirpath, name)
        rel = os.path.relpath(full, ROOT)
        source = full
        if ext in VIDEO_EXTS:
            source = video_thumbnail(full, workdir)
            if not source:
                skipped.append(f'{rel} (anteprima video non disponibile)')
                continue
        try:
            previews[rel] = encode_preview(source)
        except Exception as err:  # file corrotto o formato non leggibile
            skipped.append(f'{rel} ({err})')

shutil.rmtree(workdir, ignore_errors=True)

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(previews, f, separators=(',', ':'), sort_keys=True, ensure_ascii=False)

size_kb = os.path.getsize(OUT_FILE) / 1024
print(f'{len(previews)} anteprime -> lqip.json ({size_kb:.1f} KB)')
for item in skipped:
    print('  saltata:', item)
