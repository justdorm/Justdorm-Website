// site.js — shared interior-page behaviors:
// active nav state, staggered scroll reveals, click-to-play video
// facades (lightbox or inline swap), and an image lightbox.
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  }

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
  var lastFocus = null;

  function closeLightbox() {
    if (!lightbox) return;
    var box = lightbox;
    lightbox = null;
    box.classList.remove('open');
    document.body.classList.remove('lightbox-locked');
    setTimeout(function () { box.remove(); }, 320);
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }

  function openLightbox(buildContent, label) {
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
    box.addEventListener('click', function (e) { if (e.target === box) closeLightbox(); });

    document.body.appendChild(box);
    document.body.classList.add('lightbox-locked');
    requestAnimationFrame(function () { box.classList.add('open'); });
    lightbox = box;
    close.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
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

  // ── Image lightbox (about gallery, case study figures) ──
  document.querySelectorAll('.art-item, .zoomable').forEach(function (item) {
    var img = item.tagName === 'IMG' ? item : item.querySelector('img');
    if (!img) return;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');

    var title = '';
    var meta = '';
    var cap = item.querySelector('figcaption');
    if (cap) {
      var strong = cap.querySelector('strong');
      var span = cap.querySelector('span');
      title = strong ? strong.textContent : cap.textContent;
      meta = span ? span.textContent : '';
    } else {
      title = img.alt || '';
    }
    item.setAttribute('aria-label', 'Enlarge ' + (title || 'image'));

    function open() {
      openLightbox(function (content) {
        var big = document.createElement('img');
        big.src = img.currentSrc || img.src;
        big.alt = img.alt || title;
        content.appendChild(big);
        if (title) {
          var caption = document.createElement('p');
          caption.className = 'lightbox-caption';
          caption.textContent = meta ? title + ' — ' + meta : title;
          content.appendChild(caption);
        }
      }, title || 'Image');
    }

    item.addEventListener('click', open);
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  // ── Dynamic Favicon Color Cycling ──
  var favLink = document.querySelector('link[rel="icon"]');
  if (favLink) {
    var favCanvas = document.createElement('canvas');
    var favCtx = favCanvas.getContext('2d');
    var favImg = new Image();
    var favHue = 0;
    
    favImg.onload = function() {
      favCanvas.width = favImg.width;
      favCanvas.height = favImg.height;
    };
    favImg.src = favLink.href;
    
    window.addEventListener('click', function() {
      if (!favImg.complete || !favCanvas.width) return;
      favHue = (favHue + 60) % 360;
      favCtx.clearRect(0, 0, favCanvas.width, favCanvas.height);
      favCtx.filter = 'hue-rotate(' + favHue + 'deg)';
      favCtx.drawImage(favImg, 0, 0);
      favLink.href = favCanvas.toDataURL('image/png');
    });
  }
})();
