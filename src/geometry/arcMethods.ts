import { UVS } from "../enums/geometry";
import { remapNumberArray } from "./numericHelpers";

// helper methdods to remap uvs
export const mapUVS = (uvs: UVS, min: number = 0, max: number = 1): UVS => {
  const nUVs: UVS = [];

  const us: number[] = [0];
  const vs: number[] = [0];

  uvs.forEach(([u, v]) => us.push(u) && vs.push(v));

  const mappedUs = remapNumberArray(us, min, max);
  const mappedVs = remapNumberArray(vs, min, max);

  for (let i = 1; i < mappedUs.length; i++) nUVs.push([mappedUs[i], mappedVs[i]]);

  return nUVs;
};

/**
 * Helper method for creating a uvs array describing an arc polyline
 * @param d arc divisions count
 * @param maxAngle total arc angle (default .5 * Math.PI)
 * @returns UVS
 */
export const simpleArc = (d: number, maxAngle?: number): UVS => {
  const uvs: UVS = [];

  console.log(maxAngle);

  const angleStep = (maxAngle ?? Math.PI * 0.5) / d;

  for (let i = 1; i < d + 1; i++) {
    const angle = angleStep * i;
    uvs.push([1 - Math.cos(angle), Math.sin(angle)]);
  }

  if (maxAngle !== undefined) return mapUVS(uvs, 0, 1);
  return uvs;
};

/**
 * Helper method for creating an array describing a double arc polyline
 * @param d arc divisions count
 * @returns UVS
 */
export const doubleArc = (d: number): UVS => {
  const uvs = simpleArc(d);
  return [...uvs.map(([u, v]) => [u * 0.5, v * 0.5]), ...uvs.map(([u, v]) => [0.5 + u * 0.5, 0.5 + v * 0.5])] as [number, number][];
};

/**
 * Helper method for creating a uvs array describing an arc polyline, with default setting set at 1/3 PI -> looks gothic
 * @param d arc divisions count
 * @param a arc steepness
 * @returns UVS
 */
export const gothicArc = (d: number, a: number = 1): UVS => simpleArc(d, (Math.PI * a) / 3);
