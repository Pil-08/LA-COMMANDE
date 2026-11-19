/* Demos de La Commande · comportamiento común. Sin librerías.
   Lo esencial (tarifas o género, horario, contacto, dirección) se lee y funciona sin este archivo.
   Cada página pone su configuración antes: window.LOCAL = { horario: {0: [[ini, fin], …], …}, mapa: {q, titulo} }
   Las horas van en minutos desde las 00:00 (9:30 = 570). Un día sin tramos está cerrado. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var C = window.LOCAL || {};
  var quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Cabecera: transparente sobre la portada, sólida al bajar */
  var cabecera = document.getElementById('cabecera');
  if (cabecera) {
    var colocar = function () { cabecera.classList.toggle('cabecera--solida', window.scrollY > 40); };
    colocar();
    window.addEventListener('scroll', colocar, { passive: true });

    /* Menú en pantallas estrechas: con él abierto, el resto de la página no recibe foco */
    var botonMenu = cabecera.querySelector('.menu-boton');
    var menu = document.getElementById('menu');
    if (botonMenu && menu) {
      var tapados = document.querySelectorAll('main, footer');
      var poner = function (abrir) {
        cabecera.classList.toggle('cabecera--menu', abrir);
        botonMenu.setAttribute('aria-expanded', abrir ? 'true' : 'false');
        document.body.style.overflow = abrir ? 'hidden' : '';
        tapados.forEach(function (e) { e.inert = abrir; });
      };
      botonMenu.addEventListener('click', function () { poner(!cabecera.classList.contains('cabecera--menu')); });
      menu.addEventListener('click', function (e) { if (e.target.closest('a')) poner(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && cabecera.classList.contains('cabecera--menu')) { poner(false); botonMenu.focus(); }
      });
      window.matchMedia('(min-width: 62rem)').addEventListener('change', function () { poner(false); });
    }
  }

  /* Aparición al hacer scroll. Si el observador no responde a tiempo, se muestra todo. */
  var revelas = document.querySelectorAll('.revela');
  if (quieto || !('IntersectionObserver' in window)) {
    raiz.classList.add('todo-visible');
  } else {
    var respondio = false;
    var ver = new IntersectionObserver(function (entradas) {
      respondio = true;
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); ver.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revelas.forEach(function (el) { ver.observe(el); });
    setTimeout(function () { if (!respondio) raiz.classList.add('todo-visible'); }, 4000);
  }

  /* Abierto ahora / cerrado, con la hora de Donostia */
  var H = C.horario || {};
  var NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var hora = function (min) { return Math.floor(min / 60) + ':' + pad(min % 60); };
  var aLas = function (min) { return (Math.floor(min / 60) === 1 ? 'a la ' : 'a las ') + hora(min); };

  function ahora() {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return { dia: DIAS[p.weekday], min: Number(p.hour) * 60 + Number(p.minute) };
  }

  function estadoDe(a) {
    var hoy = H[a.dia] || [];
    for (var i = 0; i < hoy.length; i++) {
      if (a.min >= hoy[i][0] && a.min < hoy[i][1]) return { abierto: true, texto: 'Abierto ahora · cierra ' + aLas(hoy[i][1]) };
    }
    for (var n = 0; n < 8; n++) {
      var d = (a.dia + n) % 7, tramos = H[d] || [];
      for (var j = 0; j < tramos.length; j++) {
        if (n === 0 && tramos[j][0] <= a.min) continue;
        var cuando = n === 0 ? 'hoy' : (n === 1 ? 'mañana' : 'el ' + NOMBRES[d]);
        return { abierto: false, texto: 'Cerrado ahora · abre ' + cuando + ' ' + aLas(tramos[j][0]) };
      }
    }
    return null;
  }

  var estados = document.querySelectorAll('[data-estado]');
  var pintar = function () {
    if (!estados.length || typeof Intl === 'undefined') return;
    var a = ahora(), e = estadoDe(a);
    if (!e) return;
    estados.forEach(function (el) {
      if (el.textContent !== e.texto) el.textContent = e.texto;   // sin reescribirlo cada minuto: el lector de pantalla no lo repite
      el.classList.toggle('estado--abierto', e.abierto);
    });
    document.querySelectorAll('.horario tr[data-dia]').forEach(function (fila) {
      if (Number(fila.getAttribute('data-dia')) === a.dia) fila.setAttribute('aria-current', 'date');
      else fila.removeAttribute('aria-current');
    });
  };
  pintar();
  setInterval(pintar, 60000);

  /* Aviso de demo (botones que en la web real llevarían a un servicio externo) */
  var aviso = document.getElementById('aviso');
  if (aviso) {
    document.querySelectorAll('[data-abre="aviso"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        if (typeof aviso.showModal === 'function') { e.preventDefault(); aviso.showModal(); }
      });
    });
    aviso.addEventListener('click', function (e) {
      var r = aviso.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) aviso.close();
    });
  }

  /* Mapa de Google: no se carga hasta que la persona lo pide */
  var cargar = document.getElementById('mapa-cargar'), mapa = document.getElementById('mapa');
  if (cargar && mapa && C.mapa) {
    cargar.addEventListener('click', function () {
      var marco = document.createElement('iframe');
      marco.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(C.mapa.q) + '&z=17&hl=es&output=embed';
      marco.title = C.mapa.titulo;
      marco.loading = 'lazy';
      marco.referrerPolicy = 'no-referrer-when-downgrade';
      mapa.appendChild(marco);
      var a = mapa.querySelector('.mapa__aviso');
      if (a) a.remove();
      marco.tabIndex = -1;
      marco.focus();
    });
  }
})();
