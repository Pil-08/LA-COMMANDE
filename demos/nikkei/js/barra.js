/* Kaigan (demo de La Commande) · comportamiento. Sin librerías.
   Lo esencial de la página (carta, horario, teléfono, dirección) se lee y funciona sin este archivo. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hayObservador = 'IntersectionObserver' in window;

  /* Cabecera: transparente sobre la portada, sólida al bajar */
  var cabecera = document.getElementById('cabecera');
  var colocarCabecera = function () {
    cabecera.classList.toggle('cabecera--solida', window.scrollY > 40);
  };
  colocarCabecera();
  window.addEventListener('scroll', colocarCabecera, { passive: true });

  /* Menú en pantallas estrechas */
  var botonMenu = cabecera.querySelector('.menu-boton');
  var menu = document.getElementById('menu');
  /* Con el menú abierto, el resto de la página queda tapado: que el teclado y el lector de pantalla tampoco lleguen a ella */
  var tapados = document.querySelectorAll('main, footer, .salto');
  var taparResto = function (si) {
    tapados.forEach(function (e) { e.inert = si; });
  };
  var cerrarMenu = function () {
    cabecera.classList.remove('cabecera--menu');
    botonMenu.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    taparResto(false);
  };
  botonMenu.addEventListener('click', function () {
    var abrir = !cabecera.classList.contains('cabecera--menu');
    cabecera.classList.toggle('cabecera--menu', abrir);
    botonMenu.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    document.body.style.overflow = abrir ? 'hidden' : '';
    taparResto(abrir);
  });
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) cerrarMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && cabecera.classList.contains('cabecera--menu')) {
      cerrarMenu();
      botonMenu.focus();   // el enlace enfocado queda oculto al cerrar: el foco vuelve al botón en vez de perderse
    }
  });
  window.matchMedia('(min-width: 75rem)').addEventListener('change', cerrarMenu);

  /* Aparición al hacer scroll. Si el observador no llega a responder, se muestra todo. */
  var revelas = document.querySelectorAll('.revela');
  if (quieto || !hayObservador) {
    raiz.classList.add('todo-visible');
  } else {
    var respondio = false;
    var ver = new IntersectionObserver(function (entradas) {
      respondio = true;
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          ver.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revelas.forEach(function (el) { ver.observe(el); });
    setTimeout(function () {
      if (!respondio) raiz.classList.add('todo-visible');
    }, 4000);
  }

  /* Pausa de todas las animaciones de la página */
  var pausa = document.querySelector('.portada__pausa');
  if (pausa) {
    pausa.addEventListener('click', function () {
      var parado = raiz.classList.toggle('pausa');
      pausa.setAttribute('aria-label', parado ? 'Reanudar las animaciones de la página' : 'Pausar las animaciones de la página');
      pausa.querySelector('use').setAttribute('href', parado ? '#i-play' : '#i-pausa');
    });
  }

  /* Abierto ahora / cerrado, con la hora de Donostia. Minutos desde las 00:00; pasar de 1440 es cerrar de madrugada. */
  var HORARIO = { 0: [780, 1020], 1: null, 2: [780, 1410], 3: [780, 1410], 4: [780, 1410], 5: [780, 1500], 6: [780, 1500] };
  var NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var hhmm = function (min) { var m = min % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };

  function ahoraEnDonostia() {
    var partes = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach(function (p) { partes[p.type] = p.value; });
    return { dia: DIAS[partes.weekday], min: Number(partes.hour) * 60 + Number(partes.minute) };
  }

  function calcularEstado(a) {
    var hoy = HORARIO[a.dia];
    var ayer = HORARIO[(a.dia + 6) % 7];
    if (hoy && a.min >= hoy[0] && a.min < hoy[1]) {
      return { abierto: true, texto: 'Abierto ahora · cierra a las ' + hhmm(hoy[1]) };
    }
    if (ayer && ayer[1] > 1440 && a.min < ayer[1] - 1440) {
      return { abierto: true, texto: 'Abierto ahora · cierra a las ' + hhmm(ayer[1]) };
    }
    for (var n = 0; n < 7; n++) {
      var d = (a.dia + n) % 7;
      var h = HORARIO[d];
      if (!h || (n === 0 && a.min >= h[0])) continue;
      var cuando = n === 0 ? 'hoy' : (n === 1 ? 'mañana' : 'el ' + NOMBRES[d]);
      return { abierto: false, texto: 'Cerrado ahora · abre ' + cuando + ' a las ' + hhmm(h[0]) };
    }
    return null;
  }

  var estado = document.getElementById('estado');
  var pintarEstado = function () {
    if (!estado || typeof Intl === 'undefined') return;
    var a = ahoraEnDonostia();
    var e = calcularEstado(a);
    if (!e) return;
    if (estado.textContent !== e.texto) estado.textContent = e.texto;   // sin reescribirlo cada minuto: el lector de pantalla no lo repite
    estado.classList.toggle('estado--abierto', e.abierto);
    document.querySelectorAll('.horario tr').forEach(function (fila) {
      if (Number(fila.getAttribute('data-dia')) === a.dia) fila.setAttribute('aria-current', 'date');
      else fila.removeAttribute('aria-current');
    });
  };
  pintarEstado();
  setInterval(pintarEstado, 60000);

  /* Aviso del botón de reservas online (maqueta: no lleva a ningún sitio) */
  var aviso = document.getElementById('aviso-reserva');
  if (aviso) {
    document.querySelectorAll('[data-abre="aviso-reserva"]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (typeof aviso.showModal === 'function') aviso.showModal();
        else window.location.hash = '#reservas';
      });
    });
    aviso.addEventListener('click', function (e) {
      var r = aviso.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) aviso.close();
    });
  }

  /* Mapa de Google: no se carga hasta que la persona lo pide */
  var cargarMapa = document.getElementById('mapa-cargar');
  var mapa = document.getElementById('mapa');
  if (cargarMapa && mapa) {
    cargarMapa.addEventListener('click', function () {
      var marco = document.createElement('iframe');
      marco.src = 'https://maps.google.com/maps?q=43.3236,-1.9849&z=17&hl=es&output=embed';
      marco.title = 'Mapa de Google: Calle Itsasaro 12, Donostia (ejemplo)';
      marco.loading = 'lazy';
      marco.referrerPolicy = 'no-referrer-when-downgrade';
      mapa.appendChild(marco);
      var aviso = mapa.querySelector('.mapa__aviso');
      if (aviso) aviso.remove();
      marco.tabIndex = -1;
      marco.focus();
    });
  }

  /* Rastro de dibujitos del cursor sobre la portada: solo con ratón; se apaga con «reducir movimiento» y con el botón de pausa */
  if (window.RastroDibujitos) {
    RastroDibujitos.inicia(document.getElementById('inicio'), {
      dibujos: ['dibujos/nigiri.svg', 'dibujos/copa-pisco.svg', 'dibujos/aji-amarillo.svg', 'dibujos/palillos.svg', 'dibujos/limon.svg',
                'dibujos/pez.svg', 'dibujos/langostino.svg', 'dibujos/cebolla-morada.svg', 'dibujos/sake.svg', 'dibujos/ola.svg'],
      ancho: 360,
      activo: function () { return !raiz.classList.contains('pausa'); }
    });
  }
})();
