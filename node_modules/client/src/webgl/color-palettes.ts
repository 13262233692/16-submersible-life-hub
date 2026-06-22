import * as THREE from 'three';

export const COLOR_PALETTES = {
  o2: {
    name: 'O₂ 浓度热力图',
    domain: [0.16, 0.195, 0.2095, 0.235, 0.30],
    colors: [
      new THREE.Color('#7f1d1d'),
      new THREE.Color('#f59e0b'),
      new THREE.Color('#10b981'),
      new THREE.Color('#3b82f6'),
      new THREE.Color('#818cf8'),
    ],
    unit: 'Vol%',
    multiplier: 100,
  },
  co2: {
    name: 'CO₂ 浓度热力图',
    domain: [0.0004, 0.001, 0.003, 0.008, 0.02],
    colors: [
      new THREE.Color('#06b6d4'),
      new THREE.Color('#84cc16'),
      new THREE.Color('#eab308'),
      new THREE.Color('#f97316'),
      new THREE.Color('#dc2626'),
    ],
    unit: 'PPM',
    multiplier: 1000000,
  },
  flow: {
    name: '流速场伪彩图',
    domain: [0, 0.001, 0.004, 0.01, 0.02],
    colors: [
      new THREE.Color('#0c1220'),
      new THREE.Color('#1e40af'),
      new THREE.Color('#06f0ff'),
      new THREE.Color('#a855f7'),
      new THREE.Color('#ff2d95'),
    ],
    unit: 'm/s',
    multiplier: 1,
  },
  combined: {
    name: 'O₂ / CO₂ 融合视图',
    domain: [0, 0.25, 0.5, 0.75, 1.0],
    colors: [
      new THREE.Color('#0ea5e9'),
      new THREE.Color('#059669'),
      new THREE.Color('#eab308'),
      new THREE.Color('#f97316'),
      new THREE.Color('#ef4444'),
    ],
    unit: '指数',
    multiplier: 1,
  },
} as const;

export type PaletteKey = keyof typeof COLOR_PALETTES;

export function buildColorLut(palette: PaletteKey, size: number = 1024): {
  lut: Float32Array;
  palette: typeof COLOR_PALETTES[PaletteKey];
} {
  const def = COLOR_PALETTES[palette];
  const lut = new Float32Array(size * 4);
  const n = def.domain.length - 1;

  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    let seg = 0;
    let localT = 0;

    for (let j = 0; j < n; j++) {
      if (t <= def.domain[j + 1] || j === n - 1) {
        const range = def.domain[j + 1] - def.domain[j];
        localT = range > 0 ? (t - def.domain[j]) / range : 0;
        localT = Math.max(0, Math.min(1, localT));
        seg = j;
        break;
      }
    }

    const c0 = def.colors[seg];
    const c1 = def.colors[Math.min(seg + 1, n)];
    const r = c0.r + (c1.r - c0.r) * localT;
    const g = c0.g + (c1.g - c0.g) * localT;
    const b = c0.b + (c1.b - c0.b) * localT;
    const idx = i * 4;
    lut[idx] = r;
    lut[idx + 1] = g;
    lut[idx + 2] = b;
    lut[idx + 3] = 1.0;
  }

  return { lut, palette: def };
}
