import { describe, it, expect } from 'vitest';
import { findDuplicatePrefixes } from './lint-migrations.js';

describe('findDuplicatePrefixes', () => {
  it('returns an empty array when every prefix is unique', () => {
    const files = ['0002_a.sql', '0003_b.sql', '0004_c.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([]);
  });

  it('reports a prefix used by two files', () => {
    const files = ['0029_dismissed_banners.sql', '0029_express_defense_tier.sql', '0030_x.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([
      { prefix: '0029', files: ['0029_dismissed_banners.sql', '0029_express_defense_tier.sql'] },
    ]);
  });

  it('reports multiple colliding prefixes sorted by prefix', () => {
    const files = ['0034_b.sql', '0029_b.sql', '0029_a.sql', '0034_a.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([
      { prefix: '0029', files: ['0029_a.sql', '0029_b.sql'] },
      { prefix: '0034', files: ['0034_a.sql', '0034_b.sql'] },
    ]);
  });

  it('ignores files that do not start with a four-digit prefix', () => {
    const files = ['README.md', 'staging-schema.sql', '0002_a.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([]);
  });

  it('reports three files sharing one prefix as a single entry', () => {
    const files = ['0005_a.sql', '0005_b.sql', '0005_c.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([
      { prefix: '0005', files: ['0005_a.sql', '0005_b.sql', '0005_c.sql'] },
    ]);
  });
});
