// homepage-scene.js — JD Monogram: 3D J + D with CMYK Overlap
// Approach: Render D to a depth texture. Then render main scene where J uses a custom shader
// that samples D's depth — where D's fragment is at similar depth, output yellow, else black.
// D uses a shader to split colors (Cyan on left, Magenta on right).
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ─── Renderer ───
const canvas = document.querySelector('.jd-canvas') || document.getElementById('jd-scene');
const isHeader = canvas.dataset.mode === 'header';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });

let W, H;
if (isHeader) {
  W = canvas.clientWidth || 30;
  H = canvas.clientHeight || 30;
} else {
  W = window.innerWidth;
  H = window.innerHeight;
}

let mob = window.innerWidth < 768;

renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = isHeader ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.autoClear = false;

// ─── Incoming snapshot bridge ───
// If a previous page captured the logo canvas into sessionStorage, paint it
// as the CSS background of this canvas so the view-transition morph target
// shows a fully-coloured logo while WebGL boots (font loading, etc.).
let snapshotActive = false;
try {
  const snap = sessionStorage.getItem('jdLogoSnapshot');
  if (snap) {
    canvas.style.backgroundImage = `url(${snap})`;
    canvas.style.backgroundSize = 'contain';
    canvas.style.backgroundRepeat = 'no-repeat';
    canvas.style.backgroundPosition = 'center';
    snapshotActive = true;
    // The snapshot already shows the logo — suppress the "Loading" text
    const loadEl = document.getElementById('loading-text');
    if (loadEl) loadEl.style.display = 'none';
    // One-shot: clear it so a hard reload doesn't re-show a stale frame
    sessionStorage.removeItem('jdLogoSnapshot');
  }
} catch (e) { /* private mode */ }

const PR = Math.min(window.devicePixelRatio, 2);

// ─── Camera ───
const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
if (isHeader) {
  camera.position.set(0.2, 0.4, 10);
  camera.lookAt(0.2, 0.4, 0);
} else {
  camera.position.set(0, 0.5, 12);
}

// ─── Main scene (background, outlines, J, D, particles) ───
const scene = new THREE.Scene();
if (!isHeader) {
  // Transparent background to allow CSS drop-shadow glow
}

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
let globalMobileGlowMat = null;
let globalMobileGlowMesh = null;
let globalFlareMat = null;

// ─── D Mask Render Target ───
const maskPR = mob ? PR : (PR * 2);
const dMaskTarget = new THREE.WebGLRenderTarget(W * maskPR, H * maskPR, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat
});

const dSplitShader = {
  uniforms: {
    jOffset: { value: new THREE.Vector2(0, 0) },
    colorPhase: { value: 0.0 },
    isHeaderFlag: { value: isHeader ? 1.0 : 0.0 }
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
    uniform float isHeaderFlag;
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
      if (isHeaderFlag > 0.5) {
        color = edgeColor;
      }
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

const jOverlapShader = {
  uniforms: {
    dMask: { value: null },
    resolution: { value: new THREE.Vector2(W * PR, H * PR) },
    jMaxX: { value: 0.0 },
    colorPhase: { value: 0.0 },
    isHeaderFlag: { value: isHeader ? 1.0 : 0.0 }
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
    uniform sampler2D dMask;
    uniform vec2 resolution;
    uniform float jMaxX;
    uniform float colorPhase;
    uniform float isHeaderFlag;
    varying vec3 vNormal;
    varying float vLocalY;
    varying float vLocalX;
    varying float vLocalZ;
    varying vec3 vWorldPosition;

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
      // Read the anti-aliased color mask (red channel) from the MSAA render target
      float dExists = texture2D(dMask, uv).r;
      
      // Slot C (overlap/yellow area): index 2,0,1 cycling
      float cur = floor(colorPhase);
      float t = colorPhase - cur;
      vec3 slotCEdge = mix(cmyColor(cur + 2.0), cmyColor(cur + 3.0), t);
      vec3 slotCDeep = mix(cmyDeep(cur + 2.0), cmyDeep(cur + 3.0), t);
      
      vec3 black = vec3(0.12, 0.12, 0.12);
      vec3 blackDeep = vec3(0.02, 0.02, 0.03);
      
      float dist = length(vec2(vLocalX, vLocalY));
      float edgeFactor = clamp(dist / 2.8, 0.0, 1.0);
      edgeFactor = pow(edgeFactor, 2.0);
      
      // Smoothly mix between the overlap colors and the base black based on dExists alpha
      vec3 color = mix(
        mix(black, blackDeep, edgeFactor), 
        mix(slotCEdge, slotCDeep, edgeFactor), 
        dExists
      );
      
      if (isHeaderFlag > 0.5) {
        color = mix(black, slotCEdge, dExists);
      }
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

// ─── Load Font ───
let sceneReady = false;
const loader = new FontLoader();
loader.load(
  './vendor/three/fonts/helvetiker_bold.typeface.json',
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
    const optsBlack = { font, size, depth, curveSegments, bevelEnabled: true, bevelThickness: 0.05, bevelSize: isHeader ? 0.4 : 0.24, bevelSegments: 1 };
    const optsWhite = { font, size, depth, curveSegments, bevelEnabled: true, bevelThickness: 0.05, bevelSize: isHeader ? 1.0 : 0.5, bevelSegments: 1 };

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

    mk(jGroup, jGeoWhite, mW, jP, jR, 1.0, -0.68);
    mk(logoGroup, dGeoWhite, mW.clone(), dP, dR, 1.0, -0.48);
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
    jMatLocal.uniforms.dMask.value = dMaskTarget.texture;
    jGeo.computeBoundingBox();
    jMatLocal.uniforms.jMaxX.value = jGeo.boundingBox.max.x;
    globalJMat = jMatLocal;
    mk(jGroup, jGeo, jMatLocal, jP, jR, 1.0, 0.08);

    // ── Interactive Border Flares ──
    jGeoWhite.computeBoundingBox();
    dGeoWhite.computeBoundingBox();

    function getClosestVertex(geo, targetPt) {
      const pos = geo.attributes.position;
      let minDist = Infinity;
      const closest = new THREE.Vector3();
      const temp = new THREE.Vector3();
      const zMax = geo.boundingBox.max.z;
      for (let i = 0; i < pos.count; i++) {
        temp.fromBufferAttribute(pos, i);
        if (temp.z < zMax - 0.2) continue;
        const d = temp.distanceTo(targetPt);
        if (d < minDist) {
          minDist = d;
          closest.copy(temp);
        }
      }
      return closest;
    }

    const jTargets = [
      new THREE.Vector3(-999, 999, 0),   // Top Left
      new THREE.Vector3(999, 999, 0),    // Top Right
      new THREE.Vector3(-999, 400, 0),   // Mid-Top Left
      new THREE.Vector3(-999, 0, 0),     // Mid Left
      new THREE.Vector3(-999, -400, 0),  // Mid-Bottom Left
      new THREE.Vector3(-999, -999, 0)   // Bottom Left hook
    ];

    const dTargets = [
      new THREE.Vector3(-999, 999, 0),   // Top Left of D
      new THREE.Vector3(999, 999, 0),    // Top Right
      new THREE.Vector3(999, 0, 0),      // Far Right curve
      new THREE.Vector3(999, -999, 0),   // Bottom Right
      new THREE.Vector3(-999, -999, 0),  // Bottom Left of D
      new THREE.Vector3(0, -999, 0)      // Bottom Center of D
    ];

    function nudgeInward(pt) {
      const len = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
      if (len > 0) {
        const shift = 0.04; // Moved out by 1px (from 0.06)
        pt.x -= (pt.x / len) * shift;
        pt.y -= (pt.y / len) * shift;
      }
      return pt;
    }

    const jFlaresGeo = new THREE.BufferGeometry().setFromPoints(
      jTargets.map(pt => nudgeInward(getClosestVertex(jGeoWhite, pt)))
    );
    const jHide = new Float32Array(jTargets.length).fill(0);
    jFlaresGeo.setAttribute('aMobileHide', new THREE.BufferAttribute(jHide, 1));

    const dFlaresGeo = new THREE.BufferGeometry().setFromPoints(
      dTargets.map(pt => nudgeInward(getClosestVertex(dGeoWhite, pt)))
    );
    const dHide = new Float32Array(dTargets.length).fill(0);
    dHide[4] = 1; // Bottom Left of D
    dHide[5] = 1; // Bottom Center of D
    dFlaresGeo.setAttribute('aMobileHide', new THREE.BufferAttribute(dHide, 1));

    const borderFlareMat = new THREE.ShaderMaterial({
      uniforms: {
        mouseWorldPos: { value: new THREE.Vector3(999, 999, 999) },
        pixelRatio: { value: PR },
        winHeight: { value: window.innerHeight },
        isMobile: { value: mob ? 1.0 : 0.0 }
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      vertexShader: `
        attribute float aMobileHide;
        uniform vec3 mouseWorldPos;
        uniform float pixelRatio;
        uniform float winHeight;
        uniform float isMobile;
        varying float vDistance;
        varying float vHidden;
        void main() {
          vHidden = (isMobile > 0.5 && aMobileHide > 0.5) ? 1.0 : 0.0;
          
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vDistance = distance(worldPosition.xy, mouseWorldPos.xy);
          
          vec4 mvPosition = viewMatrix * worldPosition;
          gl_Position = projectionMatrix * mvPosition;
          
          float sizeMult = smoothstep(4.0, 0.0, vDistance);
          float currentSize = (0.08 + (sizeMult * 0.35)) * 2.2; // Middle ground size
          
          gl_PointSize = (currentSize * winHeight * pixelRatio * 0.5) / -mvPosition.z;
        }
      `,
      fragmentShader: `
        varying float vDistance;
        varying float vHidden;
        void main() {
          if (vHidden > 0.5) discard;
          
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord) * 2.0; 
          
          float revealAlpha = smoothstep(4.0, 0.0, vDistance); // Wide reveal so gyroscope tilts are highly visible
          if (revealAlpha < 0.01) discard;
          
          float coreBright = smoothstep(0.1, 0.0, dist) * 0.5; // Very subtle core
          
          float fadeX = smoothstep(0.5, 0.0, abs(coord.x));
          float flareH = smoothstep(0.04, 0.0, abs(coord.y)) * fadeX;
          
          float fadeY = smoothstep(0.5, 0.0, abs(coord.y));
          float flareV = smoothstep(0.04, 0.0, abs(coord.x)) * fadeY;
          
          float diag1Dist = abs((coord.x - coord.y) * 0.7071);
          float diag1Fade = smoothstep(0.5, 0.0, abs((coord.x + coord.y) * 0.7071));
          float flareD1 = smoothstep(0.02, 0.0, diag1Dist) * diag1Fade * 0.2; // Subtle spikes
          
          float diag2Dist = abs((coord.x + coord.y) * 0.7071);
          float diag2Fade = smoothstep(0.5, 0.0, abs((coord.x - coord.y) * 0.7071));
          float flareD2 = smoothstep(0.02, 0.0, diag2Dist) * diag2Fade * 0.2; // Subtle spikes
          
          float totalFlare = coreBright + (flareH + flareV + flareD1 + flareD2) * 0.8; // Reduced overall intensity
          
          float finalAlpha = totalFlare * revealAlpha;
          if (finalAlpha < 0.01) discard;
          
          gl_FragColor = vec4(1.0, 1.0, 1.0, finalAlpha);
        }
      `
    });
    globalFlareMat = borderFlareMat;

    const jFlares = new THREE.Points(jFlaresGeo, borderFlareMat);
    jFlares.position.set(jP.x, jP.y, jP.z - 0.68 + 0.1);
    jFlares.rotation.copy(jR);
    jGroup.add(jFlares);

    const dFlares = new THREE.Points(dFlaresGeo, borderFlareMat);
    dFlares.position.set(dP.x, dP.y, dP.z - 0.48 + 0.1);
    dFlares.rotation.copy(dR);
    logoGroup.add(dFlares);

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

// ─── Mobile WebGL Glow ───
if (!isHeader) {
  const glowGeo = new THREE.PlaneGeometry(30, 30);
  globalMobileGlowMat = new THREE.ShaderMaterial({
    uniforms: { colorPhase: { value: 0.0 } },
    transparent: true, depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform float colorPhase;
      varying vec2 vUv;
      vec3 cmyColor(float idx) {
        float i = mod(idx, 3.0);
        if (i < 0.5) return vec3(0.0, 1.0, 1.0);
        else if (i < 1.5) return vec3(1.0, 0.0, 1.0);
        else return vec3(1.0, 1.0, 0.0);
      }
      void main() {
        float cur = floor(colorPhase);
        float t = colorPhase - cur;
        
        // Match exact color order of the desktop CSS drop shadow
        vec3 colLeft = mix(cmyColor(cur), cmyColor(cur+1.0), t);       // Cyan (offset 0)
        vec3 colRight = mix(cmyColor(cur+1.0), cmyColor(cur+2.0), t);  // Magenta (offset 1)
        vec3 colCenter = mix(cmyColor(cur+2.0), cmyColor(cur+3.0), t); // Yellow (offset 2)
        
        vec2 uv = vUv - vec2(0.5);
        
        // Match horizontal offsets of the -20px and 20px drop shadows
        vec2 uvLeft = uv - vec2(-0.06, 0.0); 
        vec2 uvCenter = uv - vec2(0.0, 0.0);
        vec2 uvRight = uv - vec2(0.06, 0.0);
        
        uvLeft.y *= 0.7;
        uvCenter.y *= 0.7;
        uvRight.y *= 0.7;
        
        // Match exact CSS opacities: Sides are dim (0.3), Center is medium (0.5), Core is tight (0.6)
        // Update: Boosted multipliers to make it brighter without expanding the radius
        float aLeft = smoothstep(0.12, 0.0, length(uvLeft)) * 0.6;
        float aRight = smoothstep(0.12, 0.0, length(uvRight)) * 0.6;
        float aCenter = smoothstep(0.15, 0.0, length(uvCenter)) * 0.85;
        
        float aCore = smoothstep(0.05, 0.0, length(uvCenter)) * 1.0;
        float aAmbient = smoothstep(0.4, 0.0, length(uvCenter)) * 0.35; // 120px background glow
        
        vec3 rgb = (colLeft * aLeft) + (colRight * aRight) + (colCenter * aCenter) + (colCenter * aAmbient) + (vec3(1.0) * aCore);
        float alpha = max(max(max(aLeft, aRight), max(aCenter, aAmbient)), aCore);
        
        gl_FragColor = vec4(rgb, alpha);
      }
    `
  });
  globalMobileGlowMesh = new THREE.Mesh(glowGeo, globalMobileGlowMat);
  globalMobileGlowMesh.position.z = -6;
  globalMobileGlowMesh.visible = mob;
  scene.add(globalMobileGlowMesh);
}

// ─── Particles ───
const pN = 400, pGeo = new THREE.BufferGeometry();
const pP = new Float32Array(pN * 3), pV = new Float32Array(pN * 3);
for (let i = 0; i < pN; i++) {
  const j = i * 3;
  pP[j] = (Math.random() - .5) * 60; pP[j + 1] = (Math.random() - .5) * 40; pP[j + 2] = (Math.random() - .5) * 15 - 10;
  pV[j] = (Math.random() - .5) * .003; pV[j + 1] = (Math.random() - .5) * .003;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pP, 3));
let globalParticleMat = null;
if (!isHeader) {
  globalParticleMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      pulse: { value: 0 },
      hoverPulse: { value: 0 },
      swirlAngle: { value: 0 },
      pixelRatio: { value: PR },
      winHeight: { value: window.innerHeight },
      aspectRatio: { value: window.innerWidth / window.innerHeight },
      mouseNDC: { value: new THREE.Vector2(-999, -999) },
      mRadius: { value: 0.4 }
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float time;
      uniform float pulse;
      uniform float hoverPulse;
      uniform float swirlAngle;
      uniform float pixelRatio;
      uniform float winHeight;
      uniform float aspectRatio;
      uniform vec2 mouseNDC;
      uniform float mRadius;
      
      varying vec3 vPos;
      varying float vMouseForce;
      void main() {
        vPos = position;
        
        // Continuous swirl effect around Z axis
        float angle = swirlAngle * 10.0 / (length(position.xy) + 2.0);
        float s = sin(angle);
        float c = cos(angle);
        vec3 pos = position;
        pos.x = position.x * c - position.y * s;
        pos.y = position.x * s + position.y * c;
        
        // Add chaotic noise movement on click
        float nX = sin(time * 4.0 + position.y * 0.3) * pulse * 0.4;
        float nY = cos(time * 4.0 + position.x * 0.3) * pulse * 0.4;
        pos.x += nX;
        pos.y += nY;
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vec4 projPos = projectionMatrix * mvPosition;
        
        // Mouse interact (grow only)
        vec2 screenPos = projPos.xy / projPos.w;
        vec2 dir = screenPos - mouseNDC;
        dir.x *= aspectRatio;
        float distToMouse = length(dir);
        float mForce = smoothstep(mRadius, 0.0, distToMouse);
        vMouseForce = mForce;
        
        gl_Position = projPos;
        
        // Base size logic. mForce multiplier heavily reduced to make mouse hover swelling much more subtle.
        float currentSize = (0.12 + (pulse * 0.4) + (hoverPulse * 0.15) + (mForce * 0.25)) * 5.0; 
        
        gl_PointSize = (currentSize * winHeight * pixelRatio * 0.5) / -mvPosition.z;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float pulse;
      uniform float hoverPulse;
      varying vec3 vPos;
      varying float vMouseForce;
      
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        
        // Scale distance by 5 to match the vertex shader multiplier
        float dist = length(coord) * 5.0;
        
        vec3 rainbow = hsv2rgb(vec3(vPos.x * 0.05 + vPos.y * 0.05 + time * 1.5, 1.0, 1.0));
        vec3 baseColor = vec3(1.0, 1.0, 1.0); 
        vec3 finalColor = mix(baseColor, rainbow, pulse);
        
        float alphaMult = smoothstep(0.5, 0.0, dist);
        
        // Total force driving the glow: use max() to prevent hover and click from stacking and blowing out!
        float glowForce = max(vMouseForce * 0.15, max(hoverPulse * 0.15, pulse * 0.15));
        
        float coreBrightness = smoothstep(0.15, 0.0, dist) * glowForce * 0.8;
        
        // Starburst lens flare (8 spikes)
        float fadeX = smoothstep(0.5, 0.0, abs(coord.x));
        float flareH = smoothstep(0.03, 0.0, abs(coord.y)) * fadeX;
        
        float fadeY = smoothstep(0.5, 0.0, abs(coord.y));
        float flareV = smoothstep(0.03, 0.0, abs(coord.x)) * fadeY;
        
        float diag1Dist = abs((coord.x - coord.y) * 0.7071);
        float diag1Fade = smoothstep(0.5, 0.0, abs((coord.x + coord.y) * 0.7071));
        float flareD1 = smoothstep(0.02, 0.0, diag1Dist) * diag1Fade * 0.6; // Slightly dimmer diagonals
        
        float diag2Dist = abs((coord.x + coord.y) * 0.7071);
        float diag2Fade = smoothstep(0.5, 0.0, abs((coord.x - coord.y) * 0.7071));
        float flareD2 = smoothstep(0.02, 0.0, diag2Dist) * diag2Fade * 0.6;
        
        float flare = (flareH + flareV + flareD1 + flareD2) * glowForce * 1.5;
        
        float totalExtraGlow = coreBrightness + flare;
        
        float baseAlpha = 0.35 + (hoverPulse * 0.15);
        float circleAlpha = (mix(baseAlpha, 0.9, pulse) + vMouseForce * 0.4) * alphaMult;
        
        float finalAlpha = circleAlpha + totalExtraGlow;
        if(finalAlpha < 0.01) discard;
        
        // Multiply by the original color to preserve the particle
        vec3 glowColor = finalColor * (1.0 + totalExtraGlow * 1.5);
        gl_FragColor = vec4(glowColor, finalAlpha);
      }
    `
  });
  scene.add(new THREE.Points(pGeo, globalParticleMat));
}

// ─── Mouse ───
const tR = { x: 0, y: 0 }, cR = { x: 0, y: 0 };

const mouseNDC = new THREE.Vector2(-999, -999);

// Hide gyro prompt on non-iOS devices (where requestPermission isn't required)
if (!(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function')) {
  const prompt = document.getElementById('gyro-prompt');
  if (prompt) prompt.style.display = 'none';
}

window.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();

  // Update NDC for hover detection
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
    mouseNDC.x = (x / rect.width) * 2 - 1;
    mouseNDC.y = -(y / rect.height) * 2 + 1;
  } else {
    mouseNDC.set(-999, -999);
  }

  if (mob) return;

  // Full parallax for header logo (thumbnail), just like homepage
  const pFact = isHeader ? 0.1 : 0.1;
  tR.y = ((e.clientX / window.innerWidth) * 2 - 1) * pFact;
  tR.x = -((e.clientY / window.innerHeight) * 2 - 1) * pFact;
});
window.addEventListener('mouseleave', () => { mouseNDC.set(-999, -999); });

// ─── Gyroscope (Mobile) ───
window.addEventListener('deviceorientation', e => {
  if (!mob || e.gamma === null) return;

  // Hide prompt automatically if we are receiving gyro data (means permission was already granted)
  const prompt = document.getElementById('gyro-prompt');
  if (prompt && prompt.style.display !== 'none') {
    prompt.style.display = 'none';
  }

  // clamp rotation values to prevent it from spinning too far
  let gamma = Math.max(-45, Math.min(45, e.gamma)); // Left/Right tilt
  let beta = Math.max(-45, Math.min(45, e.beta - 40)); // Up/Down tilt (assuming 40deg neutral angle)

  // Even more sensitive gyroscope for header logo (thumbnail) than homepage
  const gyroFact = isHeader ? 0.25 : 0.15;
  tR.y = (gamma / 45) * gyroFact;
  tR.x = (beta / 45) * gyroFact;
});

// ─── Color Cycle on Click ───
// The colour combo is persisted in sessionStorage so it carries from page to
// page (and stays matched across the cross-page logo morph) instead of
// resetting to the default combo on every fresh navigation.
let storedPhase = 0;
try { storedPhase = Math.round(parseFloat(sessionStorage.getItem('jdColorPhase')) || 0); } catch (e) { /* private mode */ }
let colorPhaseTarget = storedPhase;
let colorPhaseCurrent = storedPhase;
let particlePulse = 0;
let hoverPulseVal = 0;
let globalSwirlAngle = 0;

function persistColorPhase() {
  try { sessionStorage.setItem('jdColorPhase', String(Math.round(colorPhaseTarget))); } catch (e) { /* private mode */ }
}

window.addEventListener('click', () => {
  colorPhaseTarget += 1;
  particlePulse = 1.0;
  persistColorPhase();
});

// Request gyroscope permission for iOS devices on first interaction anywhere
let gyroRequested = false;
const requestGyro = () => {
  if (gyroRequested) return;

  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    gyroRequested = true;
    DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          // permission granted
        }
      })
      .catch(console.error);
  }

  const prompt = document.getElementById('gyro-prompt');
  if (prompt) {
    prompt.style.animation = 'none';
    prompt.style.display = 'none';
  }

  window.removeEventListener('click', requestGyro);
  window.removeEventListener('touchend', requestGyro);
  document.body.removeEventListener('click', requestGyro);
  document.body.removeEventListener('touchend', requestGyro);
};
// Homepage only: on interior pages this first-tap permission request can
// pop the iOS motion dialog on top of a nav tap, eating the navigation.
if (!isHeader) {
  window.addEventListener('click', requestGyro);
  window.addEventListener('touchend', requestGyro);
  document.body.addEventListener('click', requestGyro);
  document.body.addEventListener('touchend', requestGyro);
  canvas.addEventListener('click', requestGyro);
  canvas.addEventListener('touchend', requestGyro);
  canvas.style.cursor = 'pointer';
}

// ─── Party Mode (raycast hover over logo) ───
let partyMode = false;
const raycaster = new THREE.Raycaster();

window.addEventListener('resize', () => {
  let w, h;
  if (isHeader) {
    w = canvas.clientWidth || 30;
    h = canvas.clientHeight || 30;
  } else {
    w = window.innerWidth;
    h = window.innerHeight;
  }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  const pr = Math.min(window.devicePixelRatio, 2);
  const maskPR = mob ? pr : (pr * 2);
  dMaskTarget.setSize(w * maskPR, h * maskPR);
  // resolution maps gl_FragCoord (main framebuffer, sized at PR) to the mask UV,
  // so it must use PR — not maskPR, which would halve the UV and black out the J.
  if (globalJMat) globalJMat.uniforms.resolution.value.set(w * PR, h * PR);
  if (globalMobileGlowMesh) globalMobileGlowMesh.visible = mob;
  if (globalParticleMat) {
    globalParticleMat.uniforms.aspectRatio.value = w / h;
    globalParticleMat.uniforms.winHeight.value = h;
  }
  if (globalFlareMat) {
    globalFlareMat.uniforms.winHeight.value = h;
    globalFlareMat.uniforms.isMobile.value = mob ? 1.0 : 0.0;
  }
});

// ─── Animate ───
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  cR.x += (tR.x - cR.x) * 0.07;
  cR.y += (tR.y - cR.y) * 0.07;

  const logoScale = mob && !isHeader ? 0.8 : 1.0;
  // Sync all groups
  for (const g of allGroups) {
    g.rotation.x = cR.x;
    g.rotation.y = cR.y;
    g.scale.set(logoScale, logoScale, logoScale);

    // Shift the entire logo slightly to the left on mobile to improve framing
    g.position.x = mob && !isHeader ? -0.25 : 0;
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

    // On mobile, use the gyroscope tilt directly to move the virtual cursor into quadrants
    if (mob && !isHeader) {
      // Map gyroscope tilt directly to screen corners. 
      // Multiplier of 1.5 ensures a comfortable tilt pushes the cursor fully into a quadrant.
      mouseNDC.x = (cR.y / 0.15) * 1.5;
      mouseNDC.y = (-cR.x / 0.15) * 1.5;
    }

    // Raycast to detect hover over the logo meshes (Disable for mobile)
    raycaster.setFromCamera(mouseNDC, camera);
    const intersects = raycaster.intersectObjects(logoGroup.children, true);
    const wasParty = partyMode;
    partyMode = !mob && intersects.length > 0;
    canvas.style.cursor = partyMode ? 'pointer' : 'default';

    // Pass world intersection point to border flares
    if (mob && !isHeader && globalFlareMat) {
      // Light sweeps exclusively based on gyroscope tilt
      const simX = cR.y * 15.0;
      const simY = -cR.x * 15.0;
      globalFlareMat.uniforms.mouseWorldPos.value.set(simX, simY, 0);
    } else if (partyMode && !isHeader && globalFlareMat) {
      globalFlareMat.uniforms.mouseWorldPos.value.copy(intersects[0].point);
    } else if (globalFlareMat) {
      globalFlareMat.uniforms.mouseWorldPos.value.set(999, 999, 999);
    }

    // Party mode: rapidly cycle colors while hovering over logo
    if (partyMode) {
      colorPhaseTarget += isHeader ? 0.015 : 0.06;
    } else if (wasParty) {
      // Snap to nearest clean CMY color on exit
      colorPhaseTarget = Math.round(colorPhaseTarget);
      persistColorPhase();
    }

    // Smoothly animate color phase toward target
    colorPhaseCurrent += (colorPhaseTarget - colorPhaseCurrent) * 0.25;
    dSplitShader.uniforms.colorPhase.value = colorPhaseCurrent;
    jOverlapShader.uniforms.colorPhase.value = colorPhaseCurrent;
    if (globalMobileGlowMat) globalMobileGlowMat.uniforms.colorPhase.value = colorPhaseCurrent;

    // Decay the particle pulse and animate the hover pulse
    particlePulse += (0.0 - particlePulse) * 0.04;
    hoverPulseVal += ((partyMode ? 1.0 : 0.0) - hoverPulseVal) * 0.1;

    // Accumulate swirl angle (reverse direction, base slow rotation + smaller burst of speed on click)
    globalSwirlAngle -= 0.002 + (particlePulse * 0.02);

    if (globalParticleMat) {
      globalParticleMat.uniforms.time.value = t;
      globalParticleMat.uniforms.pulse.value = particlePulse;
      globalParticleMat.uniforms.hoverPulse.value = hoverPulseVal;
      globalParticleMat.uniforms.swirlAngle.value = globalSwirlAngle;
      globalParticleMat.uniforms.mouseNDC.value.copy(mouseNDC);

      // Set radius to cover roughly a quarter of the screen (a quadrant)
      globalParticleMat.uniforms.mRadius.value = mob && !isHeader ? 1.4 : 0.4;
    }

    // Dynamic vertical gradient glow matching the cycle (Desktop Only)
    if (!isHeader && !mob) {
      const getCmyColor = (idx) => {
        const i = ((idx % 3) + 3) % 3;
        if (i < 0.5) return [0, 255, 255]; // Cyan
        if (i < 1.5) return [255, 0, 255]; // Magenta
        return [255, 255, 0]; // Yellow
      };

      const getCycleColor = (offset, alpha = 0.45, desaturate = 0) => {
        const phase = colorPhaseCurrent + offset;
        const cur = Math.floor(phase);
        const t = phase - cur;
        const c1 = getCmyColor(cur);
        const c2 = getCmyColor(cur + 1);

        const r = c1[0] + (c2[0] - c1[0]) * t;
        const g = c1[1] + (c2[1] - c1[1]) * t;
        const b = c1[2] + (c2[2] - c1[2]) * t;

        const fR = Math.round(r + (255 - r) * desaturate);
        const fG = Math.round(g + (255 - g) * desaturate);
        const fB = Math.round(b + (255 - b) * desaturate);

        return `rgba(${fR}, ${fG}, ${fB}, ${alpha})`;
      };

      canvas.style.filter = `drop-shadow(-20px 0px 10px ${getCycleColor(0, 0.2)}) drop-shadow(0px 0px 20px ${getCycleColor(2, 0.4)}) drop-shadow(20px 0px 10px ${getCycleColor(1, 0.2)}) drop-shadow(0px 0px 4px ${getCycleColor(2, 0.6, 0.7)}) drop-shadow(0px 0px 120px ${getCycleColor(2, 0.25)})`;
    } else if (mob) {
      canvas.style.filter = 'none';
      canvas.style.willChange = 'auto';
    }
  }

  // Particles
  const a = pGeo.attributes.position.array;
  for (let i = 0; i < pN; i++) {
    const j = i * 3;
    a[j] += pV[j]; a[j + 1] += pV[j + 1];
    if (a[j] > 30) a[j] = -30; if (a[j] < -30) a[j] = 30;
    if (a[j + 1] > 20) a[j + 1] = -20; if (a[j + 1] < -20) a[j + 1] = 20;
  }
  pGeo.attributes.position.needsUpdate = true;

  // Render the D into the mask texture (anti-aliased)
  renderer.setRenderTarget(dMaskTarget);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(dDepthScene, camera);

  // Render main scene to screen
  renderer.setRenderTarget(null);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);

  // Once the real logo has rendered, remove the snapshot background bridge
  if (snapshotActive && sceneReady) {
    canvas.style.backgroundImage = '';
    canvas.style.backgroundSize = '';
    canvas.style.backgroundRepeat = '';
    canvas.style.backgroundPosition = '';
    snapshotActive = false;
  }
}
animate();

// ─── Outgoing snapshot bridge ───
// On navigation away, capture the live canvas so the destination page can
// use it as a morph-target background while its own WebGL boots.
window.addEventListener('pageswap', () => {
  try {
    const dataURL = canvas.toDataURL('image/png');
    sessionStorage.setItem('jdLogoSnapshot', dataURL);
  } catch (e) { /* security / private mode */ }
});
