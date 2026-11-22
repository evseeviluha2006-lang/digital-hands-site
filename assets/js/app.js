/* =========================================================
   HUSH.CORP — app.js
   Галерея, фильтры, лайтбокс, анимации
   ========================================================= */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* -------------------------------------------------------
     Состояние
     ------------------------------------------------------- */
  const state = {
    filter: 'all',
    visible: [], // индексы работ в текущей выборке
    current: 0, // позиция внутри visible
    lastFocused: null,
  };

  /* -------------------------------------------------------
     Заглушка: рисуем «постер» из палитры работы
     ------------------------------------------------------- */
  function placeholder(item, index) {
    const [c1, c2, accent] = item.colors || ['#141416', '#26262b', '#c8ff00'];
    const [rw, rh] = (item.ratio || '1/1').split('/').map(Number);
    const w = 1200;
    const h = Math.round((w * rh) / rw);
    const num = String(index + 1).padStart(2, '0');
    const stepX = w / 6;
    const stepY = h / 6;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2;

    let lines = '';
    for (let x = stepX; x < w; x += stepX) {
      lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" />`;
    }
    for (let y = stepY; y < h; y += stepY) {
      lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" />`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${c1}"/>
          <stop offset="1" stop-color="${c2}"/>
        </linearGradient>
        <radialGradient id="r" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="${accent}" stop-opacity="0.45"/>
          <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="v" cx="50%" cy="45%" r="72%">
          <stop offset="0.45" stop-color="#000000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0.45"/>
        </radialGradient>
        <filter id="n">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <ellipse cx="${w * 0.72}" cy="${h * 0.28}" rx="${w * 0.5}" ry="${h * 0.42}" fill="url(#r)"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 1.02}" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.66}" fill="none" stroke="${accent}" stroke-opacity="0.28" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
      <g stroke="#ffffff" stroke-opacity="0.055" stroke-width="1">${lines}</g>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
            font-family="Arial, sans-serif" font-size="${Math.min(w, h) * 0.3}"
            font-weight="700" fill="${accent}" fill-opacity="0.14"
            stroke="#ffffff" stroke-opacity="0.16" stroke-width="1.5"
            letter-spacing="-0.04em">${num}</text>
      <rect width="100%" height="100%" fill="url(#v)"/>
      <rect width="100%" height="100%" filter="url(#n)" opacity="0.2"/>
    </svg>`;

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* -------------------------------------------------------
     Медиа-источник для карточки / лайтбокса
     ------------------------------------------------------- */
  function sourceOf(item, index, big = false) {
    if (item.type === 'video' && item.src) {
      return { kind: 'video', src: item.src, poster: item.poster || '' };
    }
    if (item.src) return { kind: 'image', src: item.src };
    return { kind: 'image', src: placeholder(item, index) };
  }

  /* -------------------------------------------------------
     Отрисовка карточек
     ------------------------------------------------------- */
  const PLAY_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

  const gallery = $('[data-gallery]');

  function renderGallery() {
    const frag = document.createDocumentFragment();

    MEDIA.forEach((item, index) => {
      const isVideo = item.type === 'video';
      const posterSrc = isVideo
        ? item.poster || placeholder(item, index)
        : item.src || placeholder(item, index);

      const card = document.createElement('article');
      card.className = 'card';
      card.dataset.index = String(index);
      card.dataset.category = item.category;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Открыть работу: ${item.title}`);

      const media = document.createElement('div');
      media.className = 'card__media';
      media.style.aspectRatio = (item.ratio || '1/1').replace('/', ' / ');

      const img = document.createElement('img');
      img.src = posterSrc;
      img.alt = item.title;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener(
        'error',
        () => {
          img.src = placeholder(item, index);
        },
        { once: true }
      );
      media.appendChild(img);

      if (item.type === 'video') {
        const badge = document.createElement('span');
        badge.className = 'card__badge';
        badge.innerHTML = `${PLAY_ICON} видео`;
        media.appendChild(badge);
      }

      const idx = document.createElement('span');
      idx.className = 'card__index';
      idx.textContent = String(index + 1).padStart(2, '0');
      media.appendChild(idx);

      const open = document.createElement('span');
      open.className = 'card__open';
      open.textContent = 'смотреть';
      media.appendChild(open);

      const body = document.createElement('div');
      body.className = 'card__body';

      const title = document.createElement('h3');
      title.className = 'card__title';
      title.textContent = item.title;

      const meta = document.createElement('span');
      meta.className = 'card__meta';
      meta.textContent = `${item.category} · ${item.year}`;

      body.append(title, meta);
      card.append(media, body);
      frag.appendChild(card);
    });

    gallery.appendChild(frag);

    // появление при скролле
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const order = [...gallery.children].indexOf(el) % 9;
          el.style.transitionDelay = `${order * 45}ms`;
          el.classList.add('is-in');
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    $$('.card', gallery).forEach((card) => io.observe(card));

    // открытие лайтбокса
    gallery.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) openByCard(card);
    });
    gallery.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.card');
      if (!card) return;
      e.preventDefault();
      openByCard(card);
    });
  }

  /* -------------------------------------------------------
     Фильтры
     ------------------------------------------------------- */
  function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function applyFilter(value, reveal = true) {
    state.filter = value;
    const cards = $$('.card', gallery);
    let count = 0;

    cards.forEach((card) => {
      const match = value === 'all' || card.dataset.category === value;
      card.classList.toggle('is-hidden', !match);
      if (match) {
        count++;
        if (reveal) {
          card.style.transitionDelay = `${(count % 9) * 35}ms`;
          card.classList.add('is-in');
        }
      }
    });

    state.visible = cards
      .map((card, i) => (card.classList.contains('is-hidden') ? null : i))
      .filter((i) => i !== null);

    const countEl = $('[data-count]');
    if (countEl) {
      countEl.textContent = `${count} ${plural(count, 'проект', 'проекта', 'проектов')}`;
    }
    $('[data-empty]').hidden = count !== 0;
  }

  $$('[data-filters] .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (chip.classList.contains('is-active')) return;
      $$('[data-filters] .chip').forEach((c) => {
        c.classList.toggle('is-active', c === chip);
        c.setAttribute('aria-pressed', String(c === chip));
      });
      applyFilter(chip.dataset.filter);
    });
  });

  /* -------------------------------------------------------
     Лайтбокс
     ------------------------------------------------------- */
  const lb = $('[data-lightbox]');
  const stage = $('[data-stage]');
  const counter = $('[data-counter]');
  const lbTitle = $('[data-title]');
  const lbMeta = $('[data-meta]');
  const prevBtn = $('[data-prev]');
  const nextBtn = $('[data-next]');

  function openByCard(card) {
    const index = Number(card.dataset.index);
    const pos = state.visible.indexOf(index);
    state.current = pos === -1 ? 0 : pos;
    if (!state.visible.includes(index)) {
      state.visible = [index];
      state.current = 0;
    }
    openLightbox();
  }

  function openLightbox() {
    state.lastFocused = document.activeElement;
    document.body.classList.add('lightbox-open');
    lb.hidden = false;
    renderSlide();
    $('[data-close]').focus({ preventScroll: true });
  }

  function closeLightbox() {
    lb.hidden = true;
    document.body.classList.remove('lightbox-open');
    stage.innerHTML = '';
    if (state.lastFocused) state.lastFocused.focus({ preventScroll: true });
  }

  function renderSlide() {
    const total = state.visible.length;
    if (!total) return;

    const index = state.visible[state.current];
    const item = MEDIA[index];
    const src = sourceOf(item, index, true);

    stage.innerHTML = '';
    if (src.kind === 'video') {
      const video = document.createElement('video');
      video.src = src.src;
      if (src.poster) video.poster = src.poster;
      const auto = item.autoplay !== false;
      video.controls = true;
      video.autoplay = auto;
      video.muted = auto;
      video.preload = auto ? 'auto' : 'none';
      video.playsInline = true;
      video.loop = true;
      stage.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = src.src;
      img.alt = item.title;
      img.addEventListener(
        'error',
        () => {
          img.src = placeholder(item, index);
        },
        { once: true }
      );
      stage.appendChild(img);
    }

    counter.textContent = `${String(state.current + 1).padStart(2, '0')} / ${String(
      total
    ).padStart(2, '0')}`;
    lbTitle.textContent = item.title;
    lbMeta.textContent = `${item.category} · ${item.year}`;

    const single = total < 2;
    prevBtn.disabled = single;
    nextBtn.disabled = single;
  }

  function step(dir) {
    const total = state.visible.length;
    if (total < 2) return;
    state.current = (state.current + dir + total) % total;
    renderSlide();
  }

  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  $('[data-close]').addEventListener('click', closeLightbox);

  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target === stage) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);

    // ловушка фокуса
    if (e.key === 'Tab') {
      const focusables = $$(
        'button:not([disabled]), video, [href], [tabindex]:not([tabindex="-1"])',
        lb
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // свайпы
  let touchX = null;
  stage.addEventListener(
    'touchstart',
    (e) => {
      touchX = e.changedTouches[0].clientX;
    },
    { passive: true }
  );
  stage.addEventListener(
    'touchend',
    (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 55) step(dx > 0 ? -1 : 1);
      touchX = null;
    },
    { passive: true }
  );

  /* -------------------------------------------------------
     Хедер, меню, мелочи
     ------------------------------------------------------- */
  const header = $('[data-header]');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const menuBtn = $('[data-menu-btn]');
  const nav = $('[data-nav]');

  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }

  menuBtn.addEventListener('click', () =>
    setMenu(!document.body.classList.contains('menu-open'))
  );
  $$('[data-nav-link]').forEach((link) =>
    link.addEventListener('click', () => setMenu(false))
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false);
  });
  nav.addEventListener('click', (e) => {
    if (e.target === nav) setMenu(false);
  });

  $$('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  // мягкий reveal для секций
  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealIO.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  $$('.section-head, .about__left, .about__right, .contact__title, .contact__mail').forEach((el) => {
    el.classList.add('reveal');
    revealIO.observe(el);
  });

  /* -------------------------------------------------------
     Старт
     ------------------------------------------------------- */
  renderGallery();
  state.visible = MEDIA.map((_, i) => i);
  applyFilter('all', false); // без принудительного появления — карточки всплывают при скролле
})();
