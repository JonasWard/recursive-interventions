import { Vector3 } from "@babylonjs/core";

export const areParallel = (a: Vector3, b: Vector3): boolean => a.cross(b).length() < 0.0001 && Vector3.Dot(a, b) > 0;
export const areAntiParallel = (a: Vector3, b: Vector3): boolean => a.cross(b).length() < 0.0001 && Vector3.Dot(a, b) < 0;
export const areColinear = (a: Vector3, b: Vector3): boolean => a.cross(b).length() < 0.0001;

type HashedPositions = { [id: string]: number[] };

const VALUES = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.";

const ptHashN = (v: Vector3, d: Vector3) => `${VALUES[Math.ceil(v.x * d.x)]}${VALUES[Math.ceil(v.y * d.y)]}${VALUES[Math.ceil(v.z * d.z)]}`;
const ptHash = (v: Vector3, b: Vector3, d: Vector3) => ptHashN(v.subtract(b), d);

/**
 * Method for returning a hash map of a vertex array
 * @param vs Vectro3 array to hash
 * @returns always subdivided into 64x64x64 boxes
 */
const ptHashes = (vs: Vector3[]) => {
  const { b, d } = boundingBox(vs);
  const hsMap: HashedPositions = {};
  for (let i = 0; i < vs.length; i++) {
    const h = ptHash(vs[i], b, d);
    if (h in hsMap) hsMap[h].push(i);
    else hsMap[h] = [i];
  }

  return hsMap;
};

/**
 * Method for array of Vector3 for duplicates
 * @param vs Vector3 array
 * @returns index map array
 */
export const quadraticFilteringMap = (vs: Vector3[]) => {
  const hsMap = ptHashes(vs);

  const indexMap = vs.map((v, i) => i);

  for (const indexes of Object.values(hsMap)) {
    const checkedIndexes: number[] = [];
    for (const i of indexes) {
      const v = vs[i];
      const vMap = checkedIndexes.find((i0) => Vector3.Distance(vs[i0], v) < 0.0001);
      if (vMap) indexMap[i] = vMap;
      else checkedIndexes.push(i);
    }
  }

  return indexMap;
};

/**
 * Method for constructing shifting index map
 * @param indexMap number array
 * @returns array mapper
 */
export const shiftingIndexMap = (indexMap: number[]) => {
  let shift = 0;
  const shiftMap: { [i: number]: number } = {};
  return indexMap.map((idx, i) => {
    shiftMap[i] = idx - shift;
    if (idx !== i) {
      shift++;
      return shiftMap[idx];
    } else {
      return shiftMap[i];
    }
  });
};

/**
 * Method to get bounding box of a list of vectors.
 * @param vs vector array
 * @returns
 */
export const boundingBox = (vs: Vector3[]) => {
  const tolerance = 0.0001;
  const dTolerance = tolerance * 2;

  let xMin: number = Infinity;
  let xMax: number = -Infinity;
  let yMin: number = Infinity;
  let yMax: number = -Infinity;
  let zMin: number = Infinity;
  let zMax: number = -Infinity;

  for (const v of vs) {
    xMin = Math.min(xMin, v.x);
    xMax = Math.max(xMax, v.x);
    yMin = Math.min(yMin, v.y);
    yMax = Math.max(yMax, v.y);
    zMin = Math.min(zMin, v.z);
    zMax = Math.max(zMax, v.z);
  }

  return {
    x: [xMin, xMax],
    y: [yMin, yMax],
    z: [zMin, zMax],
    b: new Vector3(xMin - tolerance, yMin - tolerance, zMin - tolerance),
    d: new Vector3(1.0 / (xMax - xMin + 2 * dTolerance), 1.0 / (yMax - yMin + 2 * dTolerance), 1.0 / (zMax - zMin + 2 * dTolerance)).scale(
      VALUES.length
    ),
  };
};
