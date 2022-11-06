import { Mesh, Scene, Vector3, VertexData } from '@babylonjs/core';
import { BaseMeshData, VertexFaceListMesh } from '../enums/geometry';

type HashedPositions = { [id: string]: number[] };

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
    d: new Vector3(1.0 / (xMax - xMin + 2 * dTolerance), 1.0 / (yMax - yMin + 2 * dTolerance), 1.0 / (zMax - zMin + 2 * dTolerance)).scale(values.length),
  };
};

const values = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.';

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
  const shiftMap: {[i: number]: number} = {}
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

const cleaningMesh = (mesh: VertexFaceListMesh): VertexFaceListMesh => {
  const { vertices, faces } = mesh;

  const indexMap = quadraticFilteringMap(vertices);
  const cleanedVertices = vertices.filter((v, i) => indexMap[i] === i);
  const sIM = shiftingIndexMap(indexMap); 

  const cleanedFaces = faces.map((f) => f.map((i) => sIM[i]) as [number, number, number] | [number, number, number, number]);

  console.log(`reduced vertex count from ${vertices.length} to ${cleanedVertices.length}`);

  const newMesh = { vertices: cleanedVertices, faces: cleanedFaces };

  return newMesh;
};

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

const loftVertexLists = (vs: Vector3[][], closed: boolean = false) => {
  const mesh: VertexFaceListMesh = { vertices: [], faces: [] };

  for (const vseries of vs) mesh.vertices.push(...vseries);
  for (let j = 0; j < vs.length - 1; j++) {
    const subI = j * vs[0].length;
    const subII = (j + 1) * vs[0].length;
    for (let i = 0; i < vs[0].length - 1; i++) {
      mesh.faces.push([subI + i + 1, subI + i, subII + i, subII + i + 1]);
    }
  };

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

const addMesh = (mesh: VertexFaceListMesh, localMesh: VertexFaceListMesh) => {
  const { vertices, faces } = localMesh;
  const idx = mesh.vertices.length ?? 0;
  mesh.vertices.push(...vertices);
  mesh.faces.push(...(faces.map((f) => f.map((i) => i + idx)) as ([number, number, number, number] | [number, number, number])[]));

  return mesh;
};

// Method to create center of arc cell
const createCenterArcCell = (
  cornerPointsBottom: Vector3[],
  cornertPointsTop: Vector3[],
  t0: number,
  t1: number,
  r: number,
  uvs: [number, number][],
  cPBot?: Vector3,
  cPTop?: Vector3
): VertexFaceListMesh => {
  cPBot = cPBot ?? centroid(cornerPointsBottom);
  cPTop = cPTop ?? centroid(cornertPointsTop);

  let mesh: VertexFaceListMesh = { vertices: [], faces: [] };

  for (let i = 0; i < cornerPointsBottom.length; i++) {
    const i0 = (i + cornerPointsBottom.length - 1) % cornerPointsBottom.length;
    const i1 = i;
    const i2 = (i + 1) % cornerPointsBottom.length;

    const vV = cornertPointsTop[i1].subtract(cornerPointsBottom[i1]);

    const vHs: [Vector3, Vector3, Vector3] = [
      cornerPointsBottom[i0].subtract(cornerPointsBottom[i1]).scale(0.5),
      cPBot.subtract(cornerPointsBottom[i1]),
      cornerPointsBottom[i2].subtract(cornerPointsBottom[i1]).scale(0.5),
    ];

    const localMesh = createArcCellSegment(cornerPointsBottom[i1], cornertPointsTop[i1], vV, vHs, t0, t1, r, uvs);
    mesh = addMesh(mesh, localMesh);
  }

  return mesh;
  //   return cleaningMesh(mesh);
};
/**
 * Method to create end caps for standard arc cell
 * @param p0B point 0 bottom
 * @param p1B point 1 bottom
 * @param p0T point 0 top
 * @param p1T point 1 top
 * @param vZ top direction
 * @param t0 inset distance 0
 * @param t1 inset distance 1
 * @param r radius of arc
 * @param uvs uvs for arc generation
 * @returns 
 */
const createCellCap = (p0B: Vector3, p1B: Vector3, p0T: Vector3, p1T: Vector3, vZ: Vector3, t0: number, t1: number, r: number, uvs: [number, number][]) => {
  let mesh: VertexFaceListMesh = { vertices: [], faces: [] };

  // creating the inner positions for the arc
  const vH = p1B.subtract(p0B).scale(0.5);
  const vH0 = vH.scale(t0 / vH.length());
  const vHN = new Vector3(vH.y, -vH.x, vH.z).normalize().scale(t0);

  const locOZB = vZ.scale(t0 / vZ.length());
  const locOZT = vZ.scale((t1 + r) / vZ.length());
  const locOZ = vZ.scale(r / vZ.length());

  const p0Bo = p0B.add(locOZB).add(vH0);
  const p1Bo = p1B.add(locOZB).subtract(vH0);
  const p0To = p0T.subtract(locOZT).add(vH0);
  const p1To = p1T.subtract(locOZT).subtract(vH0);

  const vSeries0 = [
    creatArcSegment(p0Bo, p0To, vH.subtract(vH0), locOZ, uvs),
    creatArcSegment(p0Bo.add(vHN), p0To.add(vHN), vH.subtract(vH0), locOZ, uvs),
  ];

  const vSeries1 = [
    creatArcSegment(p1Bo.add(vHN), p1To.add(vHN), vH.subtract(vH0).scale(-1.), locOZ, uvs),
    creatArcSegment(p1Bo, p1To, vH.subtract(vH0).scale(-1.), locOZ, uvs),
  ];

  mesh = loftVertexLists(vSeries0);
  mesh = addMesh(mesh, loftVertexLists(vSeries1));

  // creating the cap surfaces
  const idxCnt = mesh.vertices.length;
  mesh.vertices.push(...[p0B, p0B.add(p1B).scale(.5), p1B, p0T, p0T.add(p1T).scale(.5), p1T].map(v => v.add(vHN)));
  const vAs = creatArcSegment(p0Bo.add(vHN), p0To.add(vHN), vH.subtract(vH0), locOZ, uvs);
  mesh.vertices.push(...vAs);
  const vBs = creatArcSegment(p1Bo.add(vHN), p1To.add(vHN), vH.subtract(vH0).scale(-1.), locOZ, uvs);
  mesh.vertices.push(...vBs);

  // main sidesA
  mesh.faces.push([idxCnt + 1, idxCnt + 0, idxCnt + 7, idxCnt + 6]);
  mesh.faces.push([idxCnt + 0, idxCnt + 3, idxCnt + 8, idxCnt + 7]);
  mesh.faces.push([idxCnt + vAs.length + 5, idxCnt + 3, idxCnt + 4])
  // main sidesB
  mesh.faces.push([idxCnt + 2, idxCnt + 1, idxCnt + vAs.length + 6, idxCnt + vAs.length + 7]);
  mesh.faces.push([idxCnt + 5, idxCnt + 2, idxCnt + vAs.length + 7, idxCnt + vAs.length + 8]);
  mesh.faces.push([idxCnt + vAs.length + 5, idxCnt + 4, idxCnt + 5])

  for (let i = 0; i < uvs.length; i++) {
    // top sidesA
    mesh.faces.push([idxCnt + 9 + i, idxCnt + 8 + i , idxCnt + 3]);
    // top sidesB
    mesh.faces.push([idxCnt + vAs.length + 8 + i, idxCnt + vAs.length + 9 + i , idxCnt + 5]);
  }

  return mesh;
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
  let mesh: VertexFaceListMesh = { vertices: [], faces: [] };
  r = r ?? w * 0.5 - t0;

  const uvs = creatingUVS(dCnt);

  for (let i = 0; i < xC; i++) {
    const x0 = w * i;
    const x1 = w * (i + 1);
    for (let j = 0; j < yC; j++) {
      const y0 = w * j;
      const y1 = w * (j + 1);
      for (let k = 0; k < zC; k++) {
        const z0 = h * k;
        const z1 = h * (k + 1);

        const xM = (x0 + x1) * 0.5;
        const yM = (y0 + y1) * 0.5;

        const bottomPts = [new Vector3(x0, y0, z0), new Vector3(x1, y0, z0), new Vector3(x1, y1, z0), new Vector3(x0, y1, z0)];
        const topPts = [new Vector3(x0, y0, z1), new Vector3(x1, y0, z1), new Vector3(x1, y1, z1), new Vector3(x0, y1, z1)];

        const bottomCPt = new Vector3(xM, yM, z0);
        const topCPt = new Vector3(xM, yM, z1);

        const localMesh = createCenterArcCell(bottomPts, topPts, t0, t1, r, uvs, bottomCPt, topCPt);

        mesh = addMesh(mesh, localMesh);
      }
    }
  }

  for (let i = 0; i < xC; i++) {
    const x0 = w * i;
    const x1 = w * (i + 1);
    for (let k = 0; k < zC; k++) {
      const z0 = h * k;
      const z1 = h * (k + 1);

      const p00 = new Vector3(x0, 0., z0);
      const p01 = new Vector3(x1, 0., z0);
      const p10 = new Vector3(x0, 0., z1);
      const p11 = new Vector3(x1, 0., z1);

      const localMesh = createCellCap(p00, p01, p10, p11, new Vector3(0, 0, h), t0, t1, r, uvs);
      mesh = addMesh(mesh, localMesh);
    }
  }

  for (let i = 0; i < xC; i++) {
    const x1 = w * i;
    const x0 = w * (i + 1);
    for (let k = 0; k < zC; k++) {
      const z0 = h * k;
      const z1 = h * (k + 1);

      const p00 = new Vector3(x0, yC * w, z0);
      const p01 = new Vector3(x1, yC * w, z0);
      const p10 = new Vector3(x0, yC * w, z1);
      const p11 = new Vector3(x1, yC * w, z1);

      const localMesh = createCellCap(p00, p01, p10, p11, new Vector3(0, 0, h), t0, t1, r, uvs);
      mesh = addMesh(mesh, localMesh);
    }
  }

  for (let j = 0; j < yC; j++) {
    const y0 = w * j;
    const y1 = w * (j + 1);
    for (let k = 0; k < zC; k++) {
      const z0 = h * k;
      const z1 = h * (k + 1);

      const p01 = new Vector3(0., y0, z0);
      const p00 = new Vector3(0., y1, z0);
      const p11 = new Vector3(0., y0, z1);
      const p10 = new Vector3(0., y1, z1);

      const localMesh = createCellCap(p00, p01, p10, p11, new Vector3(0, 0, h), t0, t1, r, uvs);
      mesh = addMesh(mesh, localMesh);
    }
  }

  for (let j = 0; j < xC; j++) {
    const y1 = w * j;
    const y0 = w * (j + 1);
    for (let k = 0; k < zC; k++) {
      const z0 = h * k;
      const z1 = h * (k + 1);

      const p01 = new Vector3(xC * w, y0, z0);
      const p00 = new Vector3(xC * w, y1, z0);
      const p11 = new Vector3(xC * w, y0, z1);
      const p10 = new Vector3(xC * w, y1, z1);

      const localMesh = createCellCap(p00, p01, p10, p11, new Vector3(0, 0, h), t0, t1, r, uvs);
      mesh = addMesh(mesh, localMesh);
    }
  }

  // return mesh;
  return cleaningMesh(mesh);
};

export const quadratoAsVertexData = (): BaseMeshData => {
  const quadMesh = constructVoxelQuadrata(5, 5, 5, 12, 10, 2, 2, 12);
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

  return {positions, indices};
}

export const addMeshToScene = (scene: Scene) => {
  const quadMesh = constructVoxelQuadrata(2, 2, 2, 12, 10, 2, 2, 12);
  const customMesh = new Mesh('custom', scene);
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
