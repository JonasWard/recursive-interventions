import { Vector3 } from "@babylonjs/core";
import { BaseMeshData, Polygon, VertexFaceListMesh } from "../enums/geometry";
import { polygonLazyNormal } from "./polygonHelpers";
import { quadraticFilteringMap, shiftingIndexMap } from "./vectorHelpers";

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

/**
 * Method that splits up all quads in vertexFaceListMesh into triangles.
 * @param mesh VertexFaceListMesh to split
 * @returns VertexFaceListMesh with only triangles
 */
export const vertexFaceListMeshToTris = (mesh: VertexFaceListMesh): VertexFaceListMesh => {
  const { vertices, faces } = mesh;

  const tris: [number, number, number][] = [];
  for (const f of faces) {
    if (f.length === 3) tris.push(f);
    else tris.push([f[0], f[1], f[2]], [f[0], f[2], f[3]]);
  }

  return { vertices, faces: tris };
};

/**
 * Method that constructs number arrays for the positions and indices of a mesh.
 * @param mesh VertexFaceListMesh to construct
 * @returns BaseMeshData
 */
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

/**
 * Method to join two meshes into single one
 * @param meshA
 * @param meshB
 * @returns joined mesh of both
 */
export const joinMesh = (meshA: VertexFaceListMesh, meshB: VertexFaceListMesh) => {
  const { vertices, faces } = meshB;
  const idx = meshA.vertices.length ?? 0;
  meshA.vertices.push(...vertices);
  meshA.faces.push(...(faces.map((f) => f.map((i) => i + idx)) as ([number, number, number, number] | [number, number, number])[]));

  return meshA;
};

/**
 * Method for creating a mesh from a series of polylines
 * @param vs vertices arrays (each sub array is assumed to have the same length)
 * @param closed whether the final loops back to the first
 * @returns Mesh
 */
export const loftVertexLists = (vs: Vector3[][], closed: boolean = false) => {
  const mesh: VertexFaceListMesh = { vertices: [], faces: [] };

  for (const vseries of vs) mesh.vertices.push(...vseries);
  for (let j = 0; j < vs.length - 1; j++) {
    const subI = j * vs[0].length;
    const subII = (j + 1) * vs[0].length;
    for (let i = 0; i < vs[0].length - 1; i++) {
      mesh.faces.push([subI + i + 1, subI + i, subII + i, subII + i + 1]);
    }

    if (closed) mesh.faces.push([subII - 1, subI, subII, subII + vs[0].length - 1]);
  }

  return mesh;
};

/**
 * Helper method for donwloading vertex face list as stl
 * @param mesh VertexFaceListMesh
 */
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
