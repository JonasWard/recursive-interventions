import { Vector3 } from '@babylonjs/core'

export type VertexFaceListMesh = {
    vertices: Vector3[],
    faces: ([number, number, number] | [number, number, number, number])[]
}

export type BaseMeshData = {
    positions: number[],
    indices: number[],
}