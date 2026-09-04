# -*- coding: utf-8 -*-
"""Deja el bundle de LA COMMANDE listo para produccion, de una sola pasada.

    python preparar-web.py "LA COMMANDE.html" "LA COMMANDE - web.html"

Hace cuatro cosas, todas idempotentes (se puede reejecutar sin romper nada):

  1. RECORTA LAS FUENTES. Las 9 woff2 son Google Fonts partidas por
     unicode-range. Al ir embebidas, cada visitante se descarga tambien los
     glifos de cirilico, griego y vietnamita que la web no usa jamas.
     Se recortan al juego de caracteres real + margen de Europa occidental.

  2. PASA LAS IMAGENES A WEBP. Eran PNG, que es formato de graficos, no de
     fotografia.

  3. ARREGLA LA CABECERA:
       - <html lang="es">            (accesibilidad y SEO)
       - quita los preconnect a Google Fonts, muertos desde que las fuentes
         van embebidas (y ademas evita una conexion a Google en cada visita)
       - anade favicon, apple-touch-icon y theme-color

  4. ARREGLA EL RESPONSIVE MOVIL. La web trae esta regla propia:

         @media (max-width: 600px) {
           #heroTitle { font-size: 15vw !important; ... }
         }

     15vw NO CABE en ningun ancho de ese rango: el titulo necesita 6.587px
     de ancho por cada px de fuente y el contenedor solo tiene el ancho de
     la pantalla menos unos 66px de margenes. A 375px pedia 370px para 307
     disponibles, y a 482px pedia 474 para 405.

     Se corrige la regla EN SU SITIO cambiando 15vw por min(15vw, 14cqi):
     manda el 15vw del diseno cuando cabe, y si no, el tope del 14% del
     ancho del CONTENEDOR, que se adapta solo aunque cambien los margenes.
     Requiere container-type en #heroTicket, que se anade aparte.
     Por encima de 600px no se toca nada.

     Se anade ademas text-size-adjust: 100% para que Chrome en Android no
     agrande el texto por su cuenta.

DOS TRAMPAS DEL FORMATO, no tocar sin leer esto
-----------------------------------------------
  a) La plantilla va como cadena JSON dentro de un <script>. El bundler
     escapa la barra de las etiquetas de cierre como u002F (precedida de
     barra invertida) para que un </script> del contenido no cierre el
     <script> contenedor. json.dumps de Python NO respeta eso y corrompe el
     bundle ("Error unpacking: Unterminated string in JSON"). Por eso aqui
     se edita SIEMPRE la cadena JSON cruda, nunca decodificando y
     recodificando.

  b) El CSS hay que inyectarlo al FINAL del <body>, no en el <head>: el
     framework del sitio reconstruye el DOM al arrancar y una hoja puesta
     en el head pierde la cascada (la regla se parsea bien pero no aplica).
"""
import re
import io
import os
import sys
import json
import gzip
import base64

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image

BS = chr(92)          # barra invertida literal, sin ambiguedad de escapes
Q = BS + '"'          # comilla escapada, tal como aparece dentro del JSON
MARCA = "/*prep-web*/"

CIERRE_HEAD = "<" + BS + "u002Fhead>"
CIERRE_BODY = "<" + BS + "u002Fbody>"
CIERRE_STYLE = "<" + BS + "u002Fstyle>"

CSS = (
    # que Chrome en Android no agrande el texto por su cuenta
    "html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%}"
    # necesario para que las unidades cqi del titulo se resuelvan
    "#heroTicket{container-type:inline-size}"
)

# La regla propia de la web, y su version corregida. Se cambia en su sitio
# (dentro del @media max-width:600px del propio diseno) en vez de anadir
# otra regla encima.
REGLA_ROTA = "font-size: 15vw !important"
REGLA_OK = "font-size: min(15vw, 14cqi) !important"

CABECERA = (
    "<link rel=" + Q + "icon" + Q + " href=" + Q + "/favicon.ico" + Q + " sizes=" + Q + "any" + Q + ">"
    "<link rel=" + Q + "icon" + Q + " type=" + Q + "image/png" + Q + " href=" + Q + "/favicon.png" + Q + ">"
    "<link rel=" + Q + "apple-touch-icon" + Q + " href=" + Q + "/apple-touch-icon.png" + Q + ">"
    "<meta name=" + Q + "theme-color" + Q + " content=" + Q + "#FF231D" + Q + ">"
)


def carga(e):
    bruto = base64.b64decode(e["data"])
    return gzip.decompress(bruto) if e.get("compressed") else bruto


def juego_de_caracteres(plantilla, manifiesto):
    """Caracteres que la web usa de verdad, mas margen para ES/EU/EN."""
    chars = set(plantilla)
    for e in manifiesto.values():
        if e["mime"].startswith("text"):
            try:
                chars |= set(carga(e).decode("utf-8", "ignore"))
            except Exception:
                pass
    chars |= {chr(c) for c in range(0x20, 0x7F)}
    chars |= set(
        "áéíóúüñçàèìòùâêîôûäëïöãõåæø"
        "ÁÉÍÓÚÜÑÇÀÈÌÒÙÂÊÎÔÛÄËÏÖÃÕÅÆØ"
        "¿¡ºªß"
        "…–—‘’“”•·«»°€£¥©®™±×÷"
        "→←↑↓✓✔✕✗★☆№"
    )
    return {c for c in chars if c.isprintable() or c == " "}


def recorta_fuentes(manifiesto, chars):
    filas = []
    for e in manifiesto.values():
        if not e["mime"].startswith("font"):
            continue
        antes = len(e["data"])
        datos = carga(e)
        fuente = TTFont(io.BytesIO(datos), fontNumber=0)
        tiene = set(fuente.getBestCmap().keys())
        quiero = {ord(c) for c in chars} & tiene
        nombre = next((r.toUnicode() for r in fuente["name"].names if r.nameID == 4), "?")

        op = subset.Options()
        op.flavor = "woff2"
        op.desubroutinize = True
        op.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk"]
        op.name_IDs = [1, 2, 3, 4, 6]
        op.notdef_outline = False

        f2 = TTFont(io.BytesIO(datos), fontNumber=0)
        s = subset.Subsetter(options=op)
        s.populate(unicodes=quiero if quiero else {0x20})
        s.subset(f2)
        buf = io.BytesIO()
        f2.save(buf)

        e["data"] = base64.b64encode(buf.getvalue()).decode("ascii")
        e["compressed"] = False
        filas.append((nombre, len(tiene), len(quiero), antes, len(e["data"])))
    return filas


def imagenes_a_webp(manifiesto):
    filas = []
    for e in manifiesto.values():
        if not e["mime"].startswith("image") or e["mime"] == "image/webp":
            continue
        antes = len(e["data"])
        im = Image.open(io.BytesIO(carga(e)))
        buf = io.BytesIO()
        alfa = im.getchannel("A") if im.mode == "RGBA" else None
        if alfa is not None and alfa.getextrema()[0] < 255:
            im.save(buf, "WEBP", quality=90, method=6)
        else:
            im.convert("RGB").save(buf, "WEBP", quality=88, method=6)
        e["data"] = base64.b64encode(buf.getvalue()).decode("ascii")
        e["compressed"] = False
        e["mime"] = "image/webp"
        filas.append((im.size, antes, len(e["data"])))
    return filas


def arregla_plantilla(crudo):
    """Edita la cadena JSON CRUDA. Ver la nota (a) de la cabecera."""
    cambios = []

    if "<html lang=" not in crudo:
        n = crudo.count("<html>")
        if n != 1:
            sys.exit("ERROR: esperaba 1 <html>, encontrados %d" % n)
        crudo = crudo.replace("<html>", "<html lang=" + Q + "es" + Q + ">", 1)
        cambios.append('lang="es" anadido')

    quitados = len(re.findall(r'<link rel=\\"preconnect\\"[^>]*>', crudo))
    if quitados:
        crudo = re.sub(r'<link rel=\\"preconnect\\"[^>]*>', "", crudo)
        cambios.append("%d preconnect a Google Fonts eliminados" % quitados)

    if "apple-touch-icon" not in crudo:
        n = crudo.count(CIERRE_HEAD)
        if n != 1:
            sys.exit("ERROR: esperaba 1 cierre de head, encontrados %d" % n)
        crudo = crudo.replace(CIERRE_HEAD, CABECERA + CIERRE_HEAD, 1)
        cambios.append("favicon, apple-touch-icon y theme-color anadidos")

    if REGLA_ROTA in crudo:
        n = crudo.count(REGLA_ROTA)
        if n != 1:
            sys.exit("ERROR: esperaba 1 regla '15vw', encontradas %d" % n)
        crudo = crudo.replace(REGLA_ROTA, REGLA_OK, 1)
        cambios.append("regla del titulo corregida: 15vw -> min(15vw, 14cqi)")
    elif REGLA_OK not in crudo:
        print("AVISO: no aparece la regla 15vw del hero; revisa si el diseno cambio")

    if MARCA not in crudo:
        n = crudo.count(CIERRE_BODY)
        if n != 1:
            sys.exit("ERROR: esperaba 1 cierre de body, encontrados %d" % n)
        estilo = "<style>" + MARCA + CSS + CIERRE_STYLE
        crudo = crudo.replace(CIERRE_BODY, estilo + CIERRE_BODY, 1)
        cambios.append("text-size-adjust y container-type anadidos")

    return crudo, cambios


def main():
    entrada = sys.argv[1] if len(sys.argv) > 1 else "LA COMMANDE.html"
    salida = sys.argv[2] if len(sys.argv) > 2 else "LA COMMANDE - web.html"

    html = open(entrada, encoding="utf-8").read()
    bytes_antes = len(html.encode("utf-8"))

    m_man = re.search(r'(<script type="__bundler/manifest">)(.*?)(</script>)', html, re.S)
    m_tpl = re.search(r'(<script type="__bundler/template">)(.*?)(</script>)', html, re.S)
    if not m_man or not m_tpl:
        sys.exit("ERROR: el archivo no parece un bundle valido")

    manifiesto = json.loads(m_man.group(2).strip())
    crudo_tpl = m_tpl.group(2).strip()
    plantilla = json.loads(crudo_tpl)

    chars = juego_de_caracteres(plantilla, manifiesto)
    print("Caracteres conservados en las fuentes: %d" % len(chars))

    fuentes = recorta_fuentes(manifiesto, chars)
    imagenes = imagenes_a_webp(manifiesto)
    crudo_nuevo, cambios = arregla_plantilla(crudo_tpl)

    # Comprobar que la plantilla sigue siendo JSON valido ANTES de escribir
    nueva = json.loads(crudo_nuevo)
    assert MARCA in nueva, "el CSS no llego a la plantilla"
    assert "</style></body>" in nueva, "etiquetas mal cerradas"

    nuevo_man = json.dumps(manifiesto, separators=(",", ":"), ensure_ascii=False)
    out = (
        html[:m_man.start(2)] + "\n" + nuevo_man + "\n" +
        html[m_man.end(2):m_tpl.start(2)] + crudo_nuevo + html[m_tpl.end(2):]
    )
    open(salida, "w", encoding="utf-8", newline="").write(out)

    # ---- informe ----
    if fuentes:
        print("\nFUENTES")
        ta = td = 0
        for nombre, tiene, quiero, a, d in sorted(fuentes, key=lambda x: -x[3]):
            ta += a
            td += d
            print("  %8d -> %8d  glifos %4d->%-4d  %s" % (a, d, tiene, quiero, nombre))
        print("  %8d -> %8d  TOTAL (-%d%%)" % (ta, td, round((1 - td / ta) * 100)))
    if imagenes:
        print("\nIMAGENES")
        ta = td = 0
        for size, a, d in imagenes:
            ta += a
            td += d
            print("  %8d -> %8d  %dx%d" % (a, d, size[0], size[1]))
        print("  %8d -> %8d  TOTAL (-%d%%)" % (ta, td, round((1 - td / ta) * 100)))
    print("\nCABECERA Y RESPONSIVE")
    for c in cambios:
        print("  - " + c)
    if not cambios:
        print("  - ya estaba todo aplicado")

    bytes_despues = len(out.encode("utf-8"))
    print("\nARCHIVO  %d -> %d bytes  (-%d%%)" % (
        bytes_antes, bytes_despues, round((1 - bytes_despues / bytes_antes) * 100)))
    print("salida: %s" % salida)


if __name__ == "__main__":
    main()
