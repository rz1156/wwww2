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

// V-sign detection: index & middle up, ring & pinky down, thumb tucked
function isVSign(landmarks) {
    // Finger tip and pip (knuckle) indices
    // thumb=4, index=8, middle=12, ring=16, pinky=20
    // pip: index=6, middle=10, ring=14, pinky=18

    const tip = (i) => landmarks[i];
    const pip = (i) => landmarks[i - 2];

    const indexUp  = tip(8).y  < pip(6).y;
    const middleUp = tip(12).y < pip(10).y;
    const ringDown = tip(16).y > pip(14).y;
    const pinkyDown= tip(20).y > pip(18).y;

    // Thumb: tip x should be close to palm, not extended outward
    // (works for both hands via relative check)
    const thumbTip  = landmarks[4];
    const thumbMcp  = landmarks[2];
    const wrist     = landmarks[0];
    const thumbExtended = Math.abs(thumbTip.x - wrist.x) > Math.abs(thumbMcp.x - wrist.x) * 1.3;

    return indexUp && middleUp && ringDown && pinkyDown && !thumbExtended;
}

async function startCamera(){

    const stream = await navigator.mediaDevices.getUserMedia({

        video:true

    });

    video.srcObject = stream;

}

startCamera();

const hands = new Hands({

    locateFile:(file)=>{

        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;

    }

});

hands.setOptions({

    maxNumHands:2,

    modelComplexity:1,

    minDetectionConfidence:0.7,

    minTrackingConfidence:0.7

});

hands.onResults(onResults);

const camera = new Camera(video,{

    onFrame:async()=>{

        await hands.send({

            image:video

        });

    },

    width:1280,

    height:720

});

camera.start();

function onResults(results){

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0,0,canvas.width,canvas.height);

    let vSignDetected = false;

    if(results.multiHandLandmarks){

        for(const landmarks of results.multiHandLandmarks){

            drawConnectors(
                ctx,
                landmarks,
                HAND_CONNECTIONS,
                {
                    color:"#ffffff",
                    lineWidth:2
                }
            );

            drawLandmarks(
                ctx,
                landmarks,
                {
                    color:"#00ffff",
                    fillColor:"#ffffff",
                    radius:5
                }
            );

            if(isVSign(landmarks)){
                vSignDetected = true;
            }

        }

    }

    // Hysteresis: require N consecutive frames to switch state
    if(vSignDetected){
        detectedFrames++;
        lostFrames = 0;
        if(detectedFrames >= FRAMES_TO_CONFIRM){
            setBlur(true);
        }
    } else {
        lostFrames++;
        detectedFrames = 0;
        if(lostFrames >= FRAMES_TO_RELEASE){
            setBlur(false);
        }
    }

}
