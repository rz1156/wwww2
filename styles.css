const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Blur state with hysteresis to prevent flicker
let detectedFrames = 0;
let lostFrames = 0;
let cameraBlur = false;
const FRAMES_TO_CONFIRM = 3;
const FRAMES_TO_RELEASE = 3;

function setBlur(active) {
    if (cameraBlur === active) return;
    cameraBlur = active;
    video.style.filter = active ? "blur(12px)" : "blur(0px)";
}

// V-sign: index & middle up, ring & pinky down, thumb tucked
function isVSign(landmarks) {
    const tip = (i) => landmarks[i];
    const pip = (i) => landmarks[i - 2];

    const indexUp   = tip(8).y  < pip(6).y;
    const middleUp  = tip(12).y < pip(10).y;
    const ringDown  = tip(16).y > pip(14).y;
    const pinkyDown = tip(20).y > pip(18).y;

    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    const wrist    = landmarks[0];
    const thumbExtended = Math.abs(thumbTip.x - wrist.x) > Math.abs(thumbMcp.x - wrist.x) * 1.3;

    return indexUp && middleUp && ringDown && pinkyDown && !thumbExtended;
}

// Convert normalized landmark (0–1) to canvas pixel coords,
// accounting for object-fit:cover crop and mirror flip.
function landmarkToCanvas(lm, videoW, videoH, canvasW, canvasH) {
    // object-fit: cover scale — fill the canvas, crop the excess
    const scaleX = canvasW / videoW;
    const scaleY = canvasH / videoH;
    const scale  = Math.max(scaleX, scaleY);

    const renderedW = videoW * scale;
    const renderedH = videoH * scale;

    // Offset of the cropped video inside the canvas (centred)
    const offsetX = (canvasW - renderedW) / 2;
    const offsetY = (canvasH - renderedH) / 2;

    // Raw pixel position in the rendered (but not mirrored) frame
    const rawX = lm.x * renderedW + offsetX;
    const rawY = lm.y * renderedH + offsetY;

    // Mirror horizontally to match CSS scaleX(-1) on both video & canvas
    const mirroredX = canvasW - rawX;

    return { x: mirroredX, y: rawY };
}

// Draw skeleton manually so coordinates match the displayed video
function drawHand(landmarks, canvasW, canvasH) {
    const videoW = video.videoWidth  || 1280;
    const videoH = video.videoHeight || 720;

    // Convert all landmarks once
    const pts = landmarks.map(lm => landmarkToCanvas(lm, videoW, videoH, canvasW, canvasH));

    // Draw connections
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.stroke();
    }

    // Draw landmark dots
    for (const pt of pts) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
}

startCamera();

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
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 1280,
    height: 720
});

camera.start();

function onResults(results) {
    // Match canvas internal resolution to its CSS display size
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  || canvas.offsetWidth;
    canvas.height = rect.height || canvas.offsetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let vSignDetected = false;

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawHand(landmarks, canvas.width, canvas.height);

            if (isVSign(landmarks)) {
                vSignDetected = true;
            }
        }
    }

    // Hysteresis
    if (vSignDetected) {
        detectedFrames++;
        lostFrames = 0;
        if (detectedFrames >= FRAMES_TO_CONFIRM) setBlur(true);
    } else {
        lostFrames++;
        detectedFrames = 0;
        if (lostFrames >= FRAMES_TO_RELEASE) setBlur(false);
    }
}
