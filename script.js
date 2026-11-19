
const player = document.getElementById("player");
const treasure = document.getElementById("treasure");
const message = document.getElementById("message");
const game = document.getElementById("game");

// Posición inicial del personaje
let playerX = 0;
let playerY = 0;

// Velocidad de movimiento
const speed = 10;

// Tamaño del escenario y de los personajes
const gameWidth = 600;
const gameHeight = 400;
const playerSize = 40;

// Posición aleatoria del tesoro
let treasureX = Math.floor(
    Math.random() * (gameWidth - playerSize)
);

let treasureY = Math.floor(
    Math.random() * (gameHeight - playerSize)
);

// Colocar el tesoro
treasure.style.left = treasureX + "px";
treasure.style.top = treasureY + "px";

// Detectar las teclas pulsadas
document.addEventListener("keydown", function(event) {

    // Evitar el desplazamiento de la página
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
    }

    // Movimiento del personaje
    if (event.key === "ArrowUp") {
        playerY -= speed;
    }

    if (event.key === "ArrowDown") {
        playerY += speed;
    }

    if (event.key === "ArrowLeft") {
        playerX -= speed;
    }

    if (event.key === "ArrowRight") {
        playerX += speed;
    }

    // Limitar el movimiento dentro del escenario
    playerX = Math.max(0, Math.min(playerX, gameWidth - playerSize));
    playerY = Math.max(0, Math.min(playerY, gameHeight - playerSize));

    // Actualizar posición del personaje
    player.style.left = playerX + "px";
    player.style.top = playerY + "px";

    // Comprobar si ha encontrado el tesoro
    checkCollision();
});

// Comprobar colisión entre personaje y tesoro
function checkCollision() {

    const distanceX = Math.abs(playerX - treasureX);
    const distanceY = Math.abs(playerY - treasureY);

    if (distanceX < playerSize && distanceY < playerSize) {

        message.textContent = "🎉 ¡Felicidades! ¡Has encontrado el tesoro!";

        treasure.style.display = "none";

        // Finalizar el movimiento
        document.removeEventListener("keydown", arguments.callee);
    }
}
