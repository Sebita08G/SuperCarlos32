(() => {
  "use strict";

  // El escenario original mide 1774 × 887 píxeles. El canvas conserva
  // exactamente esa proporción para no deformar el mapa.
  const WORLD = { width: 1774, height: 887 };
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const status = document.getElementById("status");
  const loading = document.getElementById("loading");

  const map = new Image();
  map.src = "images/stages/stage%201.png";

  const spriteSheet = new Image();
  spriteSheet.src = "images/player/player.png";

  // 9 columnas × 5 filas. Cada fila contiene 3 frames por orientación:
  // frente (0-2), perfil (3-5) y espalda (6-8).
  const SHEET = {
    columns: 9,
    rows: 5,
    idleRow: 0,
    runRow: 1,
    attackRow: 2,
    damageRow: 3,
    celebrateRow: 4
  };

  const player = {
    x: 420,
    y: 420,
    width: 112,
    height: 132,
    direction: "front",
    moving: false,
    frame: 0,
    frameTimer: 0,
    speed: 235,
    attacking: false,
    attackTimer: 0,
    attackDuration: 0.48,
    attackCooldown: 0
  };

  const keys = new Set();
  const directionColumns = { front: 0, side: 3, back: 6 };

  // Polígonos transitables trazados sobre la hierba de las dos islas y
  // sobre el puente. El agua y los bordes rocosos quedan fuera de ellos.
  const walkableAreas = [
    [
      [24, 287], [61, 210], [112, 166], [244, 145], [281, 70],
      [346, 25], [435, 27], [501, 91], [588, 121], [666, 159],
      [726, 220], [794, 285], [817, 361], [787, 438], [740, 506],
      [753, 593], [807, 662], [770, 715], [704, 754], [612, 773],
      [524, 752], [440, 767], [350, 746], [260, 758], [174, 725],
      [112, 674], [61, 601], [23, 507]
    ],
    [
      [963, 315], [1002, 241], [1050, 190], [1122, 166], [1210, 157],
      [1295, 113], [1365, 45], [1460, 33], [1538, 68], [1607, 123],
      [1685, 178], [1728, 257], [1745, 365], [1723, 469], [1694, 574],
      [1720, 663], [1665, 726], [1582, 760], [1490, 768], [1400, 748],
      [1315, 765], [1220, 750], [1134, 770], [1050, 735],
      [1000, 674], [1020, 602], [969, 530], [950, 437]
    ],
    [[785, 337], [985, 337], [985, 420], [785, 420]]
  ];

  const FOOTPRINT_RADIUS = 13;
  const FOOTPRINT_SAMPLES = [
    [0, 0], [FOOTPRINT_RADIUS, 0], [-FOOTPRINT_RADIUS, 0],
    [0, FOOTPRINT_RADIUS], [0, -FOOTPRINT_RADIUS],
    [9, 9], [-9, 9], [9, -9], [-9, -9]
  ];

  let lastTime = 0;
  let mapReady = false;
  let spriteReady = false;

  function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      const crosses = ((a[1] > y) !== (b[1] > y)) &&
        (x < (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) || 0.00001) + a[0]);
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function isWalkable(x, y) {
    return walkableAreas.some(area => pointInPolygon(x, y, area));
  }

  // La huella, no el tamaño transparente del sprite, determina si el
  // jugador sigue dentro del terreno. Así puede acercarse a los bordes
  // sin que el dibujo choque antes de tiempo.
  function canStandAt(x, y) {
    return FOOTPRINT_SAMPLES.every(([ox, oy]) =>
      walkableAreas.some(area => pointInPolygon(x + ox, y + oy, area))
    );
  }

  function getFrameColumn() {
    return directionColumns[player.direction] + (player.frame % 3);
  }

  function drawPlayer() {
    // Sombra fija en el suelo: ya no existe altura, salto ni desplazamiento
    // vertical independiente del movimiento.
    ctx.save();
    ctx.fillStyle = "rgba(12, 39, 54, 0.38)";
    ctx.beginPath();
    ctx.ellipse(player.x, player.y - 3, 27, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!spriteReady) return;

    const cellW = spriteSheet.naturalWidth / SHEET.columns;
    const cellH = spriteSheet.naturalHeight / SHEET.rows;
    const row = player.attacking ? SHEET.attackRow :
      (player.moving ? SHEET.runRow : SHEET.idleRow);
    const sx = getFrameColumn() * cellW;
    const sy = row * cellH;
    const drawX = player.x - player.width / 2;
    const drawY = player.y - player.height + 12;

    ctx.save();
    if (player.direction === "left") {
      ctx.translate(player.x * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      spriteSheet,
      sx, sy, cellW, cellH,
      drawX, drawY, player.width, player.height
    );
    ctx.restore();
  }

  function startAttack() {
    if (player.attacking || player.attackCooldown > 0) return;
    player.attacking = true;
    player.attackTimer = 0;
    player.frame = 0;
    player.frameTimer = 0;
    player.attackCooldown = 0.12;
    status.textContent = "¡Ataque con martillo!";
  }

  function update(dt) {
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);

    if (player.attacking) {
      player.attackTimer += dt;
      const progress = player.attackTimer / player.attackDuration;
      player.frame = Math.min(2, Math.floor(progress * 3));
      if (player.attackTimer >= player.attackDuration) {
        player.attacking = false;
        player.attackTimer = 0;
        player.frame = 0;
      }
    }

    let dx = 0, dy = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

    const length = Math.hypot(dx, dy);
    player.moving = length > 0 && !player.attacking;

    if (length) {
      dx /= length;
      dy /= length;

      if (Math.abs(dx) > Math.abs(dy)) {
        player.direction = dx < 0 ? "left" : "side";
      } else {
        player.direction = dy < 0 ? "back" : "front";
      }

      if (!player.attacking) {
        const stepX = dx * player.speed * dt;
        const stepY = dy * player.speed * dt;
        const nextX = player.x + stepX;
        const nextY = player.y + stepY;

        // Colisión por ejes para permitir deslizarse junto a los límites.
        if (canStandAt(nextX, player.y)) player.x = nextX;
        if (canStandAt(player.x, nextY)) player.y = nextY;
      }
    }

    if (!player.attacking && player.moving) {
      player.frameTimer += dt;
      if (player.frameTimer >= 0.14) {
        player.frame = (player.frame + 1) % 3;
        player.frameTimer = 0;
      }
    } else if (!player.attacking) {
      player.frame = 0;
      player.frameTimer = 0;
    }
  }

  function render() {
    if (!mapReady) return;
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map, 0, 0, WORLD.width, WORLD.height);
    drawPlayer();
  }

  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
    lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  document.addEventListener("keydown", event => {
    const key = event.code;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(key)) {
      event.preventDefault();
    }
    keys.add(key);
    if (key === "Space" || key === "KeyX") startAttack();
  });

  document.addEventListener("keyup", event => keys.delete(event.code));
  window.addEventListener("blur", () => keys.clear());

  map.onload = () => {
    mapReady = true;
    loading.classList.add("hidden");
    requestAnimationFrame(loop);
  };
  map.onerror = () => {
    loading.textContent = "No se pudo cargar images/stages/stage 1.png";
  };
  spriteSheet.onload = () => { spriteReady = true; };
  spriteSheet.onerror = () => {
    status.textContent = "No se pudo cargar el sprite del jugador.";
  };
})();