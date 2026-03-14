export const ITEMS = [
  'sunglasses', 'camera', 'toy', 'tissue box', 'pillow', 
  'lego set', 'ipad', 'phone', 'TV', 'jacket', 'suitcase', 'bag', 'lamp'
];

export const BUILDINGS = [
  'firetrucks', 'library', 'bakery', 'restaurant', 
  'grocery store', 'music class', 'toy store'
];

export function generateMystery() {
  const targetItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  const targetBuildingName = BUILDINGS[Math.floor(Math.random() * BUILDINGS.length)];

  // Simple layout: spread buildings in a grid-like or random non-overlapping fashion
  // For simplicity, we just assign fixed or semi-random positions
  const placedBuildings = [];
  const mapWidth = 800;
  const mapHeight = 600;
  
  const placedItems = [];

  BUILDINGS.forEach((name, i) => {
    // Basic spread based on index, trying to keep them somewhat apart
    const cols = 3;
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    const bx = 100 + col * 250 + (Math.random() * 50 - 25);
    const by = 100 + row * 200 + (Math.random() * 50 - 25);
    const bw = 120;
    const bh = 100;

    placedBuildings.push({
      name,
      x: bx,
      y: by,
      width: bw,
      height: bh,
      color: `hsl(${i * (360 / BUILDINGS.length)}, 60%, 40%)`
    });

    // Place an item inside the building
    const itemToPlace = name === targetBuildingName ? targetItem : getRandomItemExcluding(targetItem);
    placedItems.push({
      name: itemToPlace,
      buildingName: name,
      x: bx + bw / 2 - 10,
      y: by + bh / 2 - 10,
      width: 20,
      height: 20,
      isTarget: name === targetBuildingName
    });
  });

  return {
    targetItem,
    targetBuildingName,
    buildings: placedBuildings,
    items: placedItems,
    player: {
      x: 50,
      y: 50,
      width: 20,
      height: 20,
      speed: 5
    },
    gameOver: false
  };
}

function getRandomItemExcluding(excludeItem) {
  let item;
  do {
    item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  } while (item === excludeItem);
  return item;
}

export function movePlayer(state, keys) {
  if (state.gameOver) return;

  const dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);

  // Normalize diagonal movement slightly
  const mag = Math.sqrt(dx * dx + dy * dy);
  let moveX = 0;
  let moveY = 0;
  if (mag > 0) {
    let currentSpeed = state.player.speed;
    if (state.buildings.some(b => isPlayerInBuilding(state.player, b))) {
      currentSpeed *= 0.4; // Slow down to 40% speed when indoors
    }
    moveX = (dx / mag) * currentSpeed;
    moveY = (dy / mag) * currentSpeed;
  }

  // Provisional new position
  let newX = state.player.x + moveX;
  let newY = state.player.y + moveY;

  // Let player walk freely around the map, maybe clamp to screen bounds
  newX = Math.max(0, Math.min(newX, 1200 - state.player.width));
  newY = Math.max(0, Math.min(newY, 900 - state.player.height));

  state.player.x = newX;
  state.player.y = newY;
}

export function checkFoundItem(state) {
  if (state.gameOver) return false;

  const p = state.player;
  for (const item of state.items) {
    if (item.isTarget) {
      // Basic AABB overlap
      if (
        p.x < item.x + item.width &&
        p.x + p.width > item.x &&
        p.y < item.y + item.height &&
        p.y + p.height > item.y
      ) {
        state.gameOver = true;
        return true; // Found!
      }
    }
  }
  return false;
}

export function isPlayerInBuilding(player, building) {
  return (
    player.x < building.x + building.width &&
    player.x + player.width > building.x &&
    player.y < building.y + building.height &&
    player.y + player.height > building.y
  );
}
