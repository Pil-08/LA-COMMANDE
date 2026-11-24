// Cloudflare Pages sirve los ficheros enteros aunque el navegador pida un trozo (cabecera Range), y Safari en el
// iPhone y el Mac no reproduce un vídeo si no se lo dan por trozos. Esta función solo atiende a los vídeos de la
// portada de Amu (demos/pescaderia/media/): coge el fichero y devuelve el trozo pedido con «206 Partial Content».
export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  // La revalidación pasa tal cual: si el navegador ya lo tiene, Pages contesta 304 y no se vuelve a bajar
  const pide = new Headers();
  const etiqueta = request.headers.get('If-None-Match');
  if (etiqueta) pide.set('If-None-Match', etiqueta);
  const entero = await env.ASSETS.fetch(new Request(request.url, { headers: pide }));
  if (!entero.ok) return entero;

  const cabeceras = new Headers(entero.headers);
  cabeceras.set('Accept-Ranges', 'bytes');
  cabeceras.delete('Content-Encoding');
  let rango = request.headers.get('Range');
  // If-Range: si el fichero ha cambiado desde que se pidió el primer trozo, va entero
  const siRango = request.headers.get('If-Range');
  if (rango && siRango && siRango !== entero.headers.get('ETag')) rango = null;
  if (!rango) {
    return new Response(request.method === 'HEAD' ? null : entero.body, { status: 200, headers: cabeceras });
  }

  // El tamaño sale de la cabecera; solo si falta se lee el fichero para medirlo
  let datos = null;
  let total = Number(entero.headers.get('Content-Length'));
  if (!(total > 0)) {
    datos = await entero.arrayBuffer();
    total = datos.byteLength;
  }
  const m = /^bytes=(\d*)-(\d*)$/.exec(rango.trim());
  let ini, fin;
  if (m && m[1] !== '') {
    ini = Number(m[1]);
    fin = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  } else if (m && m[2] !== '') {
    ini = Math.max(0, total - Number(m[2]));
    fin = total - 1;
  }
  if (ini === undefined || ini >= total || ini > fin) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}`, 'Accept-Ranges': 'bytes' } });
  }
  cabeceras.set('Content-Range', `bytes ${ini}-${fin}/${total}`);
  cabeceras.set('Content-Length', String(fin - ini + 1));
  if (request.method === 'HEAD') return new Response(null, { status: 206, headers: cabeceras });
  // El fichero entero («bytes=0-», lo primero que piden Chrome, Firefox y Safari) pasa sin cargarlo en memoria
  if (ini === 0 && fin === total - 1 && !datos) return new Response(entero.body, { status: 206, headers: cabeceras });
  if (!datos) datos = await entero.arrayBuffer();
  return new Response(datos.slice(ini, fin + 1), { status: 206, headers: cabeceras });
}
