/* La Commande · un único guion, sin librerías.
   1) Enlaces de la web antigua de una sola página.  2) Fichas de los ejemplos.  3) Filtro de ejemplos.
   4) Presupuesto a la carta: marca, suma, aplica el plan que salga mejor y escribe el mensaje de WhatsApp.
   Sin JavaScript todo se lee igual; solo deja de sumarse el presupuesto. */
(function () {
  'use strict';
  var doc = document, cuerpo = doc.body;
  function todos(sel, raiz) { return [].slice.call((raiz || doc).querySelectorAll(sel)); }

  /* ---------- 1) quien llegue con un enlace de la página antigua (#presupuesto, #disenos) va a la página nueva ---------- */
  if (cuerpo.getAttribute('data-pagina') === 'inicio') {
    var viejos = {'#presupuesto': cuerpo.getAttribute('data-planes') + '#a-la-carta', '#disenos': cuerpo.getAttribute('data-ejemplos')};
    if (viejos[location.hash]) { location.replace(viejos[location.hash]); return; }
  }

  /* ---------- 2) fichas de los ejemplos (si el navegador no tiene <dialog>, el enlace lleva a la demo) ---------- */
  doc.addEventListener('click', function (ev) {
    var tarjeta = ev.target.closest ? ev.target.closest('[data-ficha]') : null;
    if (!tarjeta) return;
    var ficha = doc.getElementById(tarjeta.getAttribute('data-ficha'));
    if (!ficha || !ficha.showModal) return;
    ev.preventDefault();
    ficha.showModal();
  });
  todos('dialog.ficha').forEach(function (ficha) {
    ficha.addEventListener('click', function (ev) { if (ev.target === ficha) ficha.close(); });   // clic fuera: cerrar
  });

  /* ---------- 3) filtro de ejemplos por sector ---------- */
  var filtros = todos('[data-filtro]');
  filtros.forEach(function (boton) {
    boton.addEventListener('click', function () {
      var cual = boton.getAttribute('data-filtro');
      filtros.forEach(function (b) { b.setAttribute('aria-pressed', b === boton ? 'true' : 'false'); });
      todos('.ejemplo').forEach(function (tarjeta) { tarjeta.hidden = cual !== 'todos' && tarjeta.getAttribute('data-sector') !== cual; });
    });
  });

  /* ---------- 4) presupuesto ---------- */
  var caja = doc.getElementById('datos');
  if (!caja) return;
  var D = JSON.parse(caja.textContent), T = D.t;
  var sector = Object.keys(D.anadidos)[0], marcados = {};
  var lineas = doc.querySelector('[data-lineas]'), notaVacio = doc.querySelector('[data-vacio]'), notaAhorro = doc.querySelector('[data-ahorro]');
  var total = doc.querySelector('[data-total]'), botonWa = doc.querySelector('[data-wa]'), botonMail = doc.querySelector('[data-mail]');
  var nombre = doc.getElementById('nombre-negocio');

  function centimos(n) { return Math.round(n * 100); }
  function eur(c, signo) {
    var cifra = (c / 100).toFixed(2);
    var texto = D.idioma === 'en' ? '€' + cifra : cifra.replace('.', ',') + ' €';
    return (signo ? '+' : '') + texto;
  }
  function ids() { return Object.keys(marcados).filter(function (i) { return marcados[i] && D.anadidos[sector][i]; }); }
  function precio(i) { return centimos(D.anadidos[sector][i].precio); }
  function suma(lista) { return lista.reduce(function (s, i) { return s + precio(i); }, 0); }

  /* el total más barato: a la carta, o un plan (aunque lleve cosas sin marcar) más lo marcado que el plan no incluya */
  function mejor() {
    var m = ids(), res = {plan: D.planes[0], total: centimos(D.base) + suma(m), extras: m, suelto: centimos(D.base) + suma(m)};
    D.planes.slice(1).forEach(function (plan) {
      var existe = plan.incluye.every(function (i) { return D.anadidos[sector][i]; });   // el plan tiene sentido en este sector
      if (!existe) return;
      var extras = m.filter(function (i) { return plan.incluye.indexOf(i) < 0; });
      var t = centimos(plan.precio) + suma(extras);
      if (t < res.total) { res.plan = plan; res.total = t; res.extras = extras; }
    });
    return res;
  }
  function igual(a, b) { return a.length === b.length && a.every(function (i) { return b.indexOf(i) >= 0; }); }
  function nombres(lista) { return lista.map(function (i) { return D.anadidos[sector][i].nombre; }); }

  function mensaje(r) {
    var m = [T.msg_hola, T.msg_negocio + ': ' + D.sectores[sector]];
    var quien = (nombre && nombre.value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 70);
    if (quien) m.push(T.msg_local + ': ' + quien);
    m.push('');
    if (r.plan === D.planes[0]) m.push(T.web_base + ': ' + eur(centimos(D.base)) + ' / ' + T.por_mes);
    else m.push(T.plan + ' ' + r.plan.nombre + ': ' + eur(centimos(r.plan.precio)) + ' / ' + T.por_mes, '(' + T.msg_incluye + ': ' + nombres(r.plan.incluye).join(', ') + ')');
    m.push('', T.msg_anadidos + ':');
    if (r.extras.length) r.extras.forEach(function (i) { m.push('· ' + D.anadidos[sector][i].nombre + ' ' + eur(precio(i), true)); });
    else m.push('· ' + T.msg_ninguno);
    m.push('', T.total + ': ' + eur(r.total) + ' / ' + T.por_mes);
    return m.join('\n');
  }

  function fila(a, b, c, clase) {
    var li = doc.createElement('li');
    if (clase) li.className = clase;
    [a, b, c].forEach(function (texto) { var s = doc.createElement('span'); s.textContent = texto; li.appendChild(s); });
    return li;
  }

  function pinta() {
    var r = mejor(), m = ids();
    todos('.lista-anadidos[data-sector="' + sector + '"] input').forEach(function (c) { c.checked = !!marcados[c.getAttribute('data-id')]; });
    lineas.textContent = '';
    if (r.plan === D.planes[0]) lineas.appendChild(fila('1', T.web_base, eur(centimos(D.base))));
    else {
      lineas.appendChild(fila('1', T.plan + ' ' + r.plan.nombre, eur(centimos(r.plan.precio))));
      lineas.appendChild(fila('', T.msg_incluye + ': ' + nombres(r.plan.incluye).join(', '), '', 'es-incluido'));
    }
    r.extras.forEach(function (i) { lineas.appendChild(fila('1', D.anadidos[sector][i].nombre, eur(precio(i), true))); });
    notaVacio.hidden = m.length > 0;
    notaAhorro.hidden = r.plan === D.planes[0];
    if (!notaAhorro.hidden) notaAhorro.textContent = T.ahorro_plan.replace('{plan}', r.plan.nombre).replace('{x}', eur(r.suelto - r.total));
    total.textContent = eur(r.total);
    var texto = mensaje(r);
    botonWa.href = 'https://wa.me/' + D.whatsapp + '?text=' + encodeURIComponent(texto);
    botonMail.href = 'mailto:' + D.correo + '?subject=' + encodeURIComponent(T.msg_asunto) + '&body=' + encodeURIComponent(texto);
    var barra = doc.querySelector('[data-barra]');   // la barra del móvil lleva el mismo total y el mismo mensaje
    if (barra) { barra.href = botonWa.href; barra.querySelector('[data-barra-total]').textContent = eur(r.total); }
    todos('[data-plan]').forEach(function (b) {
      var plan = D.planes.filter(function (p) { return p.id === b.getAttribute('data-plan'); })[0];
      b.setAttribute('aria-pressed', igual(m, plan.incluye) ? 'true' : 'false');
    });
    todos('[data-atajo]').forEach(function (b) { b.setAttribute('aria-pressed', igual(m, b.getAttribute('data-atajo').split(',')) ? 'true' : 'false'); });
  }

  function marca(lista) {
    marcados = {};
    lista.forEach(function (i) { if (D.anadidos[sector][i]) marcados[i] = true; });
    pinta();
  }

  function ponSector(s) {
    if (!D.anadidos[s]) return;
    sector = s;
    todos('[data-sector]').forEach(function (el) { el.classList.toggle('es-actual', el.getAttribute('data-sector') === s); });
    todos('[data-sector-boton]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-sector-boton') === s ? 'true' : 'false'); });
    var atajos = doc.querySelector('[data-atajos]');
    if (atajos) atajos.hidden = s !== 'hosteleria';
    todos('[data-pedir]').forEach(function (a) {
      var plan = D.planes.filter(function (p) { return p.id === a.getAttribute('data-pedir'); })[0];
      var coste = eur(centimos(plan.precio)) + ' / ' + T.por_mes;
      a.href = 'https://wa.me/' + D.whatsapp + '?text=' + encodeURIComponent([T.msg_hola, T.msg_negocio + ': ' + D.sectores[s], '', T.plan + ' ' + plan.nombre + ': ' + coste, '', T.total + ': ' + coste].join('\n'));
    });
    Object.keys(marcados).forEach(function (i) { if (!D.anadidos[s][i]) delete marcados[i]; });
    pinta();
  }

  doc.addEventListener('change', function (ev) {
    var c = ev.target;
    if (!c.matches || !c.matches('.lista-anadidos input')) return;
    marcados[c.getAttribute('data-id')] = c.checked;
    pinta();
  });
  doc.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-plan], [data-atajo], [data-sector-boton], [data-ajustar], .anadido__info') : null;
    if (!el) return;
    if (el.hasAttribute('data-sector-boton')) { ponSector(el.getAttribute('data-sector-boton')); return; }
    if (el.classList.contains('anadido__info')) {
      var detalle = doc.getElementById(el.getAttribute('aria-controls')), abre = detalle.hidden;
      detalle.hidden = !abre;
      el.setAttribute('aria-expanded', abre ? 'true' : 'false');
      return;
    }
    var idPlan = el.getAttribute('data-plan') || el.getAttribute('data-ajustar');
    if (idPlan) {
      var plan = D.planes.filter(function (p) { return p.id === idPlan; })[0];
      var yaEsta = el.hasAttribute('data-plan') && el.getAttribute('aria-pressed') === 'true';
      marca(yaEsta ? [] : plan.incluye);
      if (el.hasAttribute('data-ajustar')) { ev.preventDefault(); doc.getElementById('a-la-carta').scrollIntoView(); }
      return;
    }
    marca(el.getAttribute('aria-pressed') === 'true' ? [] : el.getAttribute('data-atajo').split(','));
  });
  if (nombre) nombre.addEventListener('input', pinta);

  /* lo que venga en la dirección: ?sector=…&plan=…&marca=a,b */
  var q = {};
  location.search.replace(/^\?/, '').split('&').forEach(function (par) { var kv = par.split('='); if (kv[0]) try { q[kv[0]] = decodeURIComponent(kv[1] || ''); } catch (e) { q[kv[0]] = ''; } });
  ponSector(D.anadidos[q.sector] ? q.sector : sector);
  var planPedido = D.planes.filter(function (p) { return p.id === q.plan; })[0];
  if (planPedido) marca(planPedido.incluye);
  else if (q.marca) marca(q.marca.split(','));
})();
