# -*- coding: utf-8 -*-
"""Genera los assets que la web referencia pero que no existen:
   - og-share.png (1200x630) para las vistas previas al compartir
   - favicon.png / favicon.ico / apple-touch-icon.png

Se usan UNICAMENTE assets de la propia marca: el pintxo del logo de la web
y la tipografia Archivo que ya carga el sitio. Nada inventado.
"""
import re, json, base64, gzip, io, os
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

BUNDLE = r"C:\Users\User\Downloads\LA COMMANDE\LA COMMANDE.html"   # original, fuentes completas
TMP = r"C:\Users\User\AppData\Local\Temp"
OUT = r"C:\Users\User\AppData\Local\Temp\assets"
os.makedirs(OUT, exist_ok=True)

ROJO = (255, 35, 29)
CREMA = (250, 249, 245)

html = open(BUNDLE, encoding="utf-8").read()
man = json.loads(re.search(r'<script type="__bundler/manifest">(.*?)</script>', html, re.S).group(1))

def payload(e):
    raw = base64.b64decode(e["data"])
    return gzip.decompress(raw) if e.get("compressed") else raw

# ---- 1. Sacar Archivo (el peso mas grueso) y pasarlo a TTF ----
mejor = None
for uuid, e in man.items():
    if not e["mime"].startswith("font"):
        continue
    data = payload(e)
    f = TTFont(io.BytesIO(data), fontNumber=0)
    nombre = next((r.toUnicode() for r in f["name"].names if r.nameID == 4), "")
    if "Archivo" not in nombre:
        continue
    cmap = f.getBestCmap()
    if ord("A") in cmap and ord("M") in cmap:
        n = len(cmap)
        if mejor is None or n > mejor[0]:
            mejor = (n, data)
if not mejor:
    raise SystemExit("no se encontro la fuente Archivo con mayusculas")
ttf_path = os.path.join(TMP, "archivo.ttf")
f = TTFont(io.BytesIO(mejor[1]), fontNumber=0)
f.flavor = None
f.save(ttf_path)
print("fuente Archivo extraida (%d glifos) -> %s" % (mejor[0], ttf_path))

# ---- 2. Pintxo del logo de navegacion (limpio, con transparencia) ----
logo = fondo = None
for uuid, e in man.items():
    if e["mime"].startswith("image"):
        im = Image.open(io.BytesIO(payload(e))).convert("RGBA")
        if im.size == (75, 150):
            logo = im          # logo nitido de la navegacion
        else:
            fondo = im         # silueta grande del hero
print("logo nav:", logo.size, "| fondo hero:", fondo.size)

def recolorear(img, rgb):
    """Mantiene el alfa, pinta el trazo del color dado."""
    r, g, b, a = img.split()
    solido = Image.new("RGBA", img.size, rgb + (255,))
    solido.putalpha(a)
    return solido

# ---- 3. og-share.png : 1200x630, fondo rojo de marca ----
W, H = 1200, 630
og = Image.new("RGB", (W, H), ROJO)
d = ImageDraw.Draw(og)

# pintxo en blanco a la derecha, recortado por el borde como en la web
alto = int(H * 1.15)
ancho = int(fondo.size[0] * alto / fondo.size[1])
p_blanco = recolorear(fondo.resize((ancho, alto), Image.LANCZOS), (255, 255, 255))
capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
capa.paste(p_blanco, (W - ancho - 90, int((H - alto) / 2)), p_blanco)
capa.putalpha(capa.getchannel("A").point(lambda v: int(v * 0.22)))   # marca de agua sutil
og = Image.alpha_composite(og.convert("RGBA"), capa).convert("RGB")
d = ImageDraw.Draw(og)

titulo = ImageFont.truetype(ttf_path, 118)
sub = ImageFont.truetype(ttf_path, 34)
precio = ImageFont.truetype(ttf_path, 60)

x, y = 80, 150
d.text((x, y), "LA COMMANDE", font=titulo, fill=(255, 255, 255))
y += 145
d.text((x, y), "WEBS PARA HOSTELER\u00cdA \u00b7 DONOSTIA", font=sub, fill=(255, 255, 255))
y += 78
d.line([(x, y), (x + 470, y)], fill=(255, 255, 255), width=2)
y += 40
d.text((x, y), "29,99 \u20ac AL MES", font=precio, fill=(255, 255, 255))

og.save(os.path.join(OUT, "og-share.png"), optimize=True)
print("og-share.png ->", og.size, os.path.getsize(os.path.join(OUT, "og-share.png")) // 1024, "KB")

# ---- 4. Favicons: pintxo rojo sobre crema, cuadrado ----
def favicon(px):
    lienzo = Image.new("RGBA", (px, px), CREMA + (255,))
    margen = int(px * 0.12)
    disp = px - 2 * margen
    alto = disp
    ancho = max(1, int(logo.size[0] * alto / logo.size[1]))
    p = logo.resize((ancho, alto), Image.LANCZOS)
    lienzo.paste(p, ((px - ancho) // 2, margen), p)
    return lienzo.convert("RGB")

favicon(180).save(os.path.join(OUT, "apple-touch-icon.png"))
favicon(512).save(os.path.join(OUT, "favicon-512.png"))
favicon(32).save(os.path.join(OUT, "favicon.png"))
ico = favicon(64)
ico.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
for n in ("favicon.png", "favicon.ico", "apple-touch-icon.png", "favicon-512.png"):
    print("  %-22s %d bytes" % (n, os.path.getsize(os.path.join(OUT, n))))
