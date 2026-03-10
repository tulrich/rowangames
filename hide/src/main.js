import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// 1. Initialization
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
scene.fog = new THREE.FogExp2(0x050505, 0.05);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 0); // Eye-level

// 2. Lighting & Environment
// Night Skybox (Simple large sphere/box painted dark blue/black)
const skyGeo = new THREE.SphereGeometry(80, 16, 16);
const skyMat = new THREE.MeshBasicMaterial({ color: 0x0a101a, side: THREE.BackSide, fog: false });
const skybox = new THREE.Mesh(skyGeo, skyMat);
scene.add(skybox);

// Hemisphere Light ensures nothing is ever 100% black (Sky Color, Ground Color, Intensity)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

// Moon directional light (adds shadows and direction)
const moonLight = new THREE.DirectionalLight(0xaaccff, 1.0);
moonLight.position.set(20, 30, -20);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 2048;
moonLight.shadow.mapSize.height = 2048;
scene.add(moonLight);

// Flashlight attached to camera
const flashlight = new THREE.SpotLight(0xffffff, 3.0, 40, Math.PI / 4, 0.5, 1);
flashlight.position.set(0, 0, 0);
flashlight.target.position.set(0, 0, -1);
camera.add(flashlight);
camera.add(flashlight.target);
scene.add(camera);

// --- Procedural Textures ---
function createWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#6b4226';
  for (let i = 0; i < 50; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, 0);
    ctx.lineTo(Math.random() * 256, 256);
    ctx.lineWidth = Math.random() * 4 + 1;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createFabricTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#223355';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 2) {
    for (let y = 0; y < 128; y += 2) {
      if (Math.random() > 0.5) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x, y, 2, 2);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createStaticTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  for (let x = 0; x < 64; x++) {
    for (let y = 0; y < 64; y++) {
      const v = Math.floor(Math.random() * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return new THREE.CanvasTexture(c);
}

const woodTex = createWoodTexture();
const fabricTex = createFabricTexture();
const staticTex = createStaticTexture();

// --- Level Management System ---
let currentLevel = 1;
const collidables = [];
let lootItems = [];
let lootCollected = 0;
let totalLoot = 0;
let npc = null;
let npcVision = null;
let patrolPoints = [];
let currentPatrolIndex = 0;
let npcState = 'PATROL';
let chaseTimeout = 0;
let npcSpeed = 2.0;
let npcChaseSpeed = 4.5;
const levelObjects = [];
const yardSize = 15;
let interactiveDoors = [];

function clearLevel() {
  levelObjects.forEach(obj => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  levelObjects.length = 0;
  collidables.length = 0;
  lootItems.length = 0;
  lootCollected = 0;
  totalLoot = 0;
  document.getElementById('lootCount').innerText = `0 / 0`;

  interactiveDoors.length = 0;

  if (npc) {
    scene.remove(npc);
    if (npcVision && npcVision.target) scene.remove(npcVision.target);
    npc.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    npc = null;
  }
}

function addLvl(obj, isCollidable = false) {
  scene.add(obj);
  levelObjects.push(obj);
  if (isCollidable) collidables.push(obj);
}

function buildLevel(levelNum) {
  clearLevel();
  currentLevel = levelNum;

  if (levelNum === 1) {
    npcSpeed = 0.8;
    npcChaseSpeed = 1.8; // Slower than player speed
  } else {
    npcSpeed = 2.0;
    npcChaseSpeed = 4.5;
  }

  // Persistent yard base
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  addLvl(floor);

  // Fence material & geometry
  const fencePillarGeo = new THREE.BoxGeometry(0.3, 1.8, 0.1);
  const fenceMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 });
  function createFence(x, z, rotate = false) {
    const p = new THREE.Mesh(fencePillarGeo, fenceMat);
    p.position.set(x, 0.9, z);
    if (rotate) p.rotation.y = Math.PI / 2;
    p.castShadow = true;
    p.receiveShadow = true;
    addLvl(p, true);
  }

  // Draw perimeter fence
  for (let x = -yardSize; x <= yardSize; x += 0.4) {
    createFence(x, -yardSize);
    if (Math.abs(x) > 2) createFence(x, yardSize);
  }
  for (let z = -yardSize; z <= yardSize; z += 0.4) {
    createFence(-yardSize, z, true);
    createFence(yardSize, z, true);
  }

  if (levelNum === 1) {
    const houseMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1.0 });
    const innerWallMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.8 });

    // Shiny hardwood floor
    const houseFloorMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      color: 0xaaaaaa, // Tint the wood slightly lighter
      roughness: 0.2, // Shiny
      metalness: 0.1
    });

    const hY = 4;
    const hW = 15;
    const hD = 12;
    const hZ = -5;

    const inFloorGeo = new THREE.PlaneGeometry(hW - 0.5, hD - 0.5);
    const inFloor = new THREE.Mesh(inFloorGeo, houseFloorMat);
    inFloor.rotation.x = -Math.PI / 2;
    inFloor.position.set(0, 0.01, hZ);
    inFloor.receiveShadow = true;

    // Repeat texture to make it look like floorboards instead of one giant stretched plank
    woodTex.repeat.set(4, 4);
    addLvl(inFloor);

    const roofGeo = new THREE.BoxGeometry(hW + 1, 1, hD + 1);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 8.5, hZ);
    roof.castShadow = true;
    addLvl(roof);

    function createWall(x, z, width, depth, isInner = false) {
      const geo = new THREE.BoxGeometry(width, 8, depth);
      const mesh = new THREE.Mesh(geo, isInner ? innerWallMat : houseMat);
      mesh.position.set(x, hY, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      addLvl(mesh, true);
    }

    createWall(0, hZ - hD / 2, hW, 0.5);
    createWall(-hW / 2, hZ, 0.5, hD);
    createWall(hW / 2, hZ, 0.5, hD);
    createWall(-4.5, hZ + hD / 2, 6, 0.5);

    // Front Right Wall w/ Window
    function createWallExt(x, y, z, width, height, depth) {
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geo, houseMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      addLvl(mesh, true);
    }
    createWallExt(2.5, hY, hZ + hD / 2, 2, 8, 0.5); // left side
    createWallExt(6.5, hY, hZ + hD / 2, 2, 8, 0.5); // right side
    createWallExt(4.5, 0.5, hZ + hD / 2, 2, 1, 0.5); // bottom
    createWallExt(4.5, 5.0, hZ + hD / 2, 2, 6, 0.5); // top

    // Window Glass (collidable so NPC raycaster hits it)
    const glassGeo = new THREE.BoxGeometry(2, 2, 0.1);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(4.5, 2.0, hZ + hD / 2);
    addLvl(glass, true);
    createWall(-2, hZ, 0.5, 8, true);
    createWall(3, hZ - 2, 6, 0.5, true);

    const furnMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 });

    // Door
    const doorContainer = new THREE.Group();
    doorContainer.position.set(-1.5, hY, hZ + hD / 2);
    const doorGeo = new THREE.BoxGeometry(3, 8, 0.4);
    const doorMesh = new THREE.Mesh(doorGeo, furnMat);
    doorMesh.position.set(1.5, 0, 0);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    doorContainer.add(doorMesh);
    addLvl(doorContainer, false); // Door collision disabled to prevent getting stuck when it swings open
    interactiveDoors.push(doorContainer);

    const couchMat = new THREE.MeshStandardMaterial({ map: fabricTex, roughness: 1.0 });
    const tvMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 }); // Shiny plastic TV
    const screenMat = new THREE.MeshBasicMaterial({ map: staticTex }); // Unlit bright static

    const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 2), furnMat);
    counter.position.set(4, 1.5, hZ - 4);
    counter.castShadow = true;
    counter.receiveShadow = true;
    addLvl(counter, true);

    const tvBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.5, 4), tvMat);
    tvBody.position.set(-6, 3, hZ);
    tvBody.castShadow = true;
    tvBody.receiveShadow = true;
    addLvl(tvBody, true);

    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1), screenMat);
    tvScreen.position.set(-5.74, 3, hZ);
    tvScreen.rotation.y = Math.PI / 2; // Face outward from wall
    addLvl(tvScreen);

    // Living Room Area Rug
    const rugGeo = new THREE.PlaneGeometry(6, 6);
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x882222, roughness: 1.0, map: fabricTex });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-3, 0.02, hZ);
    addLvl(rug);

    // Coffee table
    const tableGeo = new THREE.BoxGeometry(2, 1, 3);
    const table = new THREE.Mesh(tableGeo, furnMat);
    table.position.set(-1.5, 0.5, hZ);
    table.castShadow = true;
    table.receiveShadow = true;
    addLvl(table, true);

    const couch = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), couchMat);
    couch.position.set(-3.5, 1, hZ);
    couch.castShadow = true;
    couch.receiveShadow = true;
    addLvl(couch, true);

    const lootGeo = new THREE.SphereGeometry(0.3, 16, 16);
    // Physically Based Reflective Gold!
    const lootMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 1.0,
      roughness: 0.2, // Very shiny
      emissive: 0x332200 // Slight glow so it's never pitch black
    });

    function createLoot(x, y, z) {
      const loot = new THREE.Mesh(lootGeo, lootMat);
      loot.position.set(x, y, z);
      addLvl(loot);
      lootItems.push({ mesh: loot, collected: false });
      totalLoot++;
    }

    createLoot(4, 1.5, hZ - 2); // In Kitchen, lowered and moved back so it's reachable
    createLoot(-1.5, 1.3, hZ); // On Coffee Table
    // Removed 3rd loot for Level 1

    const livingRoomLight = new THREE.PointLight(0xffaa55, 1.5, 15);
    livingRoomLight.position.set(-4, 3, hZ);
    addLvl(livingRoomLight);

    const kitchenLight = new THREE.PointLight(0xaaddff, 1.0, 15);
    kitchenLight.position.set(4, 3, hZ - 3);
    addLvl(kitchenLight);

    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 3);
    const leavesGeo = new THREE.SphereGeometry(2.5, 8, 8);
    const treePositions = [
      { x: -8, z: 5 }, { x: 8, z: 5 }, { x: -10, z: -10 }, { x: 10, z: -8 }
    ];

    treePositions.forEach(pos => {
      const trunk = new THREE.Mesh(trunkGeo, fenceMat);
      trunk.position.set(pos.x, 1.5, pos.z);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      addLvl(trunk, true);

      const leaves = new THREE.Mesh(leavesGeo, floorMat);
      leaves.position.set(pos.x, 4, pos.z);
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      addLvl(leaves);
    });

    // NPC Setup (Humanoid)
    npc = new THREE.Group();
    npc.position.set(-5, 1.0, hZ);

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0xaa2222 });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2222aa });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.set(0, 0.85, 0);
    head.castShadow = true;
    npc.add(head);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.4), shirtMat);
    torso.position.set(0, 0.1, 0);
    torso.castShadow = true;
    npc.add(torso);

    const legGeo = new THREE.BoxGeometry(0.35, 0.8, 0.35);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.2, -0.6, 0);
    leftLeg.castShadow = true;
    npc.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.2, -0.6, 0);
    rightLeg.castShadow = true;
    npc.add(rightLeg);

    const armGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(-0.55, 0.15, 0);
    leftArm.castShadow = true;
    npc.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.set(0.55, 0.15, 0);
    rightArm.castShadow = true;
    npc.add(rightArm);

    scene.add(npc);

    npcVision = new THREE.SpotLight(0xff0000, 2.0, 15, Math.PI / 4, 0.5, 1);
    npcVision.position.set(0, 0.5, 0);
    npc.add(npcVision);
    scene.add(npcVision.target);

    patrolPoints = [
      new THREE.Vector3(-5, 1.0, 0),         // Front left (Living room)
      new THREE.Vector3(-5, 1.0, hZ - 4),    // Back left (Living room)
      new THREE.Vector3(0, 1.0, hZ - 4),     // Back center (Hallway)
      new THREE.Vector3(5, 1.0, hZ - 4),     // Back right (Kitchen)
      new THREE.Vector3(5, 1.0, 0),          // Front right (Kitchen entrance)
      new THREE.Vector3(0, 1.0, 0)           // Center (Front door)
    ];
    currentPatrolIndex = 0;
    npcState = 'PATROL';
  } else if (levelNum === 2) {
    // --- LEVEL 2: The Warehouse ---
    const houseMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.9 });
    const innerWallMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 1.0 });

    // Concrete floor
    const concreteTex = createStaticTexture(); // Reusing noise for concrete look
    concreteTex.repeat.set(10, 10);
    const houseFloorMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      color: 0x666666,
      roughness: 0.8
    });

    const hY = 4;
    const hW = 20;
    const hD = 16;
    const hZ = -2;

    const inFloorGeo = new THREE.PlaneGeometry(hW - 0.5, hD - 0.5);
    const inFloor = new THREE.Mesh(inFloorGeo, houseFloorMat);
    inFloor.rotation.x = -Math.PI / 2;
    inFloor.position.set(0, 0.01, hZ);
    inFloor.receiveShadow = true;
    addLvl(inFloor);

    // Roof
    const roofGeo = new THREE.BoxGeometry(hW + 1, 1, hD + 1);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 8.5, hZ);
    roof.castShadow = true;
    addLvl(roof);

    function createWall(x, z, width, depth, isInner = false) {
      const geo = new THREE.BoxGeometry(width, 8, depth);
      const mesh = new THREE.Mesh(geo, isInner ? innerWallMat : houseMat);
      mesh.position.set(x, hY, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      addLvl(mesh, true);
    }

    // Outer walls
    createWall(0, hZ - hD / 2, hW, 0.5); // Back
    createWall(-hW / 2, hZ, 0.5, hD);    // Left
    createWall(hW / 2, hZ, 0.5, hD);     // Right

    // Front Left Wall w/ Window
    function createWallExtL2(x, y, z, width, height, depth) {
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geo, houseMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      addLvl(mesh, true);
    }
    createWallExtL2(-8.5, hY, hZ + hD / 2, 3, 8, 0.5); // left side
    createWallExtL2(-3.5, hY, hZ + hD / 2, 3, 8, 0.5); // right side
    createWallExtL2(-6, 0.5, hZ + hD / 2, 2, 1, 0.5);  // bottom
    createWallExtL2(-6, 5.0, hZ + hD / 2, 2, 6, 0.5);  // top

    // Window Glass
    const glassGeo2 = new THREE.BoxGeometry(2, 2, 0.1);
    const glassMat2 = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 });
    const glass2 = new THREE.Mesh(glassGeo2, glassMat2);
    glass2.position.set(-6, 2.0, hZ + hD / 2);
    addLvl(glass2, true);

    createWall(6, hZ + hD / 2, 8, 0.5);  // Front right

    // Warehouse Crates
    const crateMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
    function createCrate(x, y, z, size) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
      crate.position.set(x, y, z);
      crate.castShadow = true;
      crate.receiveShadow = true;
      addLvl(crate, true);
    }

    // Stack 1
    createCrate(-4, 1.5, -4, 3);
    createCrate(-4, 4.5, -4, 3);

    // Stack 2
    createCrate(4, 1, -6, 2);
    createCrate(4, 3, -6, 2);
    createCrate(6, 1, -6, 2);

    // Obstacle Wall
    createWall(0, hZ, 10, 0.5, true);

    // Level 2 Furniture (Couch and TV)
    const couchMat2 = new THREE.MeshStandardMaterial({ map: fabricTex, roughness: 1.0 });
    const tvMat2 = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
    const screenMat2 = new THREE.MeshBasicMaterial({ map: staticTex });

    // Couch
    const couch2 = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), couchMat2);
    couch2.position.set(4, 1, -8); // Placed in the back right
    couch2.castShadow = true;
    couch2.receiveShadow = true;
    addLvl(couch2, false); // Non-collidable so NPC doesn't trap himself inside during CHASE

    // TV setup
    const tvBody2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.5, 4), tvMat2);
    tvBody2.position.set(8, 3, -8); // On the right wall
    tvBody2.castShadow = true;
    tvBody2.receiveShadow = true;
    addLvl(tvBody2, true);

    const tvScreen2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1), screenMat2);
    tvScreen2.position.set(7.74, 3, -8);
    tvScreen2.rotation.y = -Math.PI / 2; // Face inward towards couch
    addLvl(tvScreen2);

    // Loot setup
    const lootGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const lootMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 1.0, roughness: 0.2, emissive: 0x332200 });

    function createLoot(x, y, z) {
      const loot = new THREE.Mesh(lootGeo, lootMat);
      loot.position.set(x, y, z);
      addLvl(loot);
      lootItems.push({ mesh: loot, collected: false });
      totalLoot++;
    }

    createLoot(-2, 0.5, -4);  // Moved next to crates so it's visible on the floor
    createLoot(6, 2.5, -6);   // On short crate
    createLoot(-8, 0.5, hZ + hD / 2 - 2); // Hidden in front corner

    // Lighting (spooky warehouse)
    const light1 = new THREE.PointLight(0xaaddff, 1.8, 20);
    light1.position.set(-5, 6, -5);
    addLvl(light1);

    const light2 = new THREE.PointLight(0xaaddff, 1.0, 15);
    light2.position.set(5, 6, 2);
    addLvl(light2);

    // Door at entrance
    const doorContainer = new THREE.Group();
    doorContainer.position.set(-2, hY, hZ + hD / 2);
    const doorGeo = new THREE.BoxGeometry(4, 8, 0.4);
    const doorMesh = new THREE.Mesh(doorGeo, crateMat);
    doorMesh.position.set(2, 0, 0);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    doorContainer.add(doorMesh);
    addLvl(doorContainer, false); // Door collision disabled to prevent getting stuck when it swings open
    interactiveDoors.push(doorContainer);

    // NPC Setup (Humanoid - Fatter)
    npc = new THREE.Group();
    npc.position.set(4.5, 1.0, -8); // Sitting on couch

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x222222 }); // Dark shirt for level 2
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), skinMat);
    head.position.set(0, 0.85, 0);
    head.castShadow = true;
    npc.add(head);

    // Fatter torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.8), shirtMat);
    torso.position.set(0, 0.1, 0);
    torso.castShadow = true;
    npc.add(torso);

    const legGeo = new THREE.BoxGeometry(0.35, 0.8, 0.35);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.25, -0.6, 0);
    leftLeg.castShadow = true;
    npc.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.25, -0.6, 0);
    rightLeg.castShadow = true;
    npc.add(rightLeg);

    const armGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(-0.75, 0.15, 0);
    leftArm.castShadow = true;
    npc.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.set(0.75, 0.15, 0);
    rightArm.castShadow = true;
    npc.add(rightArm);

    scene.add(npc);

    npcVision = new THREE.SpotLight(0xff0000, 2.0, 20, Math.PI / 4, 0.5, 1);
    npcVision.position.set(0, 0.5, 0);
    npc.add(npcVision);
    scene.add(npcVision.target);

    // Initial rotation looking at TV
    npc.lookAt(new THREE.Vector3(8, 1.0, -8));

    patrolPoints = [
      new THREE.Vector3(4.5, 1.0, -8) // Doesn't move, just watches TV
    ];
    currentPatrolIndex = 0;
    npcState = 'PATROL'; // Effectively idle

    // Set level 2 speeds
    npcSpeed = 0; // Very lazy
    npcChaseSpeed = 3.5; 

  } else {
    // End of game
    const ui = document.getElementById('ui');
    ui.innerHTML = '<div><h1 style="color:#00ff00;">YOU ESCAPED!</h1><p>More levels coming soon...</p></div>';
    ui.style.display = 'flex';
    document.exitPointerLock();
  }

  // Set player start
  camera.position.set(0, 1.6, yardSize - 2);
  if (velocity) velocity.set(0, 0, 0);

  // Initial HUD
  if (totalLoot > 0) document.getElementById('lootCount').innerText = `${lootCollected} / ${totalLoot}`;
}

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = { forward: false, backward: false, left: false, right: false };

// Initial Build
buildLevel(1);

// 3. Controls & Input
const controls = new PointerLockControls(camera, document.body);
const uiConfig = document.getElementById('ui');

// Click listener on the UI overlay
uiConfig.addEventListener('click', () => {
  controls.lock();
});

controls.addEventListener('lock', () => {
  uiConfig.style.display = 'none';
  document.getElementById('hud').style.display = 'block';
});

controls.addEventListener('unlock', () => {
  uiConfig.style.display = 'flex';
  document.getElementById('hud').style.display = 'none';
});

document.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'KeyW': moveState.forward = true; break;
    case 'KeyA': moveState.left = true; break;
    case 'KeyS': moveState.backward = true; break;
    case 'KeyD': moveState.right = true; break;
    case 'Digit1': if (event.shiftKey) buildLevel(1); break;
    case 'Digit2': if (event.shiftKey) buildLevel(2); break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW': moveState.forward = false; break;
    case 'KeyA': moveState.left = false; break;
    case 'KeyS': moveState.backward = false; break;
    case 'KeyD': moveState.right = false; break;
  }
});

// 4. Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Helper variables for collision detection
const playerBox = new THREE.Box3();
const objBox = new THREE.Box3();
const playerSize = 0.5; // Player radius

// Vision Raycaster
const raycaster = new THREE.Raycaster();

// 5. Game Loop
let lastTime = performance.now();
const speed = 20.0;

function animate(time) {
  requestAnimationFrame(animate);

  const delta = (time - lastTime) / 1000;
  lastTime = time;

  if (controls.isLocked) {
    // Apply friction
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize(); // consistent speed in all directions

    if (moveState.forward || moveState.backward) velocity.z -= direction.z * speed * delta;
    if (moveState.left || moveState.right) velocity.x -= direction.x * speed * delta;

    // Calculate intended lateral movement
    const dx = -velocity.x * delta;
    const dz = -velocity.z * delta;

    // Calculate future position based on camera orientation
    const futurePos = camera.position.clone();

    // We have to extract the right/forward vectors from the camera to correctly apply WASD
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0; right.normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();

    // Apply movement to futurePos
    futurePos.add(right.multiplyScalar(dx));
    futurePos.add(forward.multiplyScalar(dz));

    // Construct player AABB at future position
    playerBox.setFromCenterAndSize(
      new THREE.Vector3(futurePos.x, 1.0, futurePos.z), // Center y lower so we don't jump over short fences
      new THREE.Vector3(playerSize, 2.0, playerSize)
    );

    // Collision Check
    let collided = false;
    for (const obj of collidables) {
      objBox.setFromObject(obj);
      if (playerBox.intersectsBox(objBox)) {
        collided = true;
        break; // Stop checking
      }
    }

    // Only move if there is no collision
    if (!collided) {
      controls.moveRight(dx);
      controls.moveForward(dz);
    } else {
      // Kill velocity on hit
      velocity.x = 0;
      velocity.z = 0;
    }

    // Keep the flashlight target pointing perfectly ahead of the camera in world space
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    flashlight.target.position.copy(camera.position).add(dir.multiplyScalar(10));

    // Update Interactive Doors
    interactiveDoors.forEach(door => {
      const doorCenter = new THREE.Vector3();
      door.children[0].getWorldPosition(doorCenter);
      if (camera.position.distanceTo(doorCenter) < 4.0) {
        door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, -Math.PI / 2, 0.05);
      } else {
        door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, 0, 0.05);
      }
    });

    // Loot Detection
    lootItems.forEach(item => {
      if (!item.collected) {
        if (camera.position.distanceTo(item.mesh.position) < 2.0) {
          item.collected = true;
          item.mesh.visible = false;
          lootCollected++;
          document.getElementById('lootCount').innerText = `${lootCollected} / ${totalLoot}`;

          // Flash screen gold briefly
          document.body.style.backgroundColor = "#ffcc00";
          setTimeout(() => document.body.style.backgroundColor = "#1a1a1a", 50);
        }
      }
    });

    // Check Level Exit (Front gap)
    if (lootCollected === totalLoot && totalLoot > 0) {
      if (camera.position.z > yardSize - 3 && Math.abs(camera.position.x) < 2.5) {
        // Level Complete!
        document.body.style.backgroundColor = "#00ff00";
        setTimeout(() => document.body.style.backgroundColor = "#1a1a1a", 200);
        buildLevel(currentLevel + 1);
        return; // Exit current frame
      }
    }

    // Helper variables for NPC collision
    const npcBox = new THREE.Box3();
    const npcSize = 0.4; // NPC radius

    // NPC Logic (Average Guy)
    if (npc) {
      if (npcState === 'PATROL') {
        const targetPos = patrolPoints[currentPatrolIndex];
        const npcDir = new THREE.Vector3().subVectors(targetPos, npc.position);
        npcDir.y = 0; // lock to XZ plane
        const dist = npcDir.length();

        if (dist < 0.1) {
          currentPatrolIndex = (currentPatrolIndex + 1) % patrolPoints.length;
        } else {
          npcDir.normalize();
          const moveDist = npcSpeed * delta;
          const futurePos = npc.position.clone().add(npcDir.clone().multiplyScalar(moveDist));

          npcBox.setFromCenterAndSize(
            new THREE.Vector3(futurePos.x, 1.0, futurePos.z),
            new THREE.Vector3(npcSize * 2, 2.0, npcSize * 2)
          );

          let npcCollided = false;
          for (const obj of collidables) {
            objBox.setFromObject(obj);
            if (npcBox.intersectsBox(objBox)) {
              npcCollided = true;
              break;
            }
          }

          if (!npcCollided) {
            npc.position.copy(futurePos);
          } else {
            // If patrol path hits a wall, just skip to next point to avoid getting stuck
            currentPatrolIndex = (currentPatrolIndex + 1) % patrolPoints.length;
          }

          const lookTarget = npc.position.clone().add(npcDir);
          npc.lookAt(lookTarget);
        }
      } else if (npcState === 'CHASE') {
        // Change spotlight to pure intense red
        npcVision.color.setHex(0xff0000);
        npcVision.intensity = 5.0;

        const npcDir = new THREE.Vector3().subVectors(camera.position, npc.position);
        npcDir.y = 0; // Stay grounded
        const dist = npcDir.length();

        if (dist < 1.0) { // Caught!
          caughtPlayer();
        } else {
          // Check Line of Sight during chase
          raycaster.set(npc.position, new THREE.Vector3().subVectors(camera.position, npc.position).normalize());

          // Get all meshes from doors
          const doorMeshes = interactiveDoors.map(d => d.children[0]);
          const sightBlockers = [...collidables, ...doorMeshes];

          const intersects = raycaster.intersectObjects(sightBlockers);
          let hasLineOfSight = true;
          if (intersects.length > 0) {
            if (intersects[0].distance < dist) {
              hasLineOfSight = false; // Wall blocked view
            }
          }

          if (!hasLineOfSight) {
            chaseTimeout += delta;
            if (chaseTimeout > 2.0) { // Lose interest after 2 seconds out of sight
              npcState = 'PATROL';
              npcVision.color.setHex(0xffffff); // Reset light
              npcVision.intensity = 2.0;
              chaseTimeout = 0;
            }
          } else {
            chaseTimeout = 0; // Reset timeout if we see them
          }

          npcDir.normalize();
          const moveDist = npcChaseSpeed * delta;
          const futurePos = npc.position.clone().add(npcDir.clone().multiplyScalar(moveDist));

          npcBox.setFromCenterAndSize(
            new THREE.Vector3(futurePos.x, 1.0, futurePos.z),
            new THREE.Vector3(npcSize * 2, 2.0, npcSize * 2)
          );

          let npcCollided = false;
          for (const obj of collidables) {
            objBox.setFromObject(obj);
            if (npcBox.intersectsBox(objBox)) {
              npcCollided = true;
              break;
            }
          }

          if (!npcCollided) {
            npc.position.copy(futurePos);
          } else {
            // Simple slide along walls if chasing
            const tryX = npc.position.clone().add(new THREE.Vector3(npcDir.x * moveDist, 0, 0));
            npcBox.setFromCenterAndSize(
              new THREE.Vector3(tryX.x, 1.0, tryX.z),
              new THREE.Vector3(npcSize * 2, 2.0, npcSize * 2)
            );
            let collidedX = false;
            for (const obj of collidables) { objBox.setFromObject(obj); if (npcBox.intersectsBox(objBox)) { collidedX = true; break; } }
            if (!collidedX) npc.position.copy(tryX);
            else {
              const tryZ = npc.position.clone().add(new THREE.Vector3(0, 0, npcDir.z * moveDist));
              npcBox.setFromCenterAndSize(
                new THREE.Vector3(tryZ.x, 1.0, tryZ.z),
                new THREE.Vector3(npcSize * 2, 2.0, npcSize * 2)
              );
              let collidedZ = false;
              for (const obj of collidables) { objBox.setFromObject(obj); if (npcBox.intersectsBox(objBox)) { collidedZ = true; break; } }
              if (!collidedZ) npc.position.copy(tryZ);
            }
          }

          const lookTarget = npc.position.clone().add(npcDir);
          npc.lookAt(lookTarget);
        }
      }

      // Update NPC Flashlight/Vision Cone target
      npcVision.target.position.copy(npc.position).add(new THREE.Vector3(0, 0, 1).applyQuaternion(npc.quaternion).multiplyScalar(10));

      // 2. Line of Sight Detection (Only care if patrolling)
      if (npcState === 'PATROL') {
        const toPlayer = new THREE.Vector3().subVectors(camera.position, npc.position);
        const distanceToPlayer = toPlayer.length();
        const maxVision = currentLevel === 1 ? 8 : 15;
        const visionCone = currentLevel === 1 ? Math.PI / 6 : Math.PI / 4;

        if (distanceToPlayer < maxVision) { // Max vision distance
          const npcForward = new THREE.Vector3(0, 0, 1).applyQuaternion(npc.quaternion).normalize();
          toPlayer.normalize();

          // Check if player is within the vision cone angle (e.g., 45 degrees)
          const angle = npcForward.angleTo(toPlayer);
          if (angle < visionCone) {
            // Raycast to check for walls blocking the view
            raycaster.set(npc.position, toPlayer);

            // Get all meshes from doors
            const doorMeshes = interactiveDoors.map(d => d.children[0]);
            const sightBlockers = [...collidables, ...doorMeshes];

            // Only check collision with walls/fences and doors
            const intersects = raycaster.intersectObjects(sightBlockers);

            let hasLineOfSight = true;
            if (intersects.length > 0) {
              if (intersects[0].distance < distanceToPlayer) {
                hasLineOfSight = false; // Wall blocked view
              }
            }

            if (hasLineOfSight) {
              // Spotted!
              npcState = 'CHASE';
              chaseTimeout = 0;
              console.log("SPOTTED! Chasing player...");
              // Play a sound or change lighting for jump scare
            }
          }
        }
      }
    }
  }

  renderer.render(scene, camera);
}

function caughtPlayer() {
  console.log("CAUGHT!");

  // Flash screen red (simple CSS trick)
  document.body.style.backgroundColor = "red";
  setTimeout(() => document.body.style.backgroundColor = "#1a1a1a", 150);

  // Reset Level entirely to clear state
  buildLevel(currentLevel);
}

animate(performance.now());
