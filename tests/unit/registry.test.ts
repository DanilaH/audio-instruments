import { describe, expect, it } from 'vitest';

import { getPublicTools, toolRegistry } from '../../src/registry/tools';

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
