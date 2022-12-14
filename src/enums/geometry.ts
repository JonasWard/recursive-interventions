import { Vector3 } from "@babylonjs/core";

export type VertexFaceListMesh = {
  vertices: Vector3[];
  faces: ([number, number, number] | [number, number, number, number])[];
};

export type BaseMeshData = {
  positions: number[];
  indices: number[];
};

export type Polygon = Vector3[];
export type Quad = [Vector3, Vector3, Vector3, Vector3];
export type Tri = [Vector3, Vector3, Vector3];
export type UVS = [number, number][];
