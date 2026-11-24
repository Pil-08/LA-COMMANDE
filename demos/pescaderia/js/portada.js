/* Amu · vídeo de la portada.
   - La foto (su primer fotograma) se ve desde el principio; el vídeo se pide cuando la página ya ha cargado.
   - Pantallas verticales: otra versión, más ligera y encuadrada en el barco.
   - Con «reducir movimiento» o ahorro de datos no se descarga ni arranca: el botón lo ofrece («Ver el vídeo»).
   - Fuera de la pantalla se para. Se puede parar siempre (WCAG 2.2.2), y lo que decide quien la mira manda. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var portada = document.querySelector('.portada');
  var video = document.querySelector('.portada__video');
  var boton = document.querySelector('[data-pausa]');
  if (!portada || !video || !boton || raiz.classList.contains('shot')) return;
  if (!video.canPlayType || !video.canPlayType('video/mp4; codecs="avc1.640028"')) { boton.hidden = true; return; }

  var menos = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* La misma consulta que la franja vertical de estilos.css y que el <source> de la foto: si cambia una, cambian las tres */
  var vertical = window.matchMedia('(max-aspect-ratio: 4/5), (max-width: 56rem) and (orientation: portrait) and (min-height: 37.5rem)');
  var quiere = !raiz.classList.contains('quieto');
  var listo = document.readyState === 'complete';
  var seVe = true;
  var cargado = '';

  function carga() {
    var fuente = video.getAttribute(vertical.matches ? 'data-vertical' : 'data-ancho');
    if (fuente === cargado) return;
    var segundo = cargado ? video.currentTime : 0;
    cargado = fuente;
    video.muted = true;
    video.src = fuente;
    if (segundo) video.addEventListener('loadedmetadata', function () { video.currentTime = segundo; }, { once: true });
  }

  function pon() {
    raiz.classList.toggle('quieto', !quiere);
    if (!quiere) raiz.classList.add('video-listo');   /* parado: el botón ya puede ofrecerlo */
    if (!quiere || !seVe) {
      if (cargado) video.pause();
      return;
    }
    if (!listo) return;
    carga();
    var intento = video.play();
    if (intento && intento.catch) {
      intento.catch(function (e) {
        /* El navegador no deja arrancar solo (p. ej., el ahorro de batería del iPhone): queda el botón */
        if (e.name === 'NotAllowedError') { quiere = false; pon(); }
      });
    }
  }

  function alCambiar(consulta, hacer) {
    if (consulta.addEventListener) consulta.addEventListener('change', hacer);
    else if (consulta.addListener) consulta.addListener(hacer);
  }

  boton.addEventListener('click', function () {
    quiere = !quiere;
    listo = true;
    pon();
  });
  video.addEventListener('playing', function () {
    video.classList.add('portada__video--va');
    boton.hidden = false;
    raiz.classList.add('video-listo');
  });
  video.addEventListener('error', function () {
    video.classList.remove('portada__video--va');
    boton.hidden = true;
  });

  /* Si se pide menos movimiento, se para; si se deja de pedir, no se arranca solo: decide quien la mira */
  alCambiar(menos, function () { if (menos.matches) { quiere = false; pon(); } });
  /* Al girar, la otra versión se carga si está en marcha. Si está parado, se quita el fotograma de la versión anterior
     (ya no encaja) y queda la foto, que cambia sola; la otra versión se carga al volver a ponerlo. */
  alCambiar(vertical, function () {
    if (!cargado) return;
    if (quiere) { carga(); pon(); } else video.classList.remove('portada__video--va');
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entradas) {
      seVe = entradas[entradas.length - 1].isIntersecting;
      pon();
    }).observe(portada);
  }
  if (!listo) window.addEventListener('load', function () { listo = true; pon(); }, { once: true });
  window.addEventListener('pageshow', function (e) { if (e.persisted) pon(); });
  pon();
})();
