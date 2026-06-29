// site.js — shared interior-page behaviors:
// active nav state, staggered scroll reveals, click-to-play video
// facades (lightbox or inline swap), and an image lightbox.
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── View-transition morph targets ──
  // The shared-element morph (listing thumbnail/title → case-study hero) only
  // works if the destination elements are painted when Chrome captures the
  // incoming snapshot. Our scroll-reveal leaves them at opacity:0 until the
  // IntersectionObserver runs (after capture), so the morph has nothing to land
  // on. pagereveal fires before the snapshot — paint the targets there, but
  // only when actually arriving via a view transition.
  window.addEventListener('pagereveal', function (e) {
    if (!e || !e.viewTransition) return;
    document.querySelectorAll('.page-title, .case-title, .case-media, .cs-hero-frame').forEach(function (el) {
      el.classList.add('vt-shown');
      var wrap = el.closest('.reveal');
      if (wrap) wrap.classList.add('vt-shown');
    });
  });

  // ── Random grain jitter (JS so it never loops) ──
  var grain = document.querySelector('.grain');
  if (grain && !reduceMotion) {
    var lastGrain = 0;
    (function jitter(t) {
      requestAnimationFrame(jitter);
      if (t - lastGrain < 90) return;        // ~11 fps
      lastGrain = t;
      var x = (Math.random() * 3 - 1.5).toFixed(2);
      var y = (Math.random() * 3 - 1.5).toFixed(2);
      grain.style.transform = 'translate(' + x + '%, ' + y + '%)';
    })(0);
  }

  // ── Active nav state ──
  var path = location.pathname.split('/').pop().toLowerCase() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(function (a) {
    var target = a.getAttribute('href').split('/').pop().toLowerCase();
    if (target === path) a.setAttribute('aria-current', 'page');
  });

  // ── Per-letter spans for the ink-split hover effect ──
  document.querySelectorAll('.ink-split').forEach(function (el) {
    var text = el.textContent;
    el.setAttribute('aria-label', text);
    el.textContent = '';
    text.split('').forEach(function (ch) {
      if (ch.trim() === '') { el.appendChild(document.createTextNode(ch)); return; }
      var s = document.createElement('span');
      s.className = 'ltr';
      s.textContent = ch;
      el.appendChild(s);
    });
  });

  // ── Staggered scroll reveals ──
  var revealEls = document.querySelectorAll('.reveal, .ink-split');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    revealEls.forEach(function (el) {
      var siblings = el.parentElement ? el.parentElement.children : [];
      var i = 0, idx = 0;
      for (; i < siblings.length; i++) {
        if (siblings[i] === el) break;
        if (siblings[i].classList && (siblings[i].classList.contains('reveal') || siblings[i].classList.contains('ink-split'))) idx++;
      }
      el.style.setProperty('--d', Math.min(idx * 90, 450) + 'ms');
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    revealEls.forEach(function (el) { io.observe(el); });
  }

  // ── Scroll progress hairline ──
  var prog = document.createElement('div');
  prog.className = 'scroll-progress';
  prog.setAttribute('aria-hidden', 'true');
  document.body.appendChild(prog);
  function updateProgress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  // ── Magnetic micro-interactions on small interactive elements ──
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.btn-ghost, .case-link, .ig-link').forEach(function (el) {
      el.classList.add('magnetic');
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + (dx * 0.22).toFixed(1) + 'px, ' + (dy * 0.22).toFixed(1) + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });

    // Cursor spotlight: feed pointer position into the .case-media / .film-poster glow.
    document.querySelectorAll('.case-media, .film-poster').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });
  }

  // ── Speculative prefetch on intent ──
  // Warm the cache for an internal page the moment the user signals intent
  // (hover, focus, or touch), so the view-transition navigation feels instant.
  (function () {
    var seen = {};
    function prefetch(url) {
      if (!url || seen[url]) return;
      seen[url] = true;
      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = url;
      document.head.appendChild(l);
    }
    document.querySelectorAll('a[href$=".html"]').forEach(function (a) {
      if (a.origin !== location.origin || a.href === location.href) return;
      var warm = function () { prefetch(a.href); };
      a.addEventListener('pointerenter', warm);
      a.addEventListener('focus', warm, true);
      a.addEventListener('touchstart', warm, { passive: true });
    });
  })();

  // ── For the curious ──
  try {
    console.log(
      '%c J %c D %c designed & built by Justin Dormitzer — justin@justdorm.com',
      'background:#00ffff;color:#000;font-weight:bold;padding:2px 7px;',
      'background:#ff00ff;color:#000;font-weight:bold;padding:2px 7px;',
      'color:#ffe600;padding:2px 6px;'
    );
  } catch (err) { /* no console, no problem */ }

  // ── Lightbox ──
  var lightbox = null;
  var lightboxNav = null;
  var lastFocus = null;

  function closeLightbox() {
    if (!lightbox) return;
    var box = lightbox;
    lightbox = null;
    lightboxNav = null;
    box.classList.remove('open');
    document.body.classList.remove('lightbox-locked');
    setTimeout(function () { box.remove(); }, 320);
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }

  // Chevron arrow button for gallery navigation.
  function navButton(dir) {
    var btn = document.createElement('button');
    btn.className = 'lightbox-nav lightbox-' + (dir < 0 ? 'prev' : 'next');
    btn.setAttribute('aria-label', dir < 0 ? 'Previous' : 'Next');
    var pts = dir < 0 ? '15 5 8 12 15 19' : '9 5 16 12 9 19';
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<polyline points="' + pts + '" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return btn;
  }

  function openLightbox(buildContent, label, nav) {
    closeLightbox();
    lastFocus = document.activeElement;

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    if (label) box.setAttribute('aria-label', label);

    var content = document.createElement('div');
    content.className = 'lightbox-content';
    buildContent(content);

    var close = document.createElement('button');
    close.className = 'lightbox-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '✕';
    close.addEventListener('click', closeLightbox);

    box.appendChild(content);
    box.appendChild(close);

    if (nav) {
      lightboxNav = nav;
      var prev = navButton(-1);
      var next = navButton(1);
      prev.addEventListener('click', function (e) { e.stopPropagation(); nav(-1); });
      next.addEventListener('click', function (e) { e.stopPropagation(); nav(1); });
      box.appendChild(prev);
      box.appendChild(next);

      // Touch swipe: left → next, right → prev.
      var tsx = 0, tsy = 0;
      box.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        tsx = e.touches[0].clientX;
        tsy = e.touches[0].clientY;
      }, { passive: true });
      box.addEventListener('touchend', function (e) {
        if (!lightboxNav) return;
        var t = e.changedTouches[0];
        var dx = t.clientX - tsx, dy = t.clientY - tsy;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) nav(dx < 0 ? 1 : -1);
      }, { passive: true });
    }

    box.addEventListener('click', function (e) { if (e.target === box) closeLightbox(); });

    document.body.appendChild(box);
    document.body.classList.add('lightbox-locked');
    requestAnimationFrame(function () { box.classList.add('open'); });
    lightbox = box;
    close.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (!lightbox) return;
    if (e.key === 'Escape') closeLightbox();
    else if (lightboxNav && e.key === 'ArrowLeft') { e.preventDefault(); lightboxNav(-1); }
    else if (lightboxNav && e.key === 'ArrowRight') { e.preventDefault(); lightboxNav(1); }
    else if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      var sel = 'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
      var f = Array.prototype.slice.call(lightbox.querySelectorAll(sel));
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!lightbox.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function videoFrame(src, title) {
    var frame = document.createElement('div');
    frame.className = 'video-frame';
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = title || 'Video player';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    iframe.allowFullscreen = true;
    frame.appendChild(iframe);
    return frame;
  }

  // ── Video facades ──
  // data-embed = player URL (autoplay param included by the page).
  // data-inline on the button swaps the player in place (hero reel);
  // otherwise the player opens in the lightbox.
  document.querySelectorAll('[data-embed]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = btn.getAttribute('data-embed');
      var title = btn.getAttribute('data-title') || 'Video player';

      if (btn.hasAttribute('data-inline')) {
        var frame = videoFrame(src, title);
        btn.replaceWith(frame);
        return;
      }

      openLightbox(function (content) {
        content.appendChild(videoFrame(src, title));
        var caption = document.createElement('p');
        caption.className = 'lightbox-caption';
        caption.textContent = title;
        content.appendChild(caption);
      }, title);
    });
  });

  // ── Vimeo poster thumbnails ──
  // Unlisted videos aren't served by static thumb proxies, so resolve
  // the real thumbnail through Vimeo's oEmbed endpoint.
  document.querySelectorAll('[data-vimeo-thumb]').forEach(function (el) {
    var img = el.querySelector('img');
    if (!img) return;
    fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(el.getAttribute('data-vimeo-thumb')))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.thumbnail_url) {
          img.src = data.thumbnail_url.replace(/_\d+x\d+/, '_1280x720');
        }
      })
      .catch(function () { /* poster stays dark; play button still works */ });
  });

  // ── Image lightbox + gallery navigation (about gallery, case study figures) ──
  // Pull title/caption metadata off a figure (or bare img).
  function slideData(item) {
    var img = item.tagName === 'IMG' ? item : item.querySelector('img');
    var title = '', meta = '';
    var cap = item.querySelector ? item.querySelector('figcaption') : null;
    if (cap) {
      var strong = cap.querySelector('strong');
      var span = cap.querySelector('span');
      title = strong ? strong.textContent : cap.textContent;
      meta = span ? span.textContent : '';
    } else if (img) {
      title = img.alt || '';
    }
    return { img: img, title: title, meta: meta };
  }

  document.querySelectorAll('.art-item, .zoomable').forEach(function (item) {
    var img = item.tagName === 'IMG' ? item : item.querySelector('img');
    if (!img) return;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', 'Enlarge ' + (slideData(item).title || 'image'));

    // art-items in the same grid form one navigable gallery; lone figures stand alone.
    function open() {
      var group = (item.classList.contains('art-item') && item.parentElement)
        ? Array.prototype.slice.call(item.parentElement.querySelectorAll('.art-item'))
        : [item];
      openGallery(group, group.indexOf(item));
    }

    item.addEventListener('click', open);
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  function openGallery(group, startIndex) {
    var index = startIndex;
    var multi = group.length > 1;
    var contentEl = null;

    function preload(i) {
      var d = slideData(group[(i + group.length) % group.length]);
      if (d.img) { var p = new Image(); p.src = d.img.currentSrc || d.img.src; }
    }

    function paint(dir) {
      var d = slideData(group[index]);
      contentEl.innerHTML = '';
      var big = document.createElement('img');
      big.src = d.img.currentSrc || d.img.src;
      big.alt = d.img.alt || d.title;
      if (dir > 0) big.classList.add('lb-from-right');
      else if (dir < 0) big.classList.add('lb-from-left');
      contentEl.appendChild(big);
      if (d.title) {
        var caption = document.createElement('p');
        caption.className = 'lightbox-caption';
        caption.textContent = d.meta ? d.title + ' — ' + d.meta : d.title;
        contentEl.appendChild(caption);
      }
      if (multi) {
        var count = document.createElement('p');
        count.className = 'lightbox-count';
        count.textContent = (index + 1) + ' / ' + group.length;
        contentEl.appendChild(count);
        preload(index + 1);
        preload(index - 1);
      }
    }

    function go(delta) {
      index = (index + delta + group.length) % group.length;
      paint(delta);
    }

    openLightbox(function (content) {
      contentEl = content;
      paint();
    }, slideData(group[index]).title || 'Image', multi ? go : null);
  }
})();
