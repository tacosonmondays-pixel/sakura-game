// Shared GLB parsing for the model tests (not a test file itself, so importing it does not
// register another suite).
import { expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Parses a GLB file: returns { json, binLength }. */
export function readGlbHeader(file) {
  const buf = readFileSync(file);
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  expect(buf.readUInt32LE(4)).toBe(2);
  const total = buf.readUInt32LE(8);
  expect(total).toBe(buf.length);
  let off = 12;
  let json = null;
  let binLength = 0;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    off += 8;
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off, off + len).toString('utf8'));
    else if (type === 0x004e4942) binLength = len;
    off += len;
  }
  return { json, binLength };
}
