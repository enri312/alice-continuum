export type NeuralPoint = { x: number; y: number; z: number };

export function neuralSeed(id: string, salt = 0): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967295;
}

// Presentation geometry only. These folds and hemispheres are a visual frame;
// they are never records, synapses, anatomical measurements or inferred facts.
export function cortexPoint(side: number, latitude: number, longitude: number): NeuralPoint {
  const radial = Math.cos(latitude);
  const fold = 1 + .035 * Math.sin(6 * longitude + 3 * latitude) + .018 * Math.sin(11 * latitude + 2 * longitude);
  return {
    x: side * (.035 + .74 * radial * (.5 + .5 * Math.cos(longitude)) * fold),
    y: .71 * Math.sin(latitude) * fold,
    z: .51 * radial * Math.sin(longitude) * fold,
  };
}

export function neuralMemoryPosition(id: string): NeuralPoint {
  const side = neuralSeed(id, 11) < .5 ? -1 : 1;
  const latitude = Math.asin(neuralSeed(id, 37) * 1.8 - .9);
  const surface = cortexPoint(side, latitude, neuralSeed(id, 71) * Math.PI * 2);
  const depth = .48 + .45 * neuralSeed(id, 103);
  const center = side * (.035 + .37 * Math.cos(latitude));
  return { x: center + (surface.x - center) * depth, y:surface.y * depth, z:surface.z * depth };
}

export const cortexPaths: readonly NeuralPoint[][] = [-1, 1].flatMap(side => [
  ...Array.from({length:14}, (_, ring) => Array.from({length:81}, (_, step) => {
    const longitude = step * Math.PI / 40;
    const latitude = -.5 * Math.PI + (ring + 1) * Math.PI / 15;
    return cortexPoint(side, latitude + Math.cos(latitude) * (.055 * Math.sin(longitude * 5 + ring) + .028 * Math.cos(longitude * 9 - ring)), longitude);
  })),
  ...Array.from({length:7}, (_, meridian) => Array.from({length:61}, (_, step) => {
    const latitude = -.5 * Math.PI + step * Math.PI / 60;
    return cortexPoint(side, latitude, meridian * Math.PI / 3.5 + .08 * Math.sin(latitude * 7 + meridian));
  })),
]);
