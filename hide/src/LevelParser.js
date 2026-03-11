import fs from 'fs';
import path from 'path';

// Z coordinates are multiplied by 2 because ASCII characters are ~2x taller than wide
const Z_SCALE = 2;
const X_SCALE = 1;

export function parseLevel(asciiString) {
  // Normalize Windows CRLF to a standard LF
  const lines = asciiString.replace(/\r\n/g, '\n').split('\n');
  const height = lines.length;
  let width = 0;

  const result = {
    width: 0,
    height: 0,
    walls: [],
    windows: [],
    doors: [],
    loots: [],
    npcs: [],
    cameras: [],
    start: null
  };

  for (let z = 0; z < height; z++) {
    const line = lines[z];
    if (line.length > width) width = line.length;

    for (let x = 0; x < line.length; x++) {
      const char = line[x];
      // World coordinates for the 3D scene (Z offset scaled heavily)
      const worldX = x * X_SCALE;
      const worldZ = z * Z_SCALE;

      switch (char) {
        case '+':
        case '-':
        case '|': {
          const isHWall = (c) => ['-', '+', '"', '#'].includes(c);
          const isVWall = (c) => ['|', '+', '"', '#'].includes(c);

          if (char === '-') {
            result.walls.push({ x: worldX, z: worldZ, width: 1.0, depth: 0.5 });
          } else if (char === '|') {
            result.walls.push({ x: worldX, z: worldZ, width: 0.5, depth: 2.0 });
          } else { // '+'
            // Center core
            result.walls.push({ x: worldX, z: worldZ, width: 0.5, depth: 0.5 });

            // Connecting arms
            if (x > 0 && isHWall(line[x - 1])) {
              result.walls.push({ x: worldX - 0.375, z: worldZ, width: 0.25, depth: 0.5 });
            }
            if (x < line.length - 1 && isHWall(line[x + 1])) {
              result.walls.push({ x: worldX + 0.375, z: worldZ, width: 0.25, depth: 0.5 });
            }
            if (z > 0 && lines[z - 1].length > x && isVWall(lines[z - 1][x])) {
              result.walls.push({ x: worldX, z: worldZ - 0.625, width: 0.5, depth: 0.75 });
            }
            if (z < height - 1 && lines[z + 1].length > x && isVWall(lines[z + 1][x])) {
              result.walls.push({ x: worldX, z: worldZ + 0.625, width: 0.5, depth: 0.75 });
            }
          }
          break;
        }
        case '"':
        case '#': {
          const isHWall = (c) => ['-', '+', '"', '#'].includes(c);
          const hasLeft = x > 0 && isHWall(line[x - 1]);
          const hasRight = x < line.length - 1 && isHWall(line[x + 1]);
          const isX = hasLeft || hasRight;

          if (char === '"') {
            result.windows.push({ x: worldX, z: worldZ, isX });
          } else {
            result.doors.push({ x: worldX, z: worldZ, isX });
          }
          break;
        }
        case '*':
          result.loots.push({ x: worldX, z: worldZ });
          break;
        case 'X':
          result.npcs.push({ x: worldX, z: worldZ, type: char });
          break;
        case 'C':
          result.cameras.push({ x: worldX, z: worldZ });
          break;
        case 'S':
          result.start = { x: worldX, z: worldZ };
          break;
        case ' ':
        default:
          break;
      }
    }
  }

  // The actual width/height based on character counts (so consumers can center the chunk)
  result.width = width * X_SCALE;
  result.height = height * Z_SCALE;

  return result;
}

// Build script execution
const isMainModule = import.meta.url.startsWith('file:') && process.argv[1] === import.meta.url.replace('file://', '');

if (isMainModule) {
  const mapsDir = path.resolve('src/maps');
  const objDir = path.resolve('src/obj');

  if (!fs.existsSync(objDir)) {
    fs.mkdirSync(objDir, { recursive: true });
  }

  const files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.txt'));

  for (const file of files) {
    const filePath = path.join(mapsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsedData = parseLevel(content);

    const outName = file.replace('.txt', '.js');
    const outPath = path.join(objDir, outName);

    // Write an ES module
    const jsContent = `export default ${JSON.stringify(parsedData, null, 2)};\n`;
    fs.writeFileSync(outPath, jsContent);

    console.log(`Compiled ${file} -> ${outName}`);
  }
}
