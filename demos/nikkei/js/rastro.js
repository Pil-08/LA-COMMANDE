/*
  Rastro de dibujitos: al mover el ratón por la portada van saliendo dibujos de línea del bar (nigiri, palillos, copa de pisco, ají amarillo...).
  Código propio, sin dependencias. No hace nada con pantalla táctil, con «reducir movimiento» ni mientras la página está en pausa.
*/
(function (global) {
  'use strict';

  var GENERICOS = [];  // la web pasa sus propios dibujos (web/dibujos/)

  function dibujoSvg(trazos, color, grosor) {
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color +
      '" stroke-width="' + grosor + '" stroke-linecap="round" stroke-linejoin="round">' + trazos + '</svg>');
  }

  function ponEstilo() {
    if (document.getElementById('rastro-dibujitos-estilo')) return;
    var s = document.createElement('style');
    s.id = 'rastro-dibujitos-estilo';
    s.textContent =
      '.rastro-dibujitos{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:30}' +
      '.rastro-dibujitos img{position:absolute;left:0;top:0;height:auto;opacity:0;pointer-events:none;user-select:none;will-change:transform,opacity}';
    document.head.appendChild(s);
  }

  function inicia(zona, opciones) {
    var apagado = function () {};
    if (!zona || !global.matchMedia || !zona.animate) return apagado;
    var fino = global.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fino || global.matchMedia('(prefers-reduced-motion: reduce)').matches) return apagado;

    var o = {dibujos: null, color: '#fff', grosor: 0.4, umbral: 110, espera: 80, ancho: 340, maximo: 8, dura: 1000, giro: 8, activo: null};
    for (var k in (opciones || {})) o[k] = opciones[k];
    var lista = o.dibujos && o.dibujos.length ? o.dibujos : GENERICOS.map(function (t) { return dibujoSvg(t, o.color, o.grosor); });
    lista.forEach(function (u) { new Image().src = u; });                      // precarga: el primer dibujo ya sale sin parpadeo

    if (!lista.length) return apagado;

    ponEstilo();
    var capa = document.createElement('div');
    capa.className = 'rastro-dibujitos';
    capa.setAttribute('aria-hidden', 'true');
    document.body.appendChild(capa);

    var reserva = [], vivos = 0, turno = 0, ultimo = null, ultimoT = 0;

    function toma() {
      var el = reserva.pop();
      if (!el) { el = new Image(); el.alt = ''; el.decoding = 'async'; capa.appendChild(el); }
      return el;
    }

    function suelta(x, y) {
      var el = toma();
      vivos++;
      el.src = lista[turno];
      turno = (turno + 1) % lista.length;
      el.style.width = Math.min(o.ancho, global.innerWidth * 0.32) + 'px';
      var giro = (Math.random() * 2 - 1) * o.giro;
      var base = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%) rotate(' + giro.toFixed(1) + 'deg)';
      var anim = el.animate([
        {opacity: 0, transform: base + ' scale(.8)', easing: 'cubic-bezier(.16,1,.3,1)'},
        {opacity: 1, transform: base + ' scale(1)', offset: 0.4, easing: 'ease-in'},
        {opacity: 0, transform: base + ' scale(1.05)'}
      ], {duration: o.dura, fill: 'both'});
      anim.onfinish = function () { vivos--; reserva.push(el); };
    }

    function alMover(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (document.hidden || (typeof o.activo === 'function' && !o.activo())) return;   // p. ej. un botón de pausa de la web
      if (!ultimo) { ultimo = {x: e.clientX, y: e.clientY}; return; }          // el primer movimiento solo fija el punto de partida
      var dx = e.clientX - ultimo.x, dy = e.clientY - ultimo.y, ahora = performance.now();
      if (dx * dx + dy * dy < o.umbral * o.umbral || ahora - ultimoT < o.espera || vivos >= o.maximo) return;
      ultimo = {x: e.clientX, y: e.clientY};
      ultimoT = ahora;
      suelta(e.clientX, e.clientY);
    }
    function alSalir() { ultimo = null; }                                         // al volver a entrar no sale un dibujo de golpe

    zona.addEventListener('pointermove', alMover, {passive: true});
    zona.addEventListener('pointerleave', alSalir, {passive: true});

    apagado = function () {
      zona.removeEventListener('pointermove', alMover);
      zona.removeEventListener('pointerleave', alSalir);
      if (capa.parentNode) capa.parentNode.removeChild(capa);
    };
    return apagado;
  }

  global.RastroDibujitos = {inicia: inicia};
})(window);
