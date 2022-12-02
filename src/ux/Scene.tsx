import React, { useEffect, useRef, useState } from "react";
import { Engine, Scene, useBeforeRender, useClick, useHover, useScene } from "react-babylonjs";
import * as BABYLON from "@babylonjs/core";
import { constructVoxelQuadrata } from "../geometry/quadrato";
import { createSTL, vertexFaceListMeshToBaseMeshData } from "../geometry/meshHelpers";
import { VertexFaceListMesh } from "../enums/geometry";

const DefaultScale = new BABYLON.Vector3(1, 1, 1);
const BiggerScale = new BABYLON.Vector3(1.25, 1.25, 1.25);

interface ISpinningBoxProps {
  name: string;
  position: BABYLON.Vector3;
  hoveredColor: BABYLON.Color3;
  color: BABYLON.Color3;
}

const SpinningBox: React.FC<ISpinningBoxProps> = (props) => {
  // access Babylon scene objects with same React hook as regular DOM elements
  const boxRef = useRef<BABYLON.Mesh | null>(null);
  // const [quadrato, setQuadrato] = useState<Mesh | null>(null);

  const [clicked, setClicked] = useState(false);
  useClick(() => setClicked((clicked) => !clicked), boxRef);

  const [hovered, setHovered] = useState(false);
  useHover(
    () => setHovered(true),
    () => setHovered(false),
    boxRef
  );

  // This will rotate the box on every Babylon frame.
  const rpm = 5;
  useBeforeRender((scene) => {
    if (boxRef.current) {
      // Delta time smoothes the animation.
      const deltaTimeInMillis = scene.getEngine().getDeltaTime();
      boxRef.current.rotation.y += (rpm / 60) * Math.PI * 2 * (deltaTimeInMillis / 1000);
    }
  });

  return (
    <mesh name={props.name} ref={boxRef} position={props.position} scaling={clicked ? BiggerScale : DefaultScale}>
      <standardMaterial
        name={`${props.name}-mat`}
        diffuseColor={hovered ? props.hoveredColor : props.color}
        specularColor={BABYLON.Color3.Black()}
      />
    </mesh>
  );
};

interface ICustomMeshProps {
  name: string;
  useWireframe: boolean;
  position: BABYLON.Vector3;
  setMesh: (mesh: VertexFaceListMesh) => void;
}

const CustomMesh: React.FC<ICustomMeshProps> = (props) => {
  const scene = useScene();
  const [mesh] = useState<VertexFaceListMesh>(constructVoxelQuadrata(5, 5, 10, 20, 20, 2, 2, 8, undefined, false));
  const [customMesh] = useState(() => {
    const meshInstance = new BABYLON.Mesh(props.name, scene);

    //Set arrays for positions and indices
    const { positions, indices } = vertexFaceListMeshToBaseMeshData(mesh);

    //Empty array to contain calculated values
    const normals: number[] = [];

    var vertexData = new BABYLON.VertexData();
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);

    //Assign positions, indices and normals to vertexData
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    // vertexData.colors = colors;

    //Apply vertexData to custom mesh
    vertexData.applyToMesh(meshInstance);

    return meshInstance;
  });

  useEffect(() => {
    props.setMesh(mesh);
  }, [mesh]);

  return (
    <>
      <mesh name={props.name} fromInstance={customMesh} disposeInstanceOnUnmount position={props.position}>
        <standardMaterial name={`${props.name}-mat`} />
      </mesh>
    </>
  );
};

export const SceneWithSpinningBoxes = () => {
  const scene = useScene();
  const [mesh, setMesh] = useState<VertexFaceListMesh>({} as VertexFaceListMesh);
  const [dLayer, setDLayer] = useState<boolean>(false);

  return (
    <div>
      <button onClick={() => createSTL(mesh)} style={{ position: "absolute" }}>
        download stl
      </button>
      <Engine antialias adaptToDeviceRatio={true} canvasId="babylonJS" width={"100%"} height={"100%"}>
        <Scene >
          <arcRotateCamera name="camera1" target={BABYLON.Vector3.Zero()} alpha={Math.PI / 2} beta={Math.PI / 4} radius={8} />
          <hemisphericLight name="light1" intensity={0.7} direction={BABYLON.Vector3.Up()} />
          <CustomMesh name="left" position={new BABYLON.Vector3(-2, 0, 0)} useWireframe={false} setMesh={setMesh} />
        </Scene>
      </Engine>
    </div>
  );
};

export default SceneWithSpinningBoxes;
