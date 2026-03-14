import { describe, it, expect } from 'vitest';
import { generateMystery, movePlayer, checkFoundItem } from '../src/logic.js';

describe('Game Logic', () => {
  it('should generate a valid mystery state', () => {
    const state = generateMystery();
    expect(state.targetItem).toBeTruthy();
    expect(state.targetBuildingName).toBeTruthy();
    expect(state.buildings.length).toBeGreaterThan(0);
    expect(state.items.length).toBe(state.buildings.length);
    expect(state.player).toBeDefined();
    
    // Check exactly one target item exists
    const targetItems = state.items.filter(i => i.isTarget);
    expect(targetItems.length).toBe(1);
    expect(targetItems[0].name).toBe(state.targetItem);
  });

  it('should move the player', () => {
    const state = generateMystery();
    const initialX = state.player.x;
    const initialY = state.player.y;

    movePlayer(state, { KeyD: true }); // Move right
    expect(state.player.x).toBeGreaterThan(initialX);
    expect(state.player.y).toBe(initialY);

    movePlayer(state, { KeyS: true }); // Move down
    expect(state.player.y).toBeGreaterThan(initialY);
  });

  it('should trigger game over when player intersects target item', () => {
    const state = generateMystery();
    const target = state.items.find(i => i.isTarget);
    
    // Teleport player to item
    state.player.x = target.x;
    state.player.y = target.y;

    const found = checkFoundItem(state);
    expect(found).toBe(true);
    expect(state.gameOver).toBe(true);
  });
});
