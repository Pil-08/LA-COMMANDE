(() => {
  'use strict';
  const root = document.documentElement;

  // Los títulos de sección entran palabra a palabra al llegar a la pantalla.
  // Sin JavaScript se quedan como texto normal; con «reducir movimiento» solo cambia la opacidad.
  function splitWords(node, counter) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        const fragment = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { fragment.append(part); continue; }
          const word = document.createElement('span');
          word.className = 'title-word';
          word.style.setProperty('--i', counter.n++);
          word.textContent = part;
          fragment.append(word);
        }
        child.replaceWith(fragment);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        splitWords(child, counter);
      }
    }
  }
  const titles = document.querySelectorAll('main section h2');
  titles.forEach(title => splitWords(title, {n: 0}));
  root.classList.add('titles-ready');
  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        watcher.unobserve(entry.target);
      }
    }, {threshold: .35, rootMargin: '0px 0px -8% 0px'});
    titles.forEach(title => watcher.observe(title));
  } else {
    titles.forEach(title => title.classList.add('is-in'));
  }

  if (!window.HTMLDialogElement?.prototype.showModal) return;

  const looks = JSON.parse(document.getElementById('looks-data').textContent);
  const booking = JSON.parse(document.getElementById('booking-data').textContent);
  const cards = Array.from(document.querySelectorAll('.look-card'));
  const moreButton = document.getElementById('more-looks');
  const status = document.getElementById('status');
  const header = document.querySelector('.topbar');
  const menuButton = document.getElementById('menu-toggle');
  const mobile = window.matchMedia('(max-width: 760px)');
  const twoColumnGallery = window.matchMedia('(min-width: 581px) and (max-width: 960px)');
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('dialog-content');
  const closeButton = document.getElementById('close-dialog');
  const form = document.getElementById('booking-form');
  const storeKey = 'orvela:seleccion:v1';
  let filter = 'Todos';
  let expanded = false;

  function readSaved() {
    try {
      const values = JSON.parse(localStorage.getItem(storeKey) || '[]');
      return new Set(Array.isArray(values) ? values.filter(key => Object.hasOwn(looks, key)) : []);
    } catch {
      return new Set();
    }
  }
  let saved = readSaved();

  function refreshCollection() {
    let shown = 0;
    const previewCount = twoColumnGallery.matches ? 4 : 3;
    for (const [index, card] of cards.entries()) {
      const sameCategory = filter === 'Todos' || card.dataset.category === filter;
      const inPreview = filter !== 'Todos' || expanded || index < previewCount;
      card.hidden = !(sameCategory && inPreview);
      if (!card.hidden) shown++;
    }
    moreButton.parentElement.hidden = filter !== 'Todos';
    moreButton.setAttribute('aria-expanded', String(expanded));
    moreButton.textContent = expanded ? 'Mostrar la selección inicial' : 'Ver los seis diseños';
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });
    return shown;
  }

  function refreshSaved() {
    const count = document.getElementById('saved-count');
    count.textContent = String(saved.size);
    count.hidden = !saved.size;
    const label = saved.size === 1 ? '1 diseño guardado' : saved.size + ' diseños guardados';
    document.getElementById('open-saved').setAttribute('aria-label', 'Mi selección, ' + label);
    document.querySelectorAll('[data-save]').forEach(button => {
      const key = button.dataset.save;
      const selected = saved.has(key);
      button.setAttribute('aria-pressed', String(selected));
      const action = selected ? 'Quitar ' + looks[key].name + ' de mi selección' : 'Guardar ' + looks[key].name;
      button.title = action;
      if (button.classList.contains('detail-save')) {
        // The accessible name starts with the visible word; aria-pressed tells whether it is saved.
        const visible = selected ? 'Guardado' : 'Guardar';
        button.querySelector('span').textContent = visible;
        button.setAttribute('aria-label', visible + ': ' + looks[key].name);
      } else {
        button.setAttribute('aria-label', action);
      }
    });
  }

  function toggleSaved(key) {
    if (!Object.hasOwn(looks, key)) return;
    if (saved.has(key)) saved.delete(key);
    else saved.add(key);
    try { localStorage.setItem(storeKey, JSON.stringify([...saved])); } catch { /* Keep the session selection in memory. */ }
    refreshSaved();
    status.textContent = looks[key].name + (saved.has(key) ? ' se ha añadido a tu selección.' : ' se ha quitado de tu selección.');
  }

  function setMenu(open) {
    header.classList.toggle('nav-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  // Cita: el formulario redacta el mensaje de WhatsApp a medida que se elige.
  function bookingMessage() {
    const data = new FormData(form);
    const service = booking.services[data.get('servicio')];
    const design = looks[data.get('diseno')];
    const day = data.get('dia');
    const slot = data.get('franja');
    const name = String(data.get('nombre') || '').trim().replace(/\s+/g, ' ');
    let text = 'Hola, Orvela. Me gustaría pedir cita para ' + service.phrase;
    text += design ? ', con el diseño ' + design.name + '.' : '.';
    text += day === 'cualquiera' ? ' Me viene bien cualquier día por la ' + slot + '.' : ' Si puede ser, el ' + booking.days[day].toLowerCase() + ' por la ' + slot + '.';
    if (name) text += ' Soy ' + name + '.';
    return text;
  }

  function refreshBooking() {
    const day = form.elements.dia.value;
    const morningOnly = booking.morningOnly.includes(day);
    const afternoon = form.querySelector('input[name="franja"][value="tarde"]');
    afternoon.disabled = morningOnly;
    if (morningOnly && afternoon.checked) form.querySelector('input[name="franja"][value="mañana"]').checked = true;
    document.getElementById('franja-note').hidden = !morningOnly;
    const text = bookingMessage();
    document.getElementById('b-message').textContent = text;
    document.getElementById('b-send').href = 'https://wa.me/' + booking.phone + '?text=' + encodeURIComponent(text);
  }

  // Cada diseño pide un tratamiento: elegir uno ajusta el otro para que el mensaje no se contradiga.
  function selectService(service) {
    const option = form.querySelector('input[name="servicio"][value="' + service + '"]');
    if (option) option.checked = true;
  }
  function keepDesignInService() {
    const design = looks[form.elements.diseno.value];
    if (design && design.service !== form.elements.servicio.value) form.elements.diseno.value = '';
  }

  function prepareBooking({service, design}) {
    if (design !== undefined) form.elements.diseno.value = design;
    if (service) selectService(service);
    keepDesignInService();
    refreshBooking();
  }

  function cloneTemplate(name) {
    const fragment = document.getElementById(name + '-template').content.cloneNode(true);
    content.replaceChildren(fragment);
    overlay.dataset.view = name;
    content.scrollTop = 0;
  }

  function showDialog() {
    setMenu(false);
    if (!overlay.open) {
      overlay.showModal();
    }
    closeButton.focus({preventScroll: true});
  }

  function openDetail(key) {
    const look = looks[key];
    if (!look) return;
    cloneTemplate('detail');
    const fields = ['category', 'name', 'note', 'tone', 'shape', 'finish', 'serviceName', 'serviceMeta'];
    for (const field of fields) content.querySelector('[data-detail-' + field.toLowerCase() + ']').textContent = look[field];
    const picture = content.querySelector('[data-detail-photo]');
    picture.alt = look.alt;
    picture.src = look.photo;
    content.querySelector('.detail-save').dataset.save = key;
    const bookLink = content.querySelector('[data-book-look]');
    bookLink.dataset.bookLook = key;
    bookLink.setAttribute('aria-label', 'Pedir cita con este diseño: ' + look.name);
    refreshSaved();
    showDialog();
  }

  function renderSavedList() {
    const list = content.querySelector('.saved-list');
    list.replaceChildren();
    if (!saved.size) {
      const note = document.createElement('p');
      note.className = 'empty-saved';
      note.textContent = 'Guarda los diseños que te gusten con el marcador de cada fotografía. Los encontrarás aquí cuando vuelvas.';
      list.append(note);
      return;
    }
    for (const key of saved) {
      const look = looks[key];
      const row = document.createElement('div');
      row.className = 'saved-item';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'saved-look';
      open.dataset.openLook = key;
      open.setAttribute('aria-label', 'Ver ficha de ' + look.name);
      const thumb = document.createElement('img');
      thumb.src = look.preview;
      thumb.alt = '';
      const name = document.createElement('span');
      name.textContent = look.name;
      open.append(thumb, name);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'saved-remove';
      remove.dataset.remove = key;
      remove.setAttribute('aria-label', 'Quitar ' + look.name + ' de mi selección');
      remove.title = remove.getAttribute('aria-label');
      remove.append(closeButton.querySelector('svg').cloneNode(true));
      row.append(open, remove);
      list.append(row);
    }
  }

  function goTo(hash, focusSelector) {
    if (overlay.open) overlay.close();
    const target = document.querySelector(hash);
    if (!target) return;
    const focusTarget = target.querySelector(focusSelector || 'h2');
    if (focusTarget) {
      if (focusTarget.matches('h2')) focusTarget.tabIndex = -1;
      focusTarget.focus({preventScroll: true});
    }
    if (location.hash !== hash) history.pushState(null, '', hash);
    target.scrollIntoView({block: 'start'});
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button,a');
    if (!header.contains(event.target)) setMenu(false);
    if (!button) return;
    if (button === menuButton) {
      setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
    } else if (button.closest('#nav') || button.matches('.brand')) {
      setMenu(false);
    } else if (button.hasAttribute('data-filter')) {
      filter = button.dataset.filter;
      expanded = false;
      const shown = refreshCollection();
      status.textContent = shown + ' diseños visibles.';
    } else if (button === moreButton) {
      expanded = !expanded;
      const shown = refreshCollection();
      status.textContent = shown + ' diseños visibles.';
      if (!expanded) document.getElementById('coleccion').scrollIntoView();
    } else if (button.hasAttribute('data-open-look')) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openDetail(button.dataset.openLook);
    } else if (button.hasAttribute('data-save')) {
      toggleSaved(button.dataset.save);
    } else if (button.hasAttribute('data-remove')) {
      const row = button.closest('.saved-item');
      const index = [...row.parentElement.children].indexOf(row);
      toggleSaved(button.dataset.remove);
      renderSavedList();
      const remaining = content.querySelectorAll('.saved-remove');
      (remaining[Math.min(index, remaining.length - 1)] || content.querySelector('.explore-saved')).focus();
    } else if (button.id === 'open-saved') {
      cloneTemplate('saved');
      renderSavedList();
      showDialog();
    } else if (button === closeButton) {
      overlay.close();
    } else if (button.hasAttribute('data-book-look')) {
      event.preventDefault();
      const look = looks[button.dataset.bookLook];
      prepareBooking({service: look.service, design: button.dataset.bookLook});
      goTo('#cita', 'input[name="servicio"]:checked');
      status.textContent = 'Cita preparada para ' + look.serviceName + ' con el diseño ' + look.name + '.';
    } else if (button.hasAttribute('data-book-service')) {
      event.preventDefault();
      prepareBooking({service: button.dataset.bookService});
      goTo('#cita', 'input[name="servicio"]:checked');
      status.textContent = 'Cita preparada para ' + booking.services[button.dataset.bookService].name + '.';
    } else if (button.matches('.explore-saved')) {
      event.preventDefault();
      goTo(button.hash);
    }
  });

  form.addEventListener('change', event => {
    if (event.target.name === 'diseno' && looks[event.target.value]) selectService(looks[event.target.value].service);
    if (event.target.name === 'servicio') keepDesignInService();
    refreshBooking();
  });
  form.addEventListener('input', refreshBooking);
  form.addEventListener('submit', event => {
    event.preventDefault();
    window.open(document.getElementById('b-send').href, '_blank', 'noopener');
  });

  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      const rect = overlay.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) overlay.close();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('nav-open')) {
      setMenu(false);
      menuButton.focus();
    }
  });
  header.addEventListener('focusout', event => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) setMenu(false);
  });
  mobile.addEventListener('change', () => setMenu(false));
  twoColumnGallery.addEventListener('change', () => {
    if (!twoColumnGallery.matches && cards[3]?.contains(document.activeElement)) expanded = true;
    refreshCollection();
  });
  window.addEventListener('storage', event => {
    if (event.key !== storeKey && event.key !== null) return;
    saved = readSaved();
    refreshSaved();
    if (overlay.open && overlay.dataset.view === 'saved') renderSavedList();
  });
  function openLinkedService() {
    const target = document.getElementById(location.hash.slice(1));
    if (target?.matches('details.service')) target.open = true;
  }
  window.addEventListener('hashchange', openLinkedService);
  refreshCollection();
  refreshSaved();
  refreshBooking();
  openLinkedService();
  root.classList.add('enhanced');
})();

// Demo de La Commande: en el móvil la etiqueta «Demo» no tapa la portada; aparece al bajar.
(() => {
  const label = document.querySelector('.demo'), cover = document.querySelector('.hero');
  if (!label || !cover || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(entries => label.classList.toggle('demo--oculta', entries[0].intersectionRatio > 0.35),
    {threshold: [0, 0.35, 0.7]}).observe(cover);
})();
