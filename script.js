/* ═══════════════════════════════════════════════════════════════
   ADVANCED CINEMATIC HAND TRACKING — script.js
   ═══════════════════════════════════════════════════════════════ */

// ── DOM refs ────────────────────────────────────────────────────
const video           = document.getElementById('video');
const canvas          = document.getElementById('canvas');
const particleCanvas  = document.getElementById('particleCanvas');
const container       = document.getElementById('cameraContainer');
const vignette        = document.getElementById('vignette');
const hud             = document.getElementById('hud');
const hudLabel        = document.getElementById('hudLabel');
const hudSub          = document.getElementById('hudSub');
const barTop          = document.getElementById('barTop');
const barBottom       = document.getElementById('barBottom');
const ctx             = canvas.getContext('2d');
const pCtx            = particleCanvas.getContext('2d');

// ── State ────────────────────────────────────────────────────────
let vSignFrames   = 0;
let lostFrames    = 0;
let isActive      = false;
let cinemaMode    = false;
let cinemaTimer   = null;

// Smooth values (interpolated every rAF)
let currentBlur       = 0;
let targetBlur        = 0;
let currentScale      = 1;
let targetScale       = 1;
let currentContrast   = 1;
let targetContrast    = 1;
let currentSaturate   = 1;
let targetSaturate    = 1;
let currentBrightness = 1;
let targetBrightness  = 1;
let currentVignette   = 0; // 0-1
let targetVignette    = 0;

// Focus-hunt state
let focusPhase        = 'idle'; // idle | hunting | locking | active | releasing
let focusHuntStart    = 0;
let blurSteps         = [0, 2, 4, 3, 8, 12];
let blurStepIdx       = 0;

// Focus breathing
let breathPhase       = 0;

// Particles
const PARTICLE_COUNT  = 38;
let particles         = [];
let particlesVisible  = false;

// ── Camera start ────────────────────────────────────────────────
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
}
startCamera();

// ── MediaPipe ────────────────────────────────────────────────────
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});
hands.onResults(onResults);

const camera = new Camera(video, {
  onFrame: async () => { await hands.send({ image: video }); },
  width: 1280,
  height: 720
});
camera.start();

// ── Gesture detection ────────────────────────────────────────────
function isVSign(landmarks) {
  // fingertip indices: index=8, middle=12, ring=16, pinky=20
  // pip (knuckle) indices: index=6, middle=10, ring=14, pinky=18
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];

  const indexUp  = landmarks[8].y  < landmarks[6].y;
  const middleUp = landmarks[12].y < landmarks[10].y;
  const ringDown = landmarks[16].y > landmarks[14].y;
  const pinkyDown= landmarks[20].y > landmarks[18].y;
  const thumbDown= landmarks[4].y  > landmarks[3].y;

  return indexUp && middleUp && ringDown && pinkyDown;
}

// ── Results handler ──────────────────────────────────────────────
function onResults(results) {
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let vDetected = false;

  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#ffffff', lineWidth: 2 });
      drawLandmarks(ctx, landmarks, { color: '#00ffff', fillColor: '#ffffff', radius: 5 });
      if (isVSign(landmarks)) vDetected = true;
    }
  }

  if (vDetected) {
    vSignFrames++;
    lostFrames = 0;
  } else {
    lostFrames++;
    vSignFrames = 0;
  }

  // Activation thresholds
  if (!isActive && vSignFrames >= 5) {
    activateCinematic();
  }
  if (isActive && lostFrames >= 5) {
    deactivateCinematic();
  }

  // 2-second hold → Cinema Mode
  if (isActive && !cinemaMode && !cinemaTimer) {
    cinemaTimer = setTimeout(() => {
      if (isActive) enterCinemaMode();
    }, 2000);
  }
}

// ── Activate / Deactivate ────────────────────────────────────────
function activateCinematic() {
  if (isActive) return;
  isActive    = true;
  focusPhase  = 'hunting';
  focusHuntStart = performance.now();
  blurStepIdx = 0;

  targetScale      = 1.03;
  targetContrast   = 1.12;
  targetSaturate   = 1.14;
  targetBrightness = 0.93;
  targetVignette   = 1;

  vignette.classList.add('active');
  barTop.classList.add('active');
  barBottom.classList.add('active');

  setTimeout(() => {
    hud.classList.add('active');
    particleCanvas.classList.add('active');
    particlesVisible = true;
  }, 350);
}

function deactivateCinematic() {
  if (!isActive) return;
  isActive    = false;
  cinemaMode  = false;
  focusPhase  = 'releasing';

  clearTimeout(cinemaTimer);
  cinemaTimer = null;

  targetBlur       = 0;
  targetScale      = 1;
  targetContrast   = 1;
  targetSaturate   = 1;
  targetBrightness = 1;
  targetVignette   = 0;

  hud.classList.remove('active');
  vignette.classList.remove('active');
  barTop.classList.remove('active');
  barBottom.classList.remove('active');
  container.classList.remove('cinema-mode');
  particleCanvas.classList.remove('active');
  particlesVisible = false;

  hudLabel.textContent = 'FOCUS MODE';
  hudSub.textContent   = 'DEPTH OF FIELD ACTIVE';
}

function enterCinemaMode() {
  cinemaMode = true;
  container.classList.add('cinema-mode');
  targetBlur       = 18;
  targetScale      = 1.05;
  targetContrast   = 1.22;
  targetSaturate   = 1.18;
  targetBrightness = 0.88;

  hudLabel.textContent = 'CINEMA MODE ACTIVE';
  hudSub.textContent   = 'CINEMATIC DEPTH ENGAGED';
}

// ── Smooth interpolation ─────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

// ── Focus hunting simulation ──────────────────────────────────────
function updateFocusHunt(now) {
  if (focusPhase === 'hunting') {
    const elapsed = now - focusHuntStart;
    // Simulate hunting: oscillate blur briefly
    const huntDuration = 600; // ms
    if (elapsed < huntDuration) {
      const t = elapsed / huntDuration;
      // Hunt: 0 → 4 → 2 → 6 → 3
      const huntCurve = Math.sin(t * Math.PI * 3) * 3 + 3;
      targetBlur = huntCurve;
    } else {
      focusPhase = 'locking';
      focusHuntStart = now;
    }
  } else if (focusPhase === 'locking') {
    const elapsed = now - focusHuntStart;
    if (elapsed < 700) {
      // Ease into final blur
      const t = elapsed / 700;
      const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
      targetBlur = cinemaMode ? lerp(3, 18, ease) : lerp(3, 12, ease);
    } else {
      focusPhase = 'active';
      targetBlur = cinemaMode ? 18 : 12;
    }
  } else if (focusPhase === 'releasing') {
    // Handled by lerp naturally
    if (currentBlur < 0.2) focusPhase = 'idle';
  }
}

// ── Focus breathing ───────────────────────────────────────────────
function getFocusBreath(now) {
  if (!isActive || focusPhase !== 'active') return 0;
  return Math.sin(now / 2200) * 0.005; // ±0.005 on scale
}

// ── Apply CSS vars ────────────────────────────────────────────────
function applyCSSVars() {
  const v = vignette;
  container.style.setProperty('--cam-blur',       `${currentBlur.toFixed(2)}px`);
  container.style.setProperty('--cam-contrast',    currentContrast.toFixed(4));
  container.style.setProperty('--cam-saturate',    currentSaturate.toFixed(4));
  container.style.setProperty('--cam-brightness',  currentBrightness.toFixed(4));
  // Apply directly since CSS transitions handle it via class
  video.style.filter = `blur(${currentBlur.toFixed(2)}px) contrast(${currentContrast.toFixed(3)}) saturate(${currentSaturate.toFixed(3)}) brightness(${currentBrightness.toFixed(3)})`;
  vignette.style.opacity = (currentVignette * 0.15).toFixed(3); // max 15%
  if (isActive || focusPhase === 'releasing') {
    vignette.style.opacity = (currentVignette * (cinemaMode ? 0.25 : 0.15)).toFixed(3);
  }
}

// ── Particles ─────────────────────────────────────────────────────
function initParticles(w, h) {
  particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle(w, h));
}

function createParticle(w, h) {
  return {
    x:     Math.random() * w,
    y:     Math.random() * h,
    vx:    (Math.random() - 0.5) * 0.4,
    vy:    -(Math.random() * 0.5 + 0.1),
    size:  Math.random() * 2.5 + 0.5,
    alpha: Math.random() * 0.5 + 0.1,
    life:  Math.random(),
    decay: Math.random() * 0.003 + 0.001,
    hue:   Math.random() * 40 + 185 // cyan-blue range
  };
}

function updateParticles(w, h) {
  if (!particlesVisible) { pCtx.clearRect(0, 0, w, h); return; }

  pCtx.clearRect(0, 0, w, h);

  for (let p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;

    if (p.life <= 0 || p.y < 0 || p.x < 0 || p.x > w) {
      Object.assign(p, createParticle(w, h));
      p.y = h;
    }

    const a = Math.max(0, p.life) * p.alpha;
    pCtx.save();
    pCtx.globalAlpha = a;
    const grad = pCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
    grad.addColorStop(0, `hsla(${p.hue}, 100%, 80%, 1)`);
    grad.addColorStop(1, `hsla(${p.hue}, 100%, 60%, 0)`);
    pCtx.fillStyle = grad;
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
    pCtx.fill();
    pCtx.restore();
  }
}

// ── Main render loop ──────────────────────────────────────────────
const LERP_SPEED = 0.045; // smoothing factor

function renderLoop(now) {
  updateFocusHunt(now);

  const breath = getFocusBreath(now);

  // Smooth all values
  currentBlur       = lerp(currentBlur,       targetBlur,       LERP_SPEED);
  currentScale      = lerp(currentScale,       targetScale + breath, LERP_SPEED);
  currentContrast   = lerp(currentContrast,    targetContrast,   LERP_SPEED);
  currentSaturate   = lerp(currentSaturate,    targetSaturate,   LERP_SPEED);
  currentBrightness = lerp(currentBrightness,  targetBrightness, LERP_SPEED);
  currentVignette   = lerp(currentVignette,    targetVignette,   LERP_SPEED);

  // Apply scale to container
  container.style.transform = `scale(${currentScale.toFixed(5)})`;

  applyCSSVars();

  // Particle system (use landmark canvas dimensions)
  const pw = particleCanvas.width  = canvas.width  || 1280;
  const ph = particleCanvas.height = canvas.height || 720;
  if (particles.length === 0) initParticles(pw, ph);
  updateParticles(pw, ph);

  requestAnimationFrame(renderLoop);
}

requestAnimationFrame(renderLoop);
