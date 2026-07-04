import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS_THAT_MUST_NOT_IMPORT_PHASER = ['src/sim', 'src/physics', 'src/ai', 'src/input'];

describe('architecture boundaries', () => {
  it('keeps simulation, physics, and AI independent from Phaser', () => {
    const offenders = ROOTS_THAT_MUST_NOT_IMPORT_PHASER.flatMap((root) =>
      sourceFiles(root).filter((file) => readFileSync(file, 'utf8').includes("from 'phaser'")),
    );

    expect(offenders).toEqual([]);
  });
});

function sourceFiles(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const fullPath = join(path, entry);
    if (statSync(fullPath).isDirectory()) {
      return sourceFiles(fullPath);
    }
    return fullPath.endsWith('.ts') ? [fullPath] : [];
  });
}
