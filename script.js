
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const bestScoreElement = document.getElementById("bestScore");

const overlay = document.getElementById("overlay");
const overlayIcon = document.getElementById("overlayIcon");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

let score = 0;
let lives = 3;
let level = 1;
let bestScore = Number(localStorage.getItem("catchItBest")) || 0;

let gameRunning = false;
let lastTime = 0;
let spawnTimer = 0;
let animationId = null;
let audioContext = null;

let items = [];
let particles = [];
let keys = {};

const basket = {
    x: WIDTH / 2,
    y: HEIGHT - 65,
    width: 95,
    height: 55,
    speed: 430
};

const objectTypes = [
    { emoji: "🍎", points: 10, type: "fruit" },
    { emoji: "🍊", points: 10, type: "fruit" },
    { emoji: "🍇", points: 10, type: "fruit" },
    { emoji: "🍓", points: 10, type: "fruit" },
    { emoji: "⭐", points: 25, type: "star" },
    { emoji: "💣", points: 0, type: "bomb" }
];

bestScoreElement.textContent = bestScore;

// SONIDOS
function playSound(frequency, duration, type = "sine") {
    try {
        if (!audioContext) {
            audioContext = new (
                window.AudioContext || window.webkitAudioContext
            )();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.12, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        console.warn("No se pudo reproducir el sonido:", error);
    }
}

// FONDO DEL JUEGO
const stars = Array.from({ length: 65 }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    size: Math.random() * 2 + 1,
    alpha: Math.random() * 0.6 + 0.2
}));

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#111a32");
    gradient.addColorStop(1, "#202044");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    stars.forEach(star => {
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.globalAlpha = 1;

    // Suelo
    ctx.fillStyle = "#30245b";
    ctx.fillRect(0, HEIGHT - 12, WIDTH, 12);

    ctx.fillStyle = "#8b5cf6";
    ctx.fillRect(0, HEIGHT - 12, WIDTH, 3);
}

// CANASTA
function drawBasket() {
    ctx.font = "70px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧺", basket.x, basket.y);
}

// CREAR OBJETOS
function createItem() {
    const selected = objectTypes[
        Math.floor(Math.random() * objectTypes.length)
    ];

    items.push({
        x: 35 + Math.random() * (WIDTH - 70),
        y: -35,
        size: selected.type === "bomb" ? 38 : 35,
        emoji: selected.emoji,
        points: selected.points,
        type: selected.type,
        speed: 170 + level * 28 + Math.random() * 60
    });
}

// DIBUJAR OBJETOS
function drawItems() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    items.forEach(item => {
        ctx.font = `${item.size}px serif`;
        ctx.fillText(item.emoji, item.x, item.y);
    });
}

// PARTÍCULAS
function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 180,
            vy: (Math.random() - 0.5) * 180,
            life: 0.5,
            color
        });
    }
}

function updateParticles(deltaTime) {
    particles.forEach(particle => {
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.life -= deltaTime;
    });

    particles = particles.filter(particle => particle.life > 0);
}

function drawParticles() {
    particles.forEach(particle => {
        ctx.globalAlpha = Math.max(0, particle.life / 0.5);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.globalAlpha = 1;
}

// ACTUALIZAR INFORMACIÓN
function updateStats() {
    scoreElement.textContent = score;
    livesElement.textContent = "❤️".repeat(lives) + "🖤".repeat(3 - lives);
    levelElement.textContent = level;
}

// DETECTAR COLISIONES
function checkCollision(item) {
    const basketLeft = basket.x - basket.width / 2;
    const basketRight = basket.x + basket.width / 2;
    const basketTop = basket.y - basket.height / 2;

    const itemLeft = item.x - item.size / 2;
    const itemRight = item.x + item.size / 2;
    const itemBottom = item.y + item.size / 2;

    return (
        itemRight > basketLeft &&
        itemLeft < basketRight &&
        itemBottom > basketTop &&
        item.y < basket.y + basket.height / 2
    );
}

// PROCESAR OBJETOS
function updateItems(deltaTime) {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];

        item.y += item.speed * deltaTime;

        if (checkCollision(item)) {
            if (item.type === "bomb") {
                lives--;
                playSound(130, 0.25, "sawtooth");
                createParticles(item.x, item.y, "#ff4d6d");

                if (lives <= 0) {
                    lives = 0;
                    items.splice(i, 1);
                    updateStats();
                    endGame();
                    return;
                }
            } else {
                score += item.points;
                playSound(
                    item.type === "star" ? 880 : 600,
                    0.12
                );
                createParticles(item.x, item.y, "#38d9e6");
            }

            items.splice(i, 1);
            updateLevel();
            updateStats();
            continue;
        }

        // Eliminar objetos que salen de la pantalla
        if (item.y > HEIGHT + 40) {
            items.splice(i, 1);
        }
    }
}

// SUBIR DE NIVEL
function updateLevel() {
    const newLevel = Math.floor(score / 100) + 1;

    if (newLevel > level) {
        level = newLevel;
        playSound(1000, 0.3);
    }
}

// MOVIMIENTO DE LA CANASTA
function updateBasket(deltaTime) {
    if (keys["ArrowLeft"] || keys["a"] || keys["A"]) {
        basket.x -= basket.speed * deltaTime;
    }

    if (keys["ArrowRight"] || keys["d"] || keys["D"]) {
        basket.x += basket.speed * deltaTime;
    }

    basket.x = Math.max(
        basket.width / 2,
        Math.min(WIDTH - basket.width / 2, basket.x)
    );
}

// CICLO PRINCIPAL
function update(deltaTime) {
    if (!gameRunning) return;

    updateBasket(deltaTime);

    spawnTimer += deltaTime;

    const spawnInterval = Math.max(0.35, 1.05 - level * 0.06);

    if (spawnTimer >= spawnInterval) {
        createItem();
        spawnTimer = 0;
    }

    updateItems(deltaTime);
    updateParticles(deltaTime);
}

function draw() {
    drawBackground();
    drawItems();
    drawBasket();
    drawParticles();
}

function gameLoop(timestamp) {
    if (!gameRunning) return;

    const deltaTime = Math.min(
        (timestamp - lastTime) / 1000 || 0,
        0.05
    );

    lastTime = timestamp;

    update(deltaTime);
    draw();

    if (gameRunning) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

// INICIAR PARTIDA
function startGame() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    score = 0;
    lives = 3;
    level = 1;
    spawnTimer = 0;
    lastTime = 0;

    items = [];
    particles = [];
    basket.x = WIDTH / 2;

    updateStats();

    gameRunning = true;
    overlay.classList.add("hidden");

    playSound(600, 0.15);

    animationId = requestAnimationFrame(gameLoop);
}

// TERMINAR PARTIDA
function endGame() {
    gameRunning = false;

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("catchItBest", bestScore);
        bestScoreElement.textContent = bestScore;
    }

    overlayIcon.textContent = "💥";
    overlayTitle.textContent = "¡GAME OVER!";
    overlayText.textContent =
        `Conseguiste ${score} puntos y llegaste al nivel ${level}.`;

    startButton.textContent = "VOLVER A JUGAR";

    overlay.classList.remove("hidden");

    playSound(180, 0.5, "triangle");
}

// CONTROLES DE TECLADO
document.addEventListener("keydown", event => {
    if (
        ["ArrowLeft", "ArrowRight", " "].includes(event.key)
    ) {
        event.preventDefault();
    }

    keys[event.key] = true;
});

document.addEventListener("keyup", event => {
    keys[event.key] = false;
});

// CONTROLES DE RATÓN Y PANTALLA TÁCTIL
function moveBasketToPointer(event) {
    if (!gameRunning) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;

    basket.x = (event.clientX - rect.left) * scaleX;

    basket.x = Math.max(
        basket.width / 2,
        Math.min(WIDTH - basket.width / 2, basket.x)
    );
}

canvas.addEventListener("pointermove", moveBasketToPointer);

// BOTÓN DE INICIO Y REINICIO
startButton.addEventListener("click", startGame);

// PANTALLA INICIAL
drawBackground();
drawBasket();
updateStats();
