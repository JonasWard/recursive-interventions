import React, { useEffect, useRef, useState } from "react";
import { Engine, Scene, useBeforeRender, useClick, useHover, useScene } from "react-babylonjs";
import { Mesh, Vector3, Color3, VertexData } from "@babylonjs/core";
import { constructVoxelQuadrata } from "../geometry/quadrato";
import { createSTL, vertexFaceListMeshToBaseMeshData } from "../geometry/meshHelpers";
import { VertexFaceListMesh } from "../enums/geometry";

const DefaultScale = new Vector3(1, 1, 1);
const BiggerScale = new Vector3(1.25, 1.25, 1.25);

interface ISpinningBoxProps {
  name: string;
  position: Vector3;
  hoveredColor: Color3;
  color: Color3;
}

const SpinningBox: React.FC<ISpinningBoxProps> = (props) => {
  // access Babylon scene objects with same React hook as regular DOM elements
  const boxRef = useRef<Mesh | null>(null);
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
        specularColor={Color3.Black()}
      />
    </mesh>
  );
};

interface ICustomMeshProps {
  name: string;
  useWireframe: boolean;
  position: Vector3;
  setMesh: (mesh: VertexFaceListMesh) => void;
}

const CustomMesh: React.FC<ICustomMeshProps> = (props) => {
  const scene = useScene();
  const [mesh] = useState<VertexFaceListMesh>(constructVoxelQuadrata(5, 5, 10, 20, 20, 2, 2, 8, undefined, false));
  const [customMesh] = useState(() => {
    const meshInstance = new Mesh(props.name, scene);

    //Set arrays for positions and indices
    const { positions, indices } = vertexFaceListMeshToBaseMeshData(mesh);

    //Empty array to contain calculated values
    const normals: number[] = [];

    var vertexData = new VertexData();
    VertexData.ComputeNormals(positions, indices, normals);

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
  const [mesh, setMesh] = useState<VertexFaceListMesh>({} as VertexFaceListMesh);

  return (
    <div>
      <button onClick={() => createSTL(mesh)} style={{ position: "absolute" }}>
        download stl
      </button>
      <Engine antialias adaptToDeviceRatio={true} canvasId="babylonJS" width={"100%"} height={"100%"}>
        <Scene>
          <arcRotateCamera name="camera1" target={Vector3.Zero()} alpha={Math.PI / 2} beta={Math.PI / 4} radius={8} />
          <hemisphericLight name="light1" intensity={0.7} direction={Vector3.Up()} />
          <CustomMesh name="left" position={new Vector3(-2, 0, 0)} useWireframe={false} setMesh={setMesh} />
        </Scene>
      </Engine>
    </div>
  );
};

export default SceneWithSpinningBoxes;
