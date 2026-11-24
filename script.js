(() => {
  "use strict";

  // El mundo y el canvas usan las dimensiones originales del escenario.
  // No existe salto, altura, gravedad ni plataformas elevadas.
  const WORLD = { width: 1774, height: 887 };
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const status = document.getElementById("status");
  const loading = document.getElementById("loading");

  const map = new Image();
  map.src = "images/stages/stage%201.png";

  const spriteSheet = new Image();
  spriteSheet.src = "images/player/player.png";

  // Spritesheet: 9 columnas (3 frames por orientación) × 5 filas.
  // Orientaciones: frontal 0-2, lateral 3-5, espalda 6-8.
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
    y: 420, // Punto de apoyo: centro de los pies sobre el suelo.
    width: 112,
    height: 132,
    direction: "front",
    facingLeft: false,
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

  // Límites interiores de las zonas de hierba. El puente conecta ambas
  // islas; el agua y los bordes rocosos quedan fuera de estas áreas.
  const walkableAreas = [
    [
      [48, 290], [76, 224], [128, 179], [244, 161], [294, 91],
      [350, 43], [426, 43], [487, 105], [579, 137], [656, 174],
      [713, 228], [774, 290], [796, 357], [774, 424], [721, 492],
      [735, 584], [784, 665], [752, 701], [692, 733], [610, 749],
      [527, 733], [442, 748], [355, 728], [267, 741], [185, 710],
      [126, 665], [78, 599], [43, 505]
    ],
    [
      [978, 354], [1008, 275], [1056, 213], [1125, 185], [1205, 178],
      [1291, 137], [1368, 65], [1457, 52], [1528, 83], [1595, 139],
      [1668, 194], [1708, 267], [1725, 365], [1705, 464], [1677, 570],
      [1701, 654], [1652, 704], [1578, 739], [1491, 747], [1405, 728],
      [1317, 744], [1226, 730], [1140, 748], [1060, 715],
      [1017, 667], [1035, 603], [984, 526], [970, 438]
    ],
    // Superficie transitable del puente.
    [[790, 348], [979, 348], [979, 408], [790, 408]]
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
      const a = polygon[i];
      const b = polygon[j];
      const crosses = ((a[1] > y) !== (b[1] > y)) &&
        (x < (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) || 0.00001) + a[0]);
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function canStandAt(x, y) {
    // Se comprueba toda la huella para impedir que los pies queden sobre
    // el agua o fuera de la isla, no solo el punto central.
    return FOOTPRINT_SAMPLES.every(([ox, oy]) =>
      walkableAreas.some(area => pointInPolygon(x + ox, y + oy, area))
    );
  }

  function getFrameColumn() {
    return directionColumns[player.direction] + (player.frame % 3);
  }

  function drawPlayer() {
    if (!spriteReady) return;

    const cellW = spriteSheet.naturalWidth / SHEET.columns;
    const cellH = spriteSheet.naturalHeight / SHEET.rows;
    const row = player.attacking ? SHEET.attackRow :
      (player.moving ? SHEET.runRow : SHEET.idleRow);
    const sx = getFrameColumn() * cellW;
    const sy = row * cellH;
    const drawX = player.x - player.width / 2;
    const drawY = player.y - player.height + 12;

    // La sombra permanece siempre en el suelo: el personaje ya no tiene
    // ningún desplazamiento vertical independiente.
    ctx.save();
    ctx.fillStyle = "rgba(12, 39, 54, 0.32)";
    ctx.beginPath();
    ctx.ellipse(player.x, player.y - 3, 25, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    if (player.direction === "side" && player.facingLeft) {
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
    player.moving = false;
    player.attackTimer = 0;
    player.frame = 0;
    player.frameTimer = 0;
    player.attackCooldown = player.attackDuration;
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
        status.textContent = "¡Sigue explorando!";
      }
    }

    let dx = 0;
    let dy = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

    const length = Math.hypot(dx, dy);
    player.moving = length > 0 && !player.attacking;

    if (length > 0) {
      dx /= length;
      dy /= length;

      if (Math.abs(dx) > Math.abs(dy)) {
        player.direction = "side";
        player.facingLeft = dx < 0;
      } else {
        player.direction = dy < 0 ? "back" : "front";
      }

      if (!player.attacking) {
        const nextX = player.x + dx * player.speed * dt;
        const nextY = player.y + dy * player.speed * dt;

        // Colisión por ejes: permite deslizarse junto a los bordes
        // y cruzar el puente sin atravesar el agua.
        if (canStandAt(nextX, player.y)) player.x = nextX;
        if (canStandAt(player.x, nextY)) player.y = nextY;
      }
    }

    if (!player.attacking && player.moving) {
      player.frameTimer += dt;
      if (player.frameTimer >= 0.13) {
        player.frame = (player.frame + 1) % 3;
        player.frameTimer -= 0.13;
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

    if (!keys.has(key) && (key === "Space" || key === "KeyX")) {
      startAttack();
    }
    keys.add(key);
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