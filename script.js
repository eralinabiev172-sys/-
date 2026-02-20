// ==============================
// Простая 2D sandbox-игра в стиле Minecraft
// ==============================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  hpFill: document.getElementById("hpFill"),
  hpText: document.getElementById("hpText"),
  cooldownFill: document.getElementById("cooldownFill"),
  cooldownText: document.getElementById("cooldownText"),
  inventory: document.getElementById("inventory"),
  toolButtons: document.getElementById("toolButtons"),
  craftButtons: document.getElementById("craftButtons"),
};

const TILE = 40;
const WORLD_W = 75;
const WORLD_H = 45;

const BLOCKS = {
  dirt: { name: "Земля", color: "#7c4a23", hardness: 1.2, drop: null },
  wood: { name: "Дерево", color: "#8b5a2b", hardness: 2, drop: "wood" },
  stone: { name: "Камень", color: "#7f8c8d", hardness: 3, drop: "stone" },
  coal: { name: "Уголь", color: "#2d3436", hardness: 3.4, drop: "coal" },
  iron: { name: "Железо", color: "#b2bec3", hardness: 4.2, drop: "iron" },
};

const TOOLS = {
  hands: {
    name: "Руки",
    damage: 4,
    miningSpeed: 0.55,
    preferred: [],
    reach: 1.7,
  },
  woodPickaxe: {
    name: "Деревянная кирка",
    damage: 6,
    miningSpeed: 1.15,
    preferred: ["stone", "coal", "iron"],
    reach: 1.9,
  },
  stonePickaxe: {
    name: "Каменная кирка",
    damage: 8,
    miningSpeed: 1.7,
    preferred: ["stone", "coal", "iron"],
    reach: 2.1,
  },
  axe: {
    name: "Топор",
    damage: 7,
    miningSpeed: 1.35,
    preferred: ["wood"],
    reach: 1.9,
  },
  sword: {
    name: "Меч",
    damage: 12,
    miningSpeed: 0.9,
    preferred: [],
    reach: 2.2,
  },
  spear: {
    name: "Копьё",
    damage: 10,
    miningSpeed: 0.8,
    preferred: [],
    reach: 3,
  },
  shield: {
    name: "Щит",
    damage: 2,
    miningSpeed: 0.4,
    preferred: [],
    reach: 1.5,
    blockFactor: 0.55,
  },
};

const TOOL_ORDER = ["hands", "woodPickaxe", "stonePickaxe", "axe", "sword", "spear", "shield"];

const RECIPES = [
  {
    id: "sticks",
    label: "Палки (2 шт)",
    cost: { wood: 1 },
    give: { sticks: 2 },
  },
  {
    id: "stonePickaxe",
    label: "Каменная кирка",
    cost: { sticks: 2, stone: 3 },
    unlockTool: "stonePickaxe",
  },
  {
    id: "woodPickaxe",
    label: "Деревянная кирка",
    cost: { sticks: 2, wood: 3 },
    unlockTool: "woodPickaxe",
  },
  {
    id: "ironSword",
    label: "Железный меч",
    cost: { iron: 2, sticks: 1 },
    unlockTool: "sword",
  },
];

const keys = {};
let mouse = { x: 0, y: 0, leftDown: false, rightDown: false };

const player = {
  x: 8 * TILE,
  y: 8 * TILE,
  radius: 14,
  speed: 220,
  hp: 100,
  maxHp: 100,
  activeTool: "hands",
  unlockedTools: new Set(["hands", "axe", "spear", "shield"]),
  inventory: {
    wood: 0,
    stone: 0,
    coal: 0,
    iron: 0,
    sticks: 0,
  },
  attackCooldown: 0,
  maxAttackCooldown: 0.9,
};

const camera = { x: 0, y: 0 };
const world = [];
const mobs = [];

let miningTarget = null;
let miningProgress = 0;
let gameOver = false;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function tileToWorld(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function generateWorld() {
  for (let y = 0; y < WORLD_H; y++) {
    const row = [];
    for (let x = 0; x < WORLD_W; x++) {
      if (x === 0 || y === 0 || x === WORLD_W - 1 || y === WORLD_H - 1) {
        row.push("stone");
        continue;
      }

      const r = Math.random();
      let type = "dirt";
      if (r < 0.11) type = "wood";
      else if (r < 0.4) type = "stone";
      if (Math.random() < 0.06) type = "coal";
      if (Math.random() < 0.03) type = "iron";
      row.push(type);
    }
    world.push(row);
  }

  // Создаём стартовую безопасную зону вокруг игрока.
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  for (let y = py - 1; y <= py + 1; y++) {
    for (let x = px - 1; x <= px + 1; x++) {
      if (world[y] && world[y][x]) world[y][x] = null;
    }
  }
}

generateWorld();

function spawnMob() {
  const edge = Math.floor(Math.random() * 4);
  let tx = 1;
  let ty = 1;

  if (edge === 0) {
    tx = 2;
    ty = 2 + Math.floor(Math.random() * (WORLD_H - 4));
  } else if (edge === 1) {
    tx = WORLD_W - 3;
    ty = 2 + Math.floor(Math.random() * (WORLD_H - 4));
  } else if (edge === 2) {
    ty = 2;
    tx = 2 + Math.floor(Math.random() * (WORLD_W - 4));
  } else {
    ty = WORLD_H - 3;
    tx = 2 + Math.floor(Math.random() * (WORLD_W - 4));
  }

  const pos = tileToWorld(tx, ty);
  mobs.push({
    x: pos.x,
    y: pos.y,
    r: 12,
    hp: 28,
    speed: 92,
    damage: 7,
    attackCooldown: 0,
    maxAttackCooldown: 1.1,
    knockbackVX: 0,
    knockbackVY: 0,
  });
}

for (let i = 0; i < 6; i++) spawnMob();
setInterval(() => {
  if (!gameOver && mobs.length < 10) spawnMob();
}, 3800);

function isWalkable(nextX, nextY) {
  const tx = Math.floor(nextX / TILE);
  const ty = Math.floor(nextY / TILE);

  // Проверка мира
  const tilesToCheck = [
    [tx, ty],
    [Math.floor((nextX - player.radius) / TILE), ty],
    [Math.floor((nextX + player.radius) / TILE), ty],
    [tx, Math.floor((nextY - player.radius) / TILE)],
    [tx, Math.floor((nextY + player.radius) / TILE)],
  ];

  for (const [cx, cy] of tilesToCheck) {
    if (!world[cy] || world[cy][cx] !== null) return false;
  }
  return true;
}

function getLookTile() {
  const worldMouseX = mouse.x + camera.x;
  const worldMouseY = mouse.y + camera.y;
  const tx = Math.floor(worldMouseX / TILE);
  const ty = Math.floor(worldMouseY / TILE);
  if (!world[ty] || typeof world[ty][tx] === "undefined") return null;
  return { tx, ty, block: world[ty][tx] };
}

function canReachTile(tx, ty, reachTiles) {
  const center = tileToWorld(tx, ty);
  return dist(player.x, player.y, center.x, center.y) <= reachTiles * TILE;
}

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keys["KeyW"]) dy -= 1;
  if (keys["KeyS"]) dy += 1;
  if (keys["KeyA"]) dx -= 1;
  if (keys["KeyD"]) dx += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
  }

  const nextX = player.x + dx * player.speed * dt;
  const nextY = player.y + dy * player.speed * dt;

  if (isWalkable(nextX, player.y)) player.x = nextX;
  if (isWalkable(player.x, nextY)) player.y = nextY;

  camera.x = player.x - canvas.width / 2;
  camera.y = player.y - canvas.height / 2;

  if (player.attackCooldown > 0) {
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  }
}

function getMiningMultiplier(tool, blockName) {
  if (!blockName) return 0;
  return tool.preferred.includes(blockName) ? 1.75 : 0.65;
}

function updateMining(dt) {
  const look = getLookTile();
  if (!mouse.leftDown || !look || !look.block) {
    miningTarget = null;
    miningProgress = 0;
    return;
  }

  const tool = TOOLS[player.activeTool];
  if (!canReachTile(look.tx, look.ty, tool.reach)) {
    miningTarget = null;
    miningProgress = 0;
    return;
  }

  const sameTarget = miningTarget && miningTarget.tx === look.tx && miningTarget.ty === look.ty;
  if (!sameTarget) {
    miningTarget = { tx: look.tx, ty: look.ty, type: look.block };
    miningProgress = 0;
  }

  const blockInfo = BLOCKS[look.block];
  const mult = getMiningMultiplier(tool, look.block);
  miningProgress += tool.miningSpeed * mult * dt;

  if (miningProgress >= blockInfo.hardness) {
    world[look.ty][look.tx] = null;
    if (blockInfo.drop) {
      player.inventory[blockInfo.drop] = (player.inventory[blockInfo.drop] || 0) + 1;
    }
    miningTarget = null;
    miningProgress = 0;
    renderInventory();
  }
}

function performAttack() {
  const tool = TOOLS[player.activeTool];
  const total = player.maxAttackCooldown;
  const readyWindow = player.attackCooldown <= 0;

  if (!readyWindow) return;

  let hitSomeone = false;
  for (const mob of mobs) {
    const d = dist(player.x, player.y, mob.x, mob.y);
    if (d <= tool.reach * TILE) {
      // Бонус урона за удар в момент полной перезарядки.
      const bonus = 1.35;
      const damage = tool.damage * bonus;
      mob.hp -= damage;

      // Отталкивание моба от игрока.
      const nx = (mob.x - player.x) / (d || 1);
      const ny = (mob.y - player.y) / (d || 1);
      mob.knockbackVX += nx * 220;
      mob.knockbackVY += ny * 220;
      hitSomeone = true;
    }
  }

  if (hitSomeone) {
    player.attackCooldown = total;
  }
}

function updateMobs(dt) {
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    const d = dist(m.x, m.y, player.x, player.y);

    if (m.attackCooldown > 0) m.attackCooldown -= dt;

    // Простой ИИ: идти к игроку.
    if (d > 35) {
      const nx = (player.x - m.x) / d;
      const ny = (player.y - m.y) / d;
      m.x += nx * m.speed * dt;
      m.y += ny * m.speed * dt;
    }

    // Применяем отталкивание.
    m.x += m.knockbackVX * dt;
    m.y += m.knockbackVY * dt;
    m.knockbackVX *= 0.86;
    m.knockbackVY *= 0.86;

    // Атака моба вблизи.
    if (d < 36 && m.attackCooldown <= 0) {
      let incoming = m.damage;
      const usingShield = player.activeTool === "shield" && (mouse.rightDown || keys["ShiftLeft"] || keys["ShiftRight"]);
      if (usingShield) {
        incoming *= 1 - TOOLS.shield.blockFactor;
      }

      player.hp -= incoming;
      m.attackCooldown = m.maxAttackCooldown;

      // Лёгкое отталкивание игрока назад.
      const nx = (player.x - m.x) / (d || 1);
      const ny = (player.y - m.y) / (d || 1);
      player.x += nx * 12;
      player.y += ny * 12;
    }

    // Смерть моба + дроп ресурсов.
    if (m.hp <= 0) {
      const roll = Math.random();
      if (roll < 0.45) player.inventory.coal += 1;
      else if (roll < 0.75) player.inventory.iron += 1;
      else player.inventory.stone += 1;
      mobs.splice(i, 1);
      renderInventory();
    }
  }

  if (player.hp <= 0) {
    gameOver = true;
    player.hp = 0;
  }
}

function drawWorld() {
  ctx.fillStyle = "#132033";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const startX = Math.floor(camera.x / TILE) - 1;
  const startY = Math.floor(camera.y / TILE) - 1;
  const endX = Math.ceil((camera.x + canvas.width) / TILE) + 1;
  const endY = Math.ceil((camera.y + canvas.height) / TILE) + 1;

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (!world[y] || typeof world[y][x] === "undefined") continue;
      const block = world[y][x];

      const sx = x * TILE - camera.x;
      const sy = y * TILE - camera.y;

      // Сетка
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.strokeRect(sx, sy, TILE, TILE);

      if (block) {
        ctx.fillStyle = BLOCKS[block].color;
        ctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
      }
    }
  }

  // Подсветка блока, на который смотрит курсор.
  const look = getLookTile();
  if (look && look.block) {
    const tool = TOOLS[player.activeTool];
    if (canReachTile(look.tx, look.ty, tool.reach)) {
      const sx = look.tx * TILE - camera.x;
      const sy = look.ty * TILE - camera.y;
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4);

      if (miningTarget && miningTarget.tx === look.tx && miningTarget.ty === look.ty) {
        const hardness = BLOCKS[look.block].hardness;
        const p = clamp(miningProgress / hardness, 0, 1);
        ctx.fillStyle = "rgba(34,211,238,0.5)";
        ctx.fillRect(sx + 4, sy + TILE - 8, (TILE - 8) * p, 4);
      }
    }
  }
}

function drawPlayer() {
  const sx = player.x - camera.x;
  const sy = player.y - camera.y;

  ctx.beginPath();
  ctx.arc(sx, sy, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#38bdf8";
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(sx - 8, sy - 5, 5, 5);
  ctx.fillRect(sx + 3, sy - 5, 5, 5);
}

function drawMobs() {
  for (const m of mobs) {
    const sx = m.x - camera.x;
    const sy = m.y - camera.y;

    ctx.beginPath();
    ctx.arc(sx, sy, m.r, 0, Math.PI * 2);
    ctx.fillStyle = "#84cc16";
    ctx.fill();

    // HP моба
    ctx.fillStyle = "#111827";
    ctx.fillRect(sx - 14, sy - 20, 28, 4);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(sx - 14, sy - 20, 28 * clamp(m.hp / 28, 0, 1), 4);
  }
}

function drawGameOver() {
  if (!gameOver) return;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Вы погибли", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "20px Arial";
  ctx.fillText("Обновите страницу, чтобы начать заново", canvas.width / 2, canvas.height / 2 + 20);
  ctx.textAlign = "left";
}

function updateUI() {
  ui.hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
  ui.hpText.textContent = `${Math.round(player.hp)} / ${player.maxHp}`;

  const cooldownRatio = 1 - player.attackCooldown / player.maxAttackCooldown;
  ui.cooldownFill.style.width = `${clamp(cooldownRatio, 0, 1) * 100}%`;
  ui.cooldownText.textContent = player.attackCooldown <= 0 ? "Готово (бонусный удар)" : "Перезарядка";
}

function renderInventory() {
  ui.inventory.innerHTML = "";
  for (const [name, count] of Object.entries(player.inventory)) {
    const div = document.createElement("div");
    div.className = "inventory-item";
    div.textContent = `${name}: ${count}`;
    ui.inventory.appendChild(div);
  }
}

function renderTools() {
  ui.toolButtons.innerHTML = "";
  for (const id of TOOL_ORDER) {
    if (!player.unlockedTools.has(id)) continue;
    const btn = document.createElement("button");
    btn.textContent = `${TOOLS[id].name} (урон ${TOOLS[id].damage})`;
    if (player.activeTool === id) btn.classList.add("active");
    btn.addEventListener("click", () => {
      player.activeTool = id;
      renderTools();
    });
    ui.toolButtons.appendChild(btn);
  }
}

function canCraft(cost) {
  return Object.entries(cost).every(([res, amount]) => (player.inventory[res] || 0) >= amount);
}

function spendResources(cost) {
  for (const [res, amount] of Object.entries(cost)) {
    player.inventory[res] -= amount;
  }
}

function renderCraft() {
  ui.craftButtons.innerHTML = "";

  for (const recipe of RECIPES) {
    const btn = document.createElement("button");
    const costText = Object.entries(recipe.cost)
      .map(([name, amount]) => `${name} x${amount}`)
      .join(", ");
    btn.textContent = `${recipe.label} [${costText}]`;

    const alreadyUnlocked = recipe.unlockTool && player.unlockedTools.has(recipe.unlockTool);
    btn.disabled = alreadyUnlocked;

    btn.addEventListener("click", () => {
      if (alreadyUnlocked) return;
      if (!canCraft(recipe.cost)) return;

      spendResources(recipe.cost);
      if (recipe.give) {
        for (const [res, amount] of Object.entries(recipe.give)) {
          player.inventory[res] = (player.inventory[res] || 0) + amount;
        }
      }
      if (recipe.unlockTool) {
        player.unlockedTools.add(recipe.unlockTool);
      }

      renderInventory();
      renderTools();
      renderCraft();
    });

    ui.craftButtons.appendChild(btn);
  }
}

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.code === "KeyF" && !gameOver) {
    performAttack();
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) mouse.leftDown = true;
  if (e.button === 2) mouse.rightDown = true;
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouse.leftDown = false;
  if (e.button === 2) mouse.rightDown = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

let prev = performance.now();
function gameLoop(now) {
  const dt = clamp((now - prev) / 1000, 0, 0.033);
  prev = now;

  if (!gameOver) {
    updatePlayer(dt);
    updateMining(dt);
    updateMobs(dt);
  }

  drawWorld();
  drawMobs();
  drawPlayer();
  drawGameOver();
  updateUI();

  requestAnimationFrame(gameLoop);
}

renderInventory();
renderTools();
renderCraft();
requestAnimationFrame(gameLoop);
