import { Vector3 } from "@babylonjs/core";
import { BaseMeshData, Polygon, VertexFaceListMesh } from "../enums/geometry";
import { polygonLazyNormal } from "./polygonHelpers";

type HashedPositions = { [id: string]: number[] };

// bounding box calculation
const boundingBox = (vs: Vector3[]) => {
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
      values.length
    ),
  };
};

const values = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.";

const ptHashN = (v: Vector3, d: Vector3) => `${values[Math.ceil(v.x * d.x)]}${values[Math.ceil(v.y * d.y)]}${values[Math.ceil(v.z * d.z)]}`;
const ptHash = (v: Vector3, b: Vector3, d: Vector3) => ptHashN(v.subtract(b), d);

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

const quadraticFilteringMap = (vs: Vector3[]) => {
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

const shiftingIndexMap = (indexMap: number[]) => {
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
 * Method that tries to reduce the number of vertices in a mesh by removing duplicates.
 * @param mesh VertexFaceListMesh to clean
 * @returns cleaned VertexFaceListMesh
 */
export const cleaningMesh = (mesh: VertexFaceListMesh): VertexFaceListMesh => {
  const { vertices, faces } = mesh;

  const indexMap = quadraticFilteringMap(vertices);
  const cleanedVertices = vertices.filter((v, i) => indexMap[i] === i);
  const sIM = shiftingIndexMap(indexMap);

  const cleanedFaces = faces.map((f) => f.map((i) => sIM[i]) as [number, number, number] | [number, number, number, number]);

  console.log(`reduced vertex count from ${vertices.length} to ${cleanedVertices.length}`);

  const newMesh = { vertices: cleanedVertices, faces: cleanedFaces };

  return newMesh;
};

/**
 * Lazy method that tries to get normal for polygon face.
 * @param polygon Polygon polygon
 * @returns normal Vector3
 */
export const getNormal = (polygon: Polygon): Vector3 => {
  const [a, b, c] = polygon;
  const v1 = b.subtract(a);
  const v2 = c.subtract(a);
  return Vector3.Cross(v1, v2).normalize();
};

export const vertexFaceListMeshToTris = (mesh: VertexFaceListMesh): VertexFaceListMesh => {
  const { vertices, faces } = mesh;

  const tris: [number, number, number][] = [];
  for (const f of faces) {
    if (f.length === 3) tris.push(f);
    else tris.push([f[0], f[1], f[2]], [f[0], f[2], f[3]]);
  }

  return { vertices, faces: tris };
};

export const vertexFaceListMeshToBaseMeshData = (mesh: VertexFaceListMesh): BaseMeshData => {
  const { vertices, faces } = mesh;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < vertices.length; i++) {
    const { x, y, z } = vertices[i];
    positions.push(x, y, z);
  }

  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    if (f.length === 3) indices.push(f[0], f[1], f[2]);
    else if (f.length === 4) indices.push(f[0], f[1], f[2], f[0], f[2], f[3]);
  }

  return { positions, indices };
};

export const createSTL = (mesh: VertexFaceListMesh) => {
  // get an index and face list fron the object, geometry is just fine, all faces are triangles
  const { faces, vertices } = vertexFaceListMeshToTris(mesh);

  const vertexStrings: string[] = [];

  faces.forEach((f) => {
    if (f.length === 3) {
      const vs = [vertices[f[0]], vertices[f[1]], vertices[f[2]]];
      const normal = polygonLazyNormal(vs);

      vertexStrings.push(
        `facet normal ${normal.x} ${normal.y} ${normal.z}
outer loop
vertex ${vs[0].x} ${vs[0].y} ${vs[0].z}
vertex ${vs[1].x} ${vs[1].y} ${vs[1].z}
vertex ${vs[2].x} ${vs[2].y} ${vs[2].z}
endloop
endfacet`
      );
    } else if (f.length === 4) {
      const vs = [vertices[f[0]], vertices[f[1]], vertices[f[2]], vertices[f[3]]];
      const normal = polygonLazyNormal(vs);

      vertexStrings.push(
        `facet normal ${normal.x} ${normal.y} ${normal.z}
outer loop
vertex ${vs[0].x} ${vs[0].y} ${vs[0].z}
vertex ${vs[1].x} ${vs[1].y} ${vs[1].z}
vertex ${vs[2].x} ${vs[2].y} ${vs[2].z}
vertex ${vs[3].x} ${vs[3].y} ${vs[3].z}
endloop
endfacet`
      );
    }
  });

  const element = document.createElement("a");

  const stlContent = `solid Exported by JonasWard with babsrects
${vertexStrings.join("\n")}
endsolid Exported by JonasWard with babsrects`;

  const file = new Blob([stlContent], {
    type: "text/plain",
  });
  element.href = URL.createObjectURL(file);
  element.download = "babsrect.stl";
  document.body.appendChild(element);
  element.click();
};
