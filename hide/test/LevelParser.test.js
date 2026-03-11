import { describe, it, expect } from 'vitest';
import { parseLevel } from '../src/LevelParser.js';

describe('LevelParser', () => {
  it('parses a basic room with a player, loot, and NPC', () => {
    const map = `
+----+
|*   |
| X  |
|   S|
+----+
    `.trim();

    const result = parseLevel(map);

    expect(result.width).toBe(6);
    expect(result.height).toBe(5 * 2);

    // Player Start
    expect(result.start).toBeDefined();
    expect(result.start.x).toBe(4);
    expect(result.start.z).toBe(3 * 2); // Z is scaled by 2

    // Loot
    expect(result.loots).toHaveLength(1);
    expect(result.loots[0].x).toBe(1);
    expect(result.loots[0].z).toBe(1 * 2);

    // NPC
    expect(result.npcs).toHaveLength(1);
    expect(result.npcs[0].x).toBe(2);
    expect(result.npcs[0].z).toBe(2 * 2);
    expect(result.npcs[0].type).toBe('X');
  });

  it('parses walls correctly with contextual sizing', () => {
    const map = `
+-
| 
    `.trim();

    const result = parseLevel(map);
    // + yields center + right arm + bottom arm = 3. - yields 1. | yields 1. Total: 5.
    expect(result.walls).toHaveLength(5);

    // + center at 0,0
    expect(result.walls[0].x).toBe(0);
    expect(result.walls[0].z).toBe(0);
    expect(result.walls[0].width).toBe(0.5);
    expect(result.walls[0].depth).toBe(0.5);

    // + right arm
    expect(result.walls[1].x).toBe(0.375);
    expect(result.walls[1].z).toBe(0);
    expect(result.walls[1].width).toBe(0.25);
    expect(result.walls[1].depth).toBe(0.5);

    // + bottom arm
    expect(result.walls[2].x).toBe(0);
    expect(result.walls[2].z).toBe(0.625);
    expect(result.walls[2].width).toBe(0.5);
    expect(result.walls[2].depth).toBe(0.75);

    // - at 1,0 is always w:1 d:0.5
    expect(result.walls[3].x).toBe(1);
    expect(result.walls[3].z).toBe(0);
    expect(result.walls[3].width).toBe(1);
    expect(result.walls[3].depth).toBe(0.5);

    // | at 0,1 is always w:0.5 d:2
    expect(result.walls[4].x).toBe(0);
    expect(result.walls[4].z).toBe(1 * 2);
    expect(result.walls[4].width).toBe(0.5);
    expect(result.walls[4].depth).toBe(2);
  });

  it('parses windows, doors, and cameras with orientation', () => {
    const map = `
-"#C
    `.trim();

    const result = parseLevel(map);

    expect(result.windows).toHaveLength(1);
    expect(result.windows[0].x).toBe(1);
    expect(result.windows[0].z).toBe(0);
    expect(result.windows[0].isX).toBe(true);

    expect(result.doors).toHaveLength(1);
    expect(result.doors[0].x).toBe(2);
    expect(result.doors[0].z).toBe(0);
    expect(result.doors[0].isX).toBe(true);

    expect(result.cameras).toHaveLength(1);
    expect(result.cameras[0].x).toBe(3);
    expect(result.cameras[0].z).toBe(0);
  });
});
