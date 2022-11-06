import { Vector3 } from "@babylonjs/core";

export const areParallel = (a: Vector3, b: Vector3): boolean => a.cross(b).length() < 0.0001 && Vector3.Dot(a, b) > 0;
export const areAntiParallel = (a: Vector3, b: Vector3): boolean => a.cross(b).length() < 0.0001 && Vector3.Dot(a, b) < 0;
export const areColinear = (a: Vector3, b: Vector3): boolean => a.cross(b).length() < 0.0001;
