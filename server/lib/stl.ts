// STL analysis for server-side 3D print pricing. Mirrors the browser preview in
// src/pages/Print3D.tsx so the quoted and charged prices match.

export interface StlAnalysis {
  volumeCm3: number;
  sizeMm: { x: number; y: number; z: number };
  triangles: number;
}

export class StlError extends Error {}

const MAX_TRIANGLES = 5_000_000;

function forEachTriangleBinary(buf: Buffer, count: number, fn: (v: number[]) => void) {
  const v = new Array<number>(9);
  for (let t = 0; t < count; t++) {
    const base = 84 + t * 50 + 12; // skip the facet normal
    for (let k = 0; k < 9; k++) v[k] = buf.readFloatLE(base + k * 4);
    fn(v);
  }
}

function forEachTriangleAscii(text: string, fn: (v: number[]) => void): number {
  const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  const tri: number[] = [];
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    tri.push(Number(m[1]), Number(m[2]), Number(m[3]));
    if (tri.length === 9) {
      if (++count > MAX_TRIANGLES) throw new StlError('Model has too many triangles');
      fn(tri);
      tri.length = 0;
    }
  }
  return count;
}

export function analyzeStl(buf: Buffer): StlAnalysis {
  if (buf.length < 84) throw new StlError('File is too small to be an STL model');

  let volume = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const visit = (v: number[]) => {
    for (let i = 0; i < 9; i++) {
      if (!Number.isFinite(v[i])) throw new StlError('Model contains invalid coordinates');
      const axis = i % 3;
      if (v[i] < min[axis]) min[axis] = v[i];
      if (v[i] > max[axis]) max[axis] = v[i];
    }
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = v;
    volume += (ax * (by * cz - bz * cy) + bx * (cy * az - cz * ay) + cx * (ay * bz - az * by)) / 6;
  };

  // Binary STL: 80-byte header, uint32 count, 50 bytes per triangle. Some ASCII files
  // start with "solid", so the size check decides.
  const binaryCount = buf.readUInt32LE(80);
  let triangles: number;
  if (84 + binaryCount * 50 === buf.length) {
    if (binaryCount > MAX_TRIANGLES) throw new StlError('Model has too many triangles');
    forEachTriangleBinary(buf, binaryCount, visit);
    triangles = binaryCount;
  } else {
    triangles = forEachTriangleAscii(buf.toString('latin1'), visit);
  }
  if (triangles === 0) throw new StlError('Model has no triangles');

  const raw = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
  // Same unit detection as the browser: < 1 means metres, > 10000 means microns.
  const maxRaw = Math.max(raw.x, raw.y, raw.z);
  const toMm = maxRaw < 1 ? 1000 : maxRaw > 10000 ? 0.001 : 1;

  return {
    // Rounded like the browser preview so quoted and charged prices agree.
    volumeCm3: +((Math.abs(volume) * toMm ** 3) / 1000).toFixed(2),
    sizeMm: { x: raw.x * toMm, y: raw.y * toMm, z: raw.z * toMm },
    triangles,
  };
}

export const PRINT_QUALITIES: Record<string, number> = {
  '0.2-std': 1,
  '0.15-med': 1.2,
  '0.1-high': 1.5,
};

export function quotePrint(input: {
  volumeCm3: number;
  scalePercent: number;
  infillPercent: number;
  density?: number | null;
  pricePerGram?: number | null;
  qualityMultiplier: number;
}) {
  const scale = input.scalePercent / 100;
  const scaledVolume = input.volumeCm3 * scale ** 3;
  const effectiveVolume = scaledVolume * (0.3 + 0.7 * (input.infillPercent / 100));
  const weight = effectiveVolume * (Number(input.density) || 1.2);
  const cost = weight * (Number(input.pricePerGram) || 4) * input.qualityMultiplier;
  return {
    volumeCm3: +scaledVolume.toFixed(2),
    weightGrams: Math.max(1, Math.round(weight)),
    cost: Math.max(5, Math.round(cost)),
  };
}
