// homepage-scene.js — JD Monogram: 3D J + D with CMYK Overlap
// Approach: Render D to a depth texture. Then render main scene where J uses a custom shader
// that samples D's depth — where D's fragment is at similar depth, output yellow, else black.
// D uses a shader to split colors (Cyan on left, Magenta on right).
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ─── Renderer ───
const canvas = document.getElementById('jd-scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.autoClear = false;

const W = window.innerWidth, H = window.innerHeight;
const PR = Math.min(window.devicePixelRatio, 2);

// ─── Camera ───
const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
camera.position.set(0, 0.5, 12);

// ─── Main scene (background, outlines, J, D, particles) ───
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ─── Lighting (shared params) ───
function addLights(s) {
  s.add(new THREE.AmbientLight(0x606070, 1.0));
  const a = new THREE.DirectionalLight(0xffeedd, 1.6);
  a.position.set(5, 6, 7); s.add(a);
  const b = new THREE.DirectionalLight(0xaaccff, 0.6);
  b.position.set(-4, -3, 4); s.add(b);
  const c = new THREE.DirectionalLight(0xffffff, 0.3);
  c.position.set(0, 0, -5); s.add(c);
}
addLights(scene);

// ─── D depth-only scene (for the depth texture) ───
const dDepthScene = new THREE.Scene();

// ─── Groups ───
const logoGroup = new THREE.Group();
scene.add(logoGroup);

const jGroup = new THREE.Group();
logoGroup.add(jGroup);

const dDepthGroup = new THREE.Group();
dDepthScene.add(dDepthGroup);

const allGroups = [logoGroup, dDepthGroup];
let globalDMat = null;
let globalJMat = null;

// ─── D Depth Render Target ───
const dDepthTarget = new THREE.WebGLRenderTarget(W * PR, H * PR, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  type: THREE.FloatType,
});
dDepthTarget.depthTexture = new THREE.DepthTexture(W * PR, H * PR);
dDepthTarget.depthTexture.format = THREE.DepthFormat;
dDepthTarget.depthTexture.type = THREE.UnsignedIntType;

const dSplitShader = {
  uniforms: {
    jOffset: { value: new THREE.Vector2(0, 0) },
    colorPhase: { value: 0.0 }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vLogoPos;
    varying vec3 vWorldPosition;
    varying float vLocalZ;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vLocalZ = position.z;
      
      float cosR = cos(-0.08);
      float sinR = sin(-0.08);
      vec3 pos = position;
      float x = pos.x * cosR + pos.z * sinR;
      float z = -pos.x * sinR + pos.z * cosR;
      pos.x = x;
      pos.z = z;
      pos += vec3(0.7, -0.2, -0.1);
      vLogoPos = pos;
      
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform vec2 jOffset;
    uniform float colorPhase;
    varying vec3 vNormal;
    varying vec3 vLogoPos;
    varying vec3 vWorldPosition;
    varying float vLocalZ;

    // Pick a CMY color by index (0=C, 1=M, 2=Y)
    vec3 cmyColor(float idx) {
      float i = mod(idx, 3.0);
      if (i < 0.5) return vec3(0.0, 1.0, 1.0);      // cyan
      else if (i < 1.5) return vec3(1.0, 0.0, 1.0);  // magenta
      else return vec3(1.0, 1.0, 0.0);                // yellow
    }
    vec3 cmyDeep(float idx) {
      float i = mod(idx, 3.0);
      if (i < 0.5) return vec3(0.0, 0.25, 0.5);       // cyan deep
      else if (i < 1.5) return vec3(0.45, 0.0, 0.15);  // magenta deep
      else return vec3(0.7, 0.3, 0.0);                // yellow deep
    }

    void main() {
      // Determine current and next phase for smooth transition
      float phase = colorPhase;
      float cur = floor(phase);
      float t = phase - cur; // 0..1 fractional transition
      
      // Slot A (left/cyan area): index 0,1,2 cycling
      vec3 slotAEdge = mix(cmyColor(cur), cmyColor(cur + 1.0), t);
      vec3 slotADeep = mix(cmyDeep(cur), cmyDeep(cur + 1.0), t);
      
      // Slot B (right/magenta area): index 1,2,0 cycling
      vec3 slotBEdge = mix(cmyColor(cur + 1.0), cmyColor(cur + 2.0), t);
      vec3 slotBDeep = mix(cmyDeep(cur + 1.0), cmyDeep(cur + 2.0), t);
      
      // J coordinate space for split boundary
      vec3 vJPos = vLogoPos - vec3(jOffset.x, jOffset.y, 0.0);
      float split = 0.9 + max(0.0, -vJPos.y) * 0.04;
      split += min(0.0, vJPos.y + 0.8) * 2.4;
      float splitBlend = smoothstep(split - 0.15, split + 0.15, vJPos.x);
      
      vec3 edgeColor = mix(slotAEdge, slotBEdge, splitBlend);
      vec3 centerColor = mix(slotADeep, slotBDeep, splitBlend);
      
      // Radial distance from center of the D shape
      vec2 center = vec2(0.7, -0.2);
      float dist = length(vLogoPos.xy - center);
      float edgeFactor = clamp(dist / 2.0, 0.0, 1.0);
      edgeFactor = pow(edgeFactor, 2.0);
      
      vec3 color = mix(centerColor, edgeColor, edgeFactor);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

const jOverlapShader = {
  uniforms: {
    dDepth: { value: null },
    resolution: { value: new THREE.Vector2(W * PR, H * PR) },
    jMaxX: { value: 0.0 },
    colorPhase: { value: 0.0 }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying float vLocalY;
    varying float vLocalX;
    varying float vLocalZ;
    varying vec3 vWorldPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vLocalY = position.y;
      vLocalX = position.x;
      vLocalZ = position.z;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D dDepth;
    uniform vec2 resolution;
    uniform float jMaxX;
    uniform float colorPhase;
    varying vec3 vNormal;
    varying float vLocalY;
    varying float vLocalX;
    varying float vLocalZ;
    varying vec3 vWorldPosition;

    float readDepth(sampler2D depthTex, vec2 uv) {
      return texture2D(depthTex, uv).r;
    }

    vec3 cmyColor(float idx) {
      float i = mod(idx, 3.0);
      if (i < 0.5) return vec3(0.0, 1.0, 1.0);
      else if (i < 1.5) return vec3(1.0, 0.0, 1.0);
      else return vec3(1.0, 1.0, 0.0);
    }
    vec3 cmyDeep(float idx) {
      float i = mod(idx, 3.0);
      if (i < 0.5) return vec3(0.0, 0.25, 0.5);
      else if (i < 1.5) return vec3(0.3, 0.0, 0.2);
      else return vec3(0.3, 0.25, 0.0);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution;
      float dD = readDepth(dDepth, uv);
      bool dExists = dD < 0.9999;
      
      // Slot C (overlap/yellow area): index 2,0,1 cycling
      float cur = floor(colorPhase);
      float t = colorPhase - cur;
      vec3 slotCEdge = mix(cmyColor(cur + 2.0), cmyColor(cur + 3.0), t);
      vec3 slotCDeep = mix(cmyDeep(cur + 2.0), cmyDeep(cur + 3.0), t);
      
      vec3 black = vec3(0.12, 0.12, 0.12);
      vec3 blackDeep = vec3(0.02, 0.02, 0.03);
      
      vec3 edgeColor = dExists ? slotCEdge : black;
      vec3 centerColor = dExists ? slotCDeep : blackDeep;
      
      float dist = length(vec2(vLocalX, vLocalY));
      float edgeFactor = clamp(dist / 2.8, 0.0, 1.0);
      edgeFactor = pow(edgeFactor, 2.0);
      vec3 color = dExists ? mix(edgeColor, centerColor, edgeFactor) : mix(centerColor, edgeColor, edgeFactor);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

// ─── Load Font ───
let sceneReady = false;
const loader = new FontLoader();
loader.load(
  'https://unpkg.com/three@0.164.1/examples/fonts/helvetiker_bold.typeface.json',
  (font) => {

    // Helper to extend the top of the J upwards
    function extendJ(geo, amount) {
      geo.center();
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > 1.0) {
          pos.setY(i, pos.getY(i) + amount);
        }
      }
      geo.computeBoundingBox();
      geo.computeVertexNormals();
      return geo;
    }

    const size = 4;
    const depth = 1.8;
    const curveSegments = 20;

    const optsMain = { font, size, depth, curveSegments, bevelEnabled: false };
    // We use ExtrudeGeometry's native bevelSize to expand the 2D shape for flawless outlines
    // Keep bevelThickness small to prevent the outline faces from pushing forward and covering the main colors
    const optsBlack = { font, size, depth, curveSegments, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.24, bevelSegments: 1 };
    const optsWhite = { font, size, depth, curveSegments, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.5, bevelSegments: 1 };

    const jGeo = extendJ(new TextGeometry('J', optsMain), 0.6);
    const jGeoBlack = extendJ(new TextGeometry('J', optsBlack), 0.6);
    const jGeoWhite = extendJ(new TextGeometry('J', optsWhite), 0.6);

    // Generate shapes for 'D' and take only the first outer contour to make it solid
    const allDShapes = font.generateShapes('D', size);
    const dShapes = [allDShapes[0]];
    dShapes[0].holes = [];

    const dGeo = new THREE.ExtrudeGeometry(dShapes, optsMain);
    dGeo.center();
    const dGeoBlack = new THREE.ExtrudeGeometry(dShapes, optsBlack);
    dGeoBlack.center();
    const dGeoWhite = new THREE.ExtrudeGeometry(dShapes, optsWhite);
    dGeoWhite.center();

    const jP = new THREE.Vector3(-0.3, -0.1, 0.1);
    const dP = new THREE.Vector3(0.7, -0.2, -0.1);
    const jR = new THREE.Euler(0, 0.08, 0);
    const dR = new THREE.Euler(0, -0.08, 0);

    // ── Outlines (using natively offset bevel geometries) ──
    const mW = new THREE.MeshBasicMaterial({ color: 0xe0e0e0 });
    const mB = new THREE.MeshBasicMaterial({ color: 0x050505 });

    mk(jGroup, jGeoWhite, mW, jP, jR, 1.0, -0.80);
    mk(logoGroup, dGeoWhite, mW.clone(), dP, dR, 1.0, -0.60);
    mk(jGroup, jGeoBlack, mB, jP, jR, 1.0, 0.029);
    mk(logoGroup, dGeoBlack, mB.clone(), dP, dR, 1.0, -0.18);

    // ── D depth-only copy (for render target) ──
    const depthMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    mk(dDepthGroup, dGeo, depthMat, dP, dR, 1.0, 0);

    // ── D letter with split shader (in main scene) ──
    const dMat = new THREE.ShaderMaterial(dSplitShader);
    globalDMat = dMat;
    mk(logoGroup, dGeo, dMat, dP, dR, 1.0, 0);

    // ── J letter with overlap shader (in main scene) ──
    const jMatLocal = new THREE.ShaderMaterial(jOverlapShader);
    jMatLocal.uniforms.dDepth.value = dDepthTarget.depthTexture;
    jGeo.computeBoundingBox();
    jMatLocal.uniforms.jMaxX.value = jGeo.boundingBox.max.x;
    globalJMat = jMatLocal;
    mk(jGroup, jGeo, jMatLocal, jP, jR, 1.0, 0.08);

    const el = document.getElementById('loading-text');
    if (el) el.style.display = 'none';
    sceneReady = true;
  }
);

function mk(grp, geo, mat, pos, rot, s, zOff) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos.x, pos.y, pos.z + zOff);
  m.rotation.copy(rot);
  m.scale.setScalar(s);
  grp.add(m);
  return m;
}

// ─── Particles ───
const pN = 400, pGeo = new THREE.BufferGeometry();
const pP = new Float32Array(pN * 3), pV = new Float32Array(pN * 3);
for (let i = 0; i < pN; i++) {
  const j = i * 3;
  pP[j] = (Math.random() - .5) * 30; pP[j + 1] = (Math.random() - .5) * 20; pP[j + 2] = (Math.random() - .5) * 15 - 5;
  pV[j] = (Math.random() - .5) * .003; pV[j + 1] = (Math.random() - .5) * .003;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pP, 3));
scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({
  color: 0xffffff, size: 0.04, transparent: true, opacity: 0.35,
  sizeAttenuation: true, depthWrite: false,
})));

// ─── Mouse ───
const tR = { x: 0, y: 0 }, cR = { x: 0, y: 0 };
let mob = window.innerWidth < 768;

const mouseNDC = new THREE.Vector2(-999, -999);
window.addEventListener('mousemove', e => {
  if (mob) return;
  tR.y = ((e.clientX / window.innerWidth) * 2 - 1) * 0.1;
  tR.x = -((e.clientY / window.innerHeight) * 2 - 1) * 0.1;
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('mouseleave', () => { mouseNDC.set(-999, -999); });

// ─── Gyroscope (Mobile) ───
window.addEventListener('deviceorientation', e => {
  if (!mob || e.gamma === null) return;
  // clamp rotation values to prevent it from spinning too far
  let gamma = Math.max(-45, Math.min(45, e.gamma)); // Left/Right tilt
  let beta = Math.max(-45, Math.min(45, e.beta - 40)); // Up/Down tilt (assuming 40deg neutral angle)
  
  tR.y = (gamma / 45) * 0.15;
  tR.x = (beta / 45) * 0.15;
});

// ─── Color Cycle on Click ───
let colorPhaseTarget = 0;
let colorPhaseCurrent = 0;

canvas.addEventListener('click', () => {
  colorPhaseTarget += 1;
  // Request gyroscope permission for iOS devices
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().catch(console.error);
  }
});
canvas.style.cursor = 'pointer';

// ─── Party Mode (raycast hover over logo) ───
let partyMode = false;
const raycaster = new THREE.Raycaster();

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  const pr = Math.min(window.devicePixelRatio, 2);
  dDepthTarget.setSize(w * pr, h * pr);
  jOverlapShader.uniforms.resolution.value.set(w * pr, h * pr);
  mob = w < 768;
});

// ─── Animate ───
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  cR.x += (tR.x - cR.x) * 0.07;
  cR.y += (tR.y - cR.y) * 0.07;

  const logoScale = mob ? 0.8 : 1.0;
  // Sync all groups
  for (const g of allGroups) {
    g.rotation.x = cR.x;
    g.rotation.y = cR.y;
    g.scale.set(logoScale, logoScale, logoScale);
  }

  // Shift the J layer around for a dynamic parallax effect
  if (sceneReady) {
    const jX = cR.y * 5.5;
    const jY = -cR.x * 5.5;
    jGroup.position.x = jX;
    jGroup.position.y = jY;
    if (globalDMat) {
      globalDMat.uniforms.jOffset.value.set(jX, jY);
    }

    // Raycast to detect hover over the logo meshes
    raycaster.setFromCamera(mouseNDC, camera);
    const wasParty = partyMode;
    partyMode = raycaster.intersectObjects(logoGroup.children, true).length > 0;
    canvas.style.cursor = partyMode ? 'pointer' : 'default';

    // Party mode: rapidly cycle colors while hovering over logo
    if (partyMode) {
      colorPhaseTarget += 0.08;
    } else if (wasParty) {
      // Snap to nearest clean CMY color on exit
      colorPhaseTarget = Math.round(colorPhaseTarget);
    }

    // Smoothly animate color phase toward target
    colorPhaseCurrent += (colorPhaseTarget - colorPhaseCurrent) * 0.25;
    dSplitShader.uniforms.colorPhase.value = colorPhaseCurrent;
    jOverlapShader.uniforms.colorPhase.value = colorPhaseCurrent;
  }

  // Particles
  const a = pGeo.attributes.position.array;
  for (let i = 0; i < pN; i++) {
    const j = i * 3;
    a[j] += pV[j]; a[j + 1] += pV[j + 1];
    if (a[j] > 15) a[j] = -15; if (a[j] < -15) a[j] = 15;
    if (a[j + 1] > 10) a[j + 1] = -10; if (a[j + 1] < -10) a[j + 1] = 10;
  }
  pGeo.attributes.position.needsUpdate = true;

  // ── Pass 1: Render D to depth texture ──
  renderer.setRenderTarget(dDepthTarget);
  renderer.clear(true, true, false);
  renderer.render(dDepthScene, camera);

  // ── Pass 2: Render main scene (bg, outlines, D split, J overlap) ──
  renderer.setRenderTarget(null);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);
}
animate();
