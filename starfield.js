// starfield.js — ambient star field behind interior pages.
// The same drifting particle system as the homepage scene (homepage-scene.js),
// minus the logo-driven interactions: slow swirl + drift, and particles near
// the cursor swell and bloom into the 8-spike lens flare.
import * as THREE from 'three';

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'starfield-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const PR = Math.min(window.devicePixelRatio, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(PR);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.5, 12);

  const scene = new THREE.Scene();

  // Same field parameters as the homepage: 400 points in a slab behind the page
  const pN = 400;
  const pGeo = new THREE.BufferGeometry();
  const pP = new Float32Array(pN * 3), pV = new Float32Array(pN * 3);
  for (let i = 0; i < pN; i++) {
    const j = i * 3;
    pP[j] = (Math.random() - .5) * 60;
    pP[j + 1] = (Math.random() - .5) * 40;
    pP[j + 2] = (Math.random() - .5) * 15 - 10;
    pV[j] = (Math.random() - .5) * .0015;
    pV[j + 1] = (Math.random() - .5) * .0015;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pP, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      pixelRatio: { value: PR },
      winHeight: { value: window.innerHeight },
      aspectRatio: { value: window.innerWidth / window.innerHeight },
      mouseNDC: { value: new THREE.Vector2(-999, -999) },
      mRadius: { value: 0.4 },
      mStrength: { value: 1.0 }
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float time;
      uniform float pixelRatio;
      uniform float winHeight;
      uniform float aspectRatio;
      uniform vec2 mouseNDC;
      uniform float mRadius;
      uniform float mStrength;
      varying float vMouseForce;
      void main() {
        // Ambient float: slow directionless bob, phase-shifted per particle
        vec3 pos = position;
        pos.x += sin(time * 0.1 + position.y * 0.6) * 0.18;
        pos.y += cos(time * 0.08 + position.x * 0.6) * 0.18;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vec4 projPos = projectionMatrix * mvPosition;

        // Cursor proximity (grow only)
        vec2 screenPos = projPos.xy / projPos.w;
        vec2 dir = screenPos - mouseNDC;
        dir.x *= aspectRatio;
        float distToMouse = length(dir);
        float mForce = smoothstep(mRadius, 0.0, distToMouse) * mStrength;
        vMouseForce = mForce;

        gl_Position = projPos;

        float currentSize = (0.12 + (mForce * 0.12)) * 5.0;
        gl_PointSize = (currentSize * winHeight * pixelRatio * 0.5) / -mvPosition.z;
      }
    `,
    fragmentShader: `
      varying float vMouseForce;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord) * 5.0;

        float alphaMult = smoothstep(0.5, 0.0, dist);
        float glowForce = vMouseForce * 0.15;
        float coreBrightness = smoothstep(0.15, 0.0, dist) * glowForce * 0.8;

        // Starburst lens flare (8 spikes), revealed by cursor proximity
        float fadeX = smoothstep(0.5, 0.0, abs(coord.x));
        float flareH = smoothstep(0.03, 0.0, abs(coord.y)) * fadeX;

        float fadeY = smoothstep(0.5, 0.0, abs(coord.y));
        float flareV = smoothstep(0.03, 0.0, abs(coord.x)) * fadeY;

        float diag1Dist = abs((coord.x - coord.y) * 0.7071);
        float diag1Fade = smoothstep(0.5, 0.0, abs((coord.x + coord.y) * 0.7071));
        float flareD1 = smoothstep(0.02, 0.0, diag1Dist) * diag1Fade * 0.6;

        float diag2Dist = abs((coord.x + coord.y) * 0.7071);
        float diag2Fade = smoothstep(0.5, 0.0, abs((coord.x - coord.y) * 0.7071));
        float flareD2 = smoothstep(0.02, 0.0, diag2Dist) * diag2Fade * 0.6;

        float flare = (flareH + flareV + flareD1 + flareD2) * glowForce * 1.5;
        float totalExtraGlow = coreBrightness + flare;

        float circleAlpha = (0.35 + vMouseForce * 0.4) * alphaMult;
        float finalAlpha = circleAlpha + totalExtraGlow;
        if (finalAlpha < 0.01) discard;

        vec3 glowColor = vec3(1.0) * (1.0 + totalExtraGlow * 1.5);
        gl_FragColor = vec4(glowColor, finalAlpha);
      }
    `
  });
  scene.add(new THREE.Points(pGeo, mat));

  const mouseNDC = new THREE.Vector2(-999, -999);
  window.addEventListener('mousemove', function (e) {
    mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  document.documentElement.addEventListener('mouseleave', function () {
    mouseNDC.set(-999, -999);
  });

  // ── Gyroscope tilt (mobile): quadrant sweep, same mapping as the homepage.
  // iOS permission is requested by homepage-scene.js on the first tap.
  let mob = window.innerWidth < 768;
  const tilt = { x: 0, y: 0 };
  const tiltTarget = { x: 0, y: 0 };
  let gyroActive = false;
  window.addEventListener('deviceorientation', function (e) {
    if (!mob || e.gamma === null) return;
    gyroActive = true;
    const gamma = Math.max(-45, Math.min(45, e.gamma));      // left/right tilt
    const beta = Math.max(-45, Math.min(45, e.beta - 40));   // up/down tilt (40° neutral)
    tiltTarget.x = gamma / 45;
    tiltTarget.y = beta / 45;
  });

  window.addEventListener('resize', function () {
    const w = window.innerWidth, h = window.innerHeight;
    mob = w < 768;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    mat.uniforms.winHeight.value = h;
    mat.uniforms.aspectRatio.value = w / h;
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);

    mat.uniforms.time.value = clock.getElapsedTime();

    // Tilt drives a virtual cursor into screen quadrants; the wider radius
    // makes the swell read at quadrant scale (homepage mapping).
    if (gyroActive && mob) {
      tilt.x += (tiltTarget.x - tilt.x) * 0.07;
      tilt.y += (tiltTarget.y - tilt.y) * 0.07;
      mouseNDC.set(tilt.x * 1.5, -tilt.y * 1.5);
      mat.uniforms.mRadius.value = 1.1;
      mat.uniforms.mStrength.value = 0.55;
    }
    mat.uniforms.mouseNDC.value.copy(mouseNDC);

    const a = pGeo.attributes.position.array;
    for (let i = 0; i < pN; i++) {
      const j = i * 3;
      a[j] += pV[j]; a[j + 1] += pV[j + 1];
      if (a[j] > 30) a[j] = -30; if (a[j] < -30) a[j] = 30;
      if (a[j + 1] > 20) a[j + 1] = -20; if (a[j + 1] < -20) a[j + 1] = 20;
    }
    pGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();
})();
