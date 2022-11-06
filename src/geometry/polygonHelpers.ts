import { Vector3 } from "@babylonjs/core";
import { Polygon } from "../enums/geometry";

/**
 * Helper method to see whether polygon is isColinear.
 * @param plg Polygon to check
 * @returns true if coplanar
 */
export const polygonIsColinear = (plg: Polygon): boolean => {
  if (plg.length < 2) throw new Error("Polygon must have at least 2 vertices");
  const v = plg[0].subtract(plg[plg.length - 1]);
  let hasNonColinear = false;
  for (let i = 0; i < plg.length - 1; i++) {
    const d = plg[i + 1].subtract(plg[i]);
    hasNonColinear = d.cross(v).length() < 0.0001;
    if (hasNonColinear) break;
  }

  return !hasNonColinear;
};

const polygonIsColinearVecors = (plg: Polygon): boolean => {
  if (plg.length < 2) throw new Error("Polygon must have at least 2 vertices");
  const v = plg[0].subtract(plg[plg.length - 1]);
  let hasNonColinear = false;
  for (let i = 0; i < plg.length - 1; i++) {
    const d = plg[i + 1].subtract(plg[i]);
    hasNonColinear = d.cross(v).length() < 0.0001;
    if (hasNonColinear) break;
  }

  return !hasNonColinear;
};

// /**
//  * Helper method to see whether polygon is coplanar.
//  * @param vs Polygon to check
//  * @returns true if coplanar
//  */
// export const isCoplanar = (plg: Polygon): boolean => {
//   const isColinear = polygonIsColinear(plg);
//   if (isColinear) return false;
// };

export const polygonLazyNormal = (plg: Polygon): Vector3 =>
  plg[1]
    .subtract(plg[0])
    .cross(plg[plg.length - 1].subtract(plg[0]))
    .normalize();
