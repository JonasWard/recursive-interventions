import { Mesh, Scene, Vector3, VertexData } from "@babylonjs/core";
import { BaseMeshData, Quad, VertexFaceListMesh } from "../enums/geometry";
import { cleaningMesh, getNormal } from "./meshHelpers";
import { polygonLazyNormal } from "./polygonHelpers";
import { areColinear } from "./vectorHelpers";

// probably should put all this stuff in a section creation class
// but first come up with a similar section logic

const creatingUVS = (d: number = 8) => {
  const uvs: [number, number][] = [];

  const angleStep = (Math.PI * 0.5) / d;

  for (let i = 1; i < d + 1; i++) {
    const angle = angleStep * i;
    uvs.push([1 - Math.cos(angle), Math.sin(angle)]);
  }

  return uvs;
};

/**
 * Method for creating a simple arc which starts at basePt and goes towards the keystone, as defined by vDir+hDir
 * @param bPt
 * @param vDir
 * @param hDir
 * @param d
 * @returns arc points
 */
const creatingArcDivisions = (bPt: Vector3, vDir: Vector3, hDir: Vector3, d: number = 8): Vector3[] =>
  creatingArcUVs(bPt, vDir, hDir, creatingUVS(d));

/**
 * Method for creating a simple arc which starts at basePt and goes towards the keystone, as defined by vDir+hDir
 * @param bPt
 * @param vDir
 * @param hDir horizontal directio
 * @param uvs [number, number][] uv array
 * @returns arc points
 */
const creatingArcUVs = (bPt: Vector3, hDir: Vector3, vDir: Vector3, uvs: [number, number][]): Vector3[] =>
  creatingArcDirections(
    bPt,
    uvs.map(([u, v]) => [hDir.scale(u), vDir.scale(v)])
  );

/**
 * Method for creating a simple arc which starts at basePt and goes towards the keystone, as defined by vDir+hDir
 * @param bPt
 * @param uvDirs [Vector3, Vector3][] uv array
 * @returns arc points
 */
const creatingArcDirections = (bPt: Vector3, uvDirs: [Vector3, Vector3][]): Vector3[] => [
  bPt,
  ...uvDirs.map(([uD, vD]) => bPt.add(uD.add(vD))),
];

const centroid = (vs: Vector3[]) => vs.reduce((a, b) => a.add(b)).scale(1.0 / vs.length);

const creatArcSegment = (bPt0: Vector3, bPtA: Vector3, hDir: Vector3, vDir: Vector3, uvs: [number, number][]) => [
  bPt0.add(hDir),
  bPt0,
  ...creatingArcUVs(bPtA, hDir, vDir, uvs),
];

/**
 * Method for creating a mesh from a series of polylines
 * @param vs vertices arrays (each sub array is assumed to have the same length)
 * @param closed whether the final loops back to the first
 * @returns Mesh
 */
const loftVertexLists = (vs: Vector3[][], closed: boolean = false) => {
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

const createArcCellSegment = (
  bB: Vector3,
  bT: Vector3,
  vZ: Vector3,
  vHDir: [Vector3, Vector3, Vector3],
  t0: number,
  t1: number,
  r: number,
  uvs: [number, number][]
) => {
  const locOZB = vZ.scale(t0 / vZ.length());
  const vH0 = vHDir[0].scale(t0 / vHDir[0].length());
  const vH2 = vHDir[2].scale(t0 / vHDir[2].length());
  const vH1 = vH0.add(vH2);
  const locOZT = vZ.scale((t1 + r) / vZ.length());
  const locOZ = vZ.scale(r / vZ.length());

  bB = bB.add(locOZB);
  bT = bT.subtract(locOZT);

  const vSeries = [
    creatArcSegment(bB.add(vH0), bT.add(vH0), vHDir[0].subtract(vH0), locOZ, uvs),
    creatArcSegment(bB.add(vH1), bT.add(vH1), vHDir[1].subtract(vH1), locOZ, uvs),
    creatArcSegment(bB.add(vH2), bT.add(vH2), vHDir[2].subtract(vH2), locOZ, uvs),
  ];

  return loftVertexLists(vSeries);
};

/**
 * Method to join two meshes into single one
 * @param meshA
 * @param meshB
 * @returns joined mesh of both
 */
const joinMesh = (meshA: VertexFaceListMesh, meshB: VertexFaceListMesh) => {
  const { vertices, faces } = meshB;
  const idx = meshA.vertices.length ?? 0;
  meshA.vertices.push(...vertices);
  meshA.faces.push(...(faces.map((f) => f.map((i) => i + idx)) as ([number, number, number, number] | [number, number, number])[]));

  return meshA;
};

// Method to create center of arc cell
const createCenterArcCell = (
  pBottoms: Vector3[],
  pTops: Vector3[],
  t0: number,
  t1: number,
  r: number,
  uvs: [number, number][],
  cPBot?: Vector3,
  cPTop?: Vector3
): VertexFaceListMesh => {
  cPBot = cPBot ?? centroid(pBottoms);
  cPTop = cPTop ?? centroid(pTops);

  let mesh: VertexFaceListMesh = { vertices: [], faces: [] };

  for (let i = 0; i < pBottoms.length; i++) {
    const i0 = (i + pBottoms.length - 1) % pBottoms.length;
    const i1 = i;
    const i2 = (i + 1) % pBottoms.length;

    const vV = pTops[i1].subtract(pBottoms[i1]);

    const vHs: [Vector3, Vector3, Vector3] = [
      pBottoms[i0].subtract(pBottoms[i1]).scale(0.5),
      cPBot.subtract(pBottoms[i1]),
      pBottoms[i2].subtract(pBottoms[i1]).scale(0.5),
    ];

    const localMesh = createArcCellSegment(pBottoms[i1], pTops[i1], vV, vHs, t0, t1, r, uvs);
    mesh = joinMesh(mesh, localMesh);
  }

  return mesh;
  //   return cleaningMesh(mesh);
};
/**
 * Method to create end caps for standard arc cell
 * @param p [Vector3, Vector3, Vector3, Vector3] point 0 bottom, point 1 bottom, point 0 top, point 1 top
 * @param vZ top direction
 * @param t0 inset distance 0
 * @param t1 inset distance 1
 * @param r radius of arc
 * @param uvs uvs for arc generation
 * @returns
 */
const createCellCap = (
  p: [Vector3, Vector3, Vector3, Vector3],
  vZ: Vector3,
  t0: number,
  t1: number,
  r: number,
  uvs: [number, number][]
) => {
  let mesh: VertexFaceListMesh = { vertices: [], faces: [] };

  // creating the inner positions for the arc
  const vH = p[1].subtract(p[0]).scale(0.5);
  const vH0 = vH.scale(t0 / vH.length());
  const vHN = new Vector3(vH.y, -vH.x, vH.z).normalize().scale(t0);

  const locOZB = vZ.scale(t0 / vZ.length());
  const locOZT = vZ.scale((t1 + r) / vZ.length());
  const locOZ = vZ.scale(r / vZ.length());

  const p0Bo = p[0].add(locOZB).add(vH0);
  const p1Bo = p[1].add(locOZB).subtract(vH0);
  const p0To = p[2].subtract(locOZT).add(vH0);
  const p1To = p[3].subtract(locOZT).subtract(vH0);

  const vSeries0 = [
    creatArcSegment(p0Bo, p0To, vH.subtract(vH0), locOZ, uvs),
    creatArcSegment(p0Bo.add(vHN), p0To.add(vHN), vH.subtract(vH0), locOZ, uvs),
  ];

  const vSeries1 = [
    creatArcSegment(p1Bo.add(vHN), p1To.add(vHN), vH.subtract(vH0).scale(-1), locOZ, uvs),
    creatArcSegment(p1Bo, p1To, vH.subtract(vH0).scale(-1), locOZ, uvs),
  ];

  mesh = loftVertexLists(vSeries0);
  mesh = joinMesh(mesh, loftVertexLists(vSeries1));

  // creating the cap surfaces
  const idxCnt = mesh.vertices.length;
  mesh.vertices.push(...[p[0], p[0].add(p[1]).scale(0.5), p[1], p[2], p[2].add(p[3]).scale(0.5), p[3]].map((v) => v.add(vHN)));
  const vAs = creatArcSegment(p0Bo.add(vHN), p0To.add(vHN), vH.subtract(vH0), locOZ, uvs);
  mesh.vertices.push(...vAs);
  const vBs = creatArcSegment(p1Bo.add(vHN), p1To.add(vHN), vH.subtract(vH0).scale(-1), locOZ, uvs);
  mesh.vertices.push(...vBs);

  // main sidesA
  mesh.faces.push([idxCnt + 1, idxCnt + 0, idxCnt + 7, idxCnt + 6]);
  mesh.faces.push([idxCnt + 0, idxCnt + 3, idxCnt + 8, idxCnt + 7]);
  mesh.faces.push([idxCnt + vAs.length + 5, idxCnt + 3, idxCnt + 4]);
  // main sidesB
  mesh.faces.push([idxCnt + 2, idxCnt + 1, idxCnt + vAs.length + 6, idxCnt + vAs.length + 7]);
  mesh.faces.push([idxCnt + 5, idxCnt + 2, idxCnt + vAs.length + 7, idxCnt + vAs.length + 8]);
  mesh.faces.push([idxCnt + vAs.length + 5, idxCnt + 4, idxCnt + 5]);

  for (let i = 0; i < uvs.length; i++) {
    // top sidesA
    mesh.faces.push([idxCnt + 9 + i, idxCnt + 8 + i, idxCnt + 3]);
    // top sidesB
    mesh.faces.push([idxCnt + vAs.length + 8 + i, idxCnt + vAs.length + 9 + i, idxCnt + 5]);
  }

  return mesh;
};

const createCorner = (f0: Quad, f1: Quad, t0: number): VertexFaceListMesh => {
  const n0 = getNormal(f0).scale(t0);
  const n1 = getNormal(f1).scale(t0);

  const angle = Vector3.GetAngleBetweenVectors(n0, n1, f0[3].subtract(f0[1]));
  const mVec = n0
    .add(n1)
    .normalize()
    .scale(t0 / Math.cos(angle * 0.5));

  return loftVertexLists([
    [f0[3].add(n0), f0[1].add(n0)],
    [f0[3].add(mVec), f0[1].add(mVec)],
    [f1[2].add(n1), f1[0].add(n1)],
  ]);
};

/**
 * Helper method for creating pairwise array
 * @param vs number array
 * @param closed boolean
 * @returns [number, number] array
 */
const pairWiseIteration = (vs: number[], closed = false): [number, number][] => {
  const ns: [number, number][] = [];
  for (let i = 0; i < vs.length - 1; i++) ns.push([vs[i], vs[i + 1]]);
  if (closed) ns.push([vs[vs.length - 1], vs[0]]);
  return ns;
};

/**
 * Helper to create list of numbers
 * @param start first value of array
 * @param step step size
 * @param cnt amount of items
 * @returns number array
 */
const createNumberList = (start: number, step: number, cnt: number): number[] => {
  const ns: number[] = [];
  for (let i = 0; i < cnt; i++) ns.push(start + i * step);
  return ns;
};

export const constructVoxelVariableHeights = (
  xs: number[],
  ys: number[],
  zs: number[],
  t0 = 1,
  t1 = 1,
  dCnt: number = 8,
  r: number
): VertexFaceListMesh => {
  let mesh: VertexFaceListMesh = { vertices: [], faces: [] };

  const uvs = creatingUVS(dCnt);
  const xLast = xs[xs.length - 1];
  const yLast = ys[ys.length - 1];

  for (const [x0, x1] of pairWiseIteration(xs)) {
    for (const [y0, y1] of pairWiseIteration(ys)) {
      for (const [z0, z1] of pairWiseIteration(zs)) {
        const xM = (x0 + x1) * 0.5;
        const yM = (y0 + y1) * 0.5;

        const bottomPts = [new Vector3(x0, y0, z0), new Vector3(x1, y0, z0), new Vector3(x1, y1, z0), new Vector3(x0, y1, z0)];
        const topPts = [new Vector3(x0, y0, z1), new Vector3(x1, y0, z1), new Vector3(x1, y1, z1), new Vector3(x0, y1, z1)];

        const bottomCPt = new Vector3(xM, yM, z0);
        const topCPt = new Vector3(xM, yM, z1);

        const localMesh = createCenterArcCell(bottomPts, topPts, t0, t1, r, uvs, bottomCPt, topCPt);

        mesh = joinMesh(mesh, localMesh);
      }
    }
  }

  const sideFaces: Quad[] = [];

  for (const [x0, x1] of pairWiseIteration(xs)) {
    for (const [z0, z1] of pairWiseIteration(zs)) {
      sideFaces.push([new Vector3(x0, ys[0], z0), new Vector3(x1, ys[0], z0), new Vector3(x0, ys[0], z1), new Vector3(x1, ys[0], z1)]);
      sideFaces.push([new Vector3(x1, yLast, z0), new Vector3(x0, yLast, z0), new Vector3(x1, yLast, z1), new Vector3(x0, yLast, z1)]);
    }
  }

  for (const [y0, y1] of pairWiseIteration(ys)) {
    for (const [z0, z1] of pairWiseIteration(zs)) {
      sideFaces.push([new Vector3(xs[0], y1, z0), new Vector3(xs[0], y0, z0), new Vector3(xs[0], y1, z1), new Vector3(xs[0], y0, z1)]);
      sideFaces.push([new Vector3(xLast, y0, z0), new Vector3(xLast, y1, z0), new Vector3(xLast, y0, z1), new Vector3(xLast, y1, z1)]);
    }
  }

  for (const f of sideFaces) mesh = joinMesh(mesh, createCellCap(f, f[2].subtract(f[0]), t0, t1, r, uvs));

  // return mesh;
  return cleaningMesh(mesh);
};

export const constructVariableFootprint = (
  xys: [number, number][],
  zs: number[],
  t0 = 1,
  t1 = 1,
  dCnt: number = 8,
  r: number
): VertexFaceListMesh => {
  let mesh: VertexFaceListMesh = { vertices: [], faces: [] };

  const uvs = creatingUVS(dCnt);
  const sideFaces: Quad[] = [];
  const corners: [Quad, Quad][] = [];

  for (const [z0, z1] of pairWiseIteration(zs)) {
    const bottomPts: Vector3[] = [];
    const topPts: Vector3[] = [];

    const localFaceArray: Quad[] = [];

    for (let i = 0; i < xys.length; i++) {
      const [x0, y0] = xys[i];
      const [x1, y1] = xys[(i + 1) % xys.length];

      bottomPts.push(new Vector3(x0, y0, z0));
      topPts.push(new Vector3(x0, y0, z1));

      localFaceArray.push([new Vector3(x0, y0, z0), new Vector3(x1, y1, z0), new Vector3(x0, y0, z1), new Vector3(x1, y1, z1)]);
    }

    for (let i = 0; i < localFaceArray.length; i++) {
      const f0 = localFaceArray[i];
      const f1 = localFaceArray[(i + 1) % localFaceArray.length];

      if (!areColinear(polygonLazyNormal(f0), polygonLazyNormal(f1))) corners.push([f0, f1]);
    }

    sideFaces.push(...localFaceArray);

    const localMesh = createCenterArcCell(bottomPts, topPts, t0, t1, r, uvs);
    mesh = joinMesh(mesh, localMesh);
  }

  for (const [f0, f1] of corners) mesh = joinMesh(mesh, createCorner(f0, f1, t0));
  for (const f of sideFaces) mesh = joinMesh(mesh, createCellCap(f, f[2].subtract(f[0]), t0, t1, r, uvs));

  // return mesh;
  return cleaningMesh(mesh);
};

export const constructVoxelQuadrata = (
  xC: number,
  yC: number,
  zC: number,
  h: number,
  w: number,
  t0 = 1,
  t1 = 1,
  dCnt: number = 8,
  r?: number
) => {
  r = r ?? w * 0.5 - t0;

  const xs = createNumberList(-w * 0.5 * xC, w, xC);
  const ys = createNumberList(-w * 0.5 * yC, w, yC);
  const zs = createNumberList(-h * 0.5 * zC, h, zC);

  const mesh = constructVoxelVariableHeights(xs, ys, zs, t0, t1, dCnt, r);

  // return mesh;
  return cleaningMesh(mesh);
};

export const quadratoAsVertexData = (): BaseMeshData => {
  // const quadMesh = constructVoxelQuadrata(5, 5, 5, 12, 10, 2, 2, 12);
  const quadMesh = constructVariableFootprint(
    [
      [0, 0],
      [10, 0],
      [20, 0],
      [20, 10],
      [20, 20],
      [10, 20],
      [5, 10],
    ],
    [0, 12, 40, 48, 60, 68, 90, 98, 120, 128, 135],
    2,
    2,
    12,
    10 * 0.5 - 2
  );

  const { vertices, faces } = quadMesh;

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

export const addMeshToScene = (scene: Scene) => {
  const quadMesh = constructVoxelQuadrata(2, 2, 2, 12, 10, 2, 2, 12);
  const customMesh = new Mesh("custom", scene);
  const { vertices, faces } = quadMesh;

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

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;

  vertexData.applyToMesh(customMesh);

  return customMesh;
};
