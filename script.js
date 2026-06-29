document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. CUSTOM CURSOR & SMOOTH TRAIL ---
    const cursorDot = document.getElementById('cursor-dot');
    const cursorOutline = document.getElementById('cursor-outline');
    let mouseX = 0, mouseY = 0;
    let outlineX = 0, outlineY = 0;

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Dot follows instantly
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;
    });

    // RequestAnimationFrame for smooth outline trailing
    function animateCursor() {
        let distX = mouseX - outlineX;
        let distY = mouseY - outlineY;
        
        outlineX += distX * 0.15; // Kecepatan mengikuti (easing)
        outlineY += distY * 0.15;
        
        cursorOutline.style.left = `${outlineX}px`;
        cursorOutline.style.top = `${outlineY}px`;
        
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover effect pada elemen interaktif
    const interactives = document.querySelectorAll('button, video');
    interactives.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursorOutline.style.width = '60px';
            cursorOutline.style.height = '60px';
            cursorOutline.style.background = 'rgba(0, 240, 255, 0.1)';
        });
        el.addEventListener('mouseleave', () => {
            cursorOutline.style.width = '40px';
            cursorOutline.style.height = '40px';
            cursorOutline.style.background = 'transparent';
        });
    });

    // --- 2. 3D TILT EFFECT (APPLE/LINEAR STYLE) ---
    const tiltWrapper = document.getElementById('tilt-wrapper');
    const glassCard = document.querySelector('.glass-card');

    window.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        const middleX = window.innerWidth / 2;
        const middleY = window.innerHeight / 2;

        const offsetX = ((x - middleX) / middleX) * 10; // Maksimal rotasi 10 derajat
        const offsetY = ((y - middleY) / middleY) * 10;

        // Terapkan rotasi ke wrapper
        tiltWrapper.style.transform = `perspective(1000px) rotateX(${-offsetY}deg) rotateY(${offsetX}deg)`;
    });

    // Reset posisi saat kursor keluar layar
    document.addEventListener('mouseleave', () => {
        tiltWrapper.style.transition = 'transform 0.5s ease-out';
        tiltWrapper.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
    });
    
    document.addEventListener('mouseenter', () => {
        tiltWrapper.style.transition = 'none'; // Hapus transisi agar mengikuti kursor secara realtime
    });

    // --- 3. MAGNETIC BUTTON & SPOTLIGHT HOVER ---
    const magBtn = document.getElementById('calibrate-btn');
    const btnGlow = magBtn.querySelector('.btn-glow');

    magBtn.addEventListener('mousemove', (e) => {
        const rect = magBtn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Spotlight glow effect
        btnGlow.style.opacity = '1';
        btnGlow.style.left = `${x}px`;
        btnGlow.style.top = `${y}px`;

        // Magnetic pull
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const pullX = (x - centerX) * 0.2;
        const pullY = (y - centerY) * 0.2;
        
        magBtn.style.transform = `translate(${pullX}px, ${pullY}px)`;
    });

    magBtn.addEventListener('mouseleave', () => {
        btnGlow.style.opacity = '0';
        magBtn.style.transform = `translate(0px, 0px)`;
    });

    // --- 4. TYPEWRITER EFFECT ---
    const titleEl = document.getElementById('typewriter-title');
    const text = "SYSTEM.VISION.INITIALIZED";
    let i = 0;
    
    function typeWriter() {
        if (i < text.length) {
            titleEl.innerHTML += text.charAt(i);
            i++;
            setTimeout(typeWriter, 50); // Kecepatan ketik
        }
    }
    setTimeout(typeWriter, 500);

    // --- 5. MEDIAPIPE INITIALIZATION ---
    // (Boilerplate bawaan Anda diintegrasikan di sini)
    const videoElement = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const canvasCtx = canvasElement.getContext('2d');

    // Set resolusi canvas sama dengan ukuran card
    canvasElement.width = 800;
    canvasElement.height = 450;

    function onResults(results) {
        // Tampilkan video dengan transisi fade in saat frame pertama masuk
        if (videoElement.style.opacity === "0" || videoElement.style.opacity === "") {
            videoElement.style.opacity = "1";
        }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Gambar kustomisasi garis tangan (neon style)
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                    color: '#00f0ff', 
                    lineWidth: 3
                });
                drawLandmarks(canvasCtx, landmarks, {
                    color: '#ffffff', 
                    lineWidth: 1, 
                    radius: 3
                });
            }
        }
        canvasCtx.restore();
    }

    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
        },
        width: 1280,
        height: 720
    });
    
    camera.start();
});
