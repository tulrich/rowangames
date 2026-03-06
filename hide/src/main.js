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
const npcSpeed = 2.0;
const npcChaseSpeed = 4.5;
const levelObjects = [];
const yardSize = 15;

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

  if (npc) {
    scene.remove(npc);
    if (npcVision && npcVision.target) scene.remove(npcVision.target);
    if (npc.geometry) npc.geometry.dispose();
    if (npc.material) npc.material.dispose();
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

  // Persistent yard base
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  addLvl(floor);

  // Fence material & geometry
  const fencePillarGeo = new THREE.BoxGeometry(0.3, 1.8, 0.1);
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
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
    const houseMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const innerWallMat = new THREE.MeshLambertMaterial({ color: 0xddddcc });
    const houseFloorMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const hY = 4;
    const hW = 15;
    const hD = 12;
    const hZ = -5;

    const inFloorGeo = new THREE.PlaneGeometry(hW - 0.5, hD - 0.5);
    const inFloor = new THREE.Mesh(inFloorGeo, houseFloorMat);
    inFloor.rotation.x = -Math.PI / 2;
    inFloor.position.set(0, 0.01, hZ);
    inFloor.receiveShadow = true;
    addLvl(inFloor);

    const roofGeo = new THREE.BoxGeometry(hW + 1, 1, hD + 1);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
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
    createWall(4.5, hZ + hD / 2, 6, 0.5);
    createWall(-2, hZ, 0.5, 8, true);
    createWall(3, hZ - 2, 6, 0.5, true);

    const furnMat = new THREE.MeshLambertMaterial({ color: 0x553322 });
    const couchMat = new THREE.MeshLambertMaterial({ color: 0x223355 });
    const tvMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 2), furnMat);
    counter.position.set(4, 1.5, hZ - 4);
    counter.castShadow = true;
    counter.receiveShadow = true;
    addLvl(counter, true);

    const tvDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.5, 4), tvMat);
    tvDisplay.position.set(-6, 3, hZ);
    tvDisplay.castShadow = true;
    tvDisplay.receiveShadow = true;
    addLvl(tvDisplay, true);

    const couch = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), couchMat);
    couch.position.set(-3.5, 1, hZ);
    couch.castShadow = true;
    couch.receiveShadow = true;
    addLvl(couch, true);

    const lootGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const lootMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

    function createLoot(x, y, z) {
      const loot = new THREE.Mesh(lootGeo, lootMat);
      loot.position.set(x, y, z);
      addLvl(loot);
      lootItems.push({ mesh: loot, collected: false });
      totalLoot++;
    }

    createLoot(4, 3.5, hZ - 4);
    createLoot(-2, 1, hZ - 4);
    createLoot(-6, 1, hZ + 4);

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

    // NPC Setup
    const npcGeo = new THREE.BoxGeometry(0.8, 2.0, 0.8);
    const npcMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    npc = new THREE.Mesh(npcGeo, npcMat);
    npc.position.set(-5, 1.0, hZ);
    npc.castShadow = true;
    npc.receiveShadow = true;
    scene.add(npc);

    npcVision = new THREE.SpotLight(0xff0000, 2.0, 15, Math.PI / 4, 0.5, 1);
    npcVision.position.set(0, 0.5, 0);
    npc.add(npcVision);
    scene.add(npcVision.target);

    patrolPoints = [
      new THREE.Vector3(-5, 1.0, hZ),
      new THREE.Vector3(-5, 1.0, hZ + 5),
      new THREE.Vector3(-1, 1.0, hZ + 5),
      new THREE.Vector3(-1, 1.0, hZ),
      new THREE.Vector3(3.5, 1.0, hZ)
    ];
    currentPatrolIndex = 0;
    npcState = 'PATROL';
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

        if (distanceToPlayer < 15) { // Max vision distance
          const npcForward = new THREE.Vector3(0, 0, 1).applyQuaternion(npc.quaternion).normalize();
          toPlayer.normalize();

          // Check if player is within the vision cone angle (e.g., 45 degrees)
          const angle = npcForward.angleTo(toPlayer);
          if (angle < Math.PI / 4) {
            // Raycast to check for walls blocking the view
            raycaster.set(npc.position, toPlayer);
            // Only check collision with walls/fences
            const intersects = raycaster.intersectObjects(collidables);

            let hasLineOfSight = true;
            if (intersects.length > 0) {
              if (intersects[0].distance < distanceToPlayer) {
                hasLineOfSight = false; // Wall blocked view
              }
            }

            if (hasLineOfSight) {
              // Spotted!
              npcState = 'CHASE';
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
