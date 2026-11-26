#!/usr/bin/env python3
"""add_new_bgs.py - embed the level 10-14 backgrounds (assets/source/gen_bg10..14_*.jpg)
into js/assets.js as bg10..bg14 without regenerating the hero / zombie art.
Safe to re-run: existing bg10..bg14 entries are replaced. Requires Pillow."""
import base64, io, os, re
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
NEW = [(10, 'grandbassin'), (11, 'rochester'), (12, 'mahebourg'), (13, 'blackriver'), (14, 'citadel')]
path = os.path.join(ROOT, 'js', 'assets.js')
js = open(path).read()
for i, n in NEW:
    im = Image.open(os.path.join(SRC, 'gen_bg%d_%s.jpg' % (i, n))).convert('RGB')
    s = min(1280 / im.width, 720 / im.height, 1.0)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=74, optimize=True)
    line = '  bg%d: "data:image/jpeg;base64,%s",\n' % (i, base64.b64encode(b.getvalue()).decode())
    js = re.sub(r'  bg%d: "[^"]*",\n' % i, '', js)
    js = js.rstrip()
    assert js.endswith('};')
    js = js[:-2] + line + '};\n'
open(path, 'w').write(js)
print('ok', os.path.getsize(path))
