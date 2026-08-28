import { describe, expect, it } from 'vitest';

// P0 replaces this temporary import path with the final registry module path
// established by the scaffold. The assertions themselves are mandatory.
import { getPublicTools, toolRegistry } from '../../src/config/tools';

describe('tool registry', () => {
  it('contains only planned/live statuses', () => {
    for (const tool of toolRegistry) {
      expect(['planned', 'live']).toContain(tool.status);
    }
  });

  it('public tools contain only live entries', () => {
    expect(getPublicTools().every((tool) => tool.status === 'live')).toBe(true);
  });

  it('never leaks a planned tool into public data', () => {
    const publicIds = new Set(getPublicTools().map((tool) => tool.id));

    for (const tool of toolRegistry) {
      if (tool.status === 'planned') {
        expect(publicIds.has(tool.id)).toBe(false);
      }
    }
  });
});
