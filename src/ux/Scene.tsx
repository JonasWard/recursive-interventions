import React, { useEffect, useRef, useState } from "react";
import { Engine, Scene, useBeforeRender, useClick, useHover, useScene } from "react-babylonjs";
import { Mesh, Vector3, Color3, VertexData } from "@babylonjs/core";
import { addMeshToScene, quadratoAsVertexData } from "../geometry/quadrato";

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

      addMeshToScene(scene);

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
}

const CustomMesh: React.FC<ICustomMeshProps> = (props) => {
  const scene = useScene();
  const [hovered, setHovered] = useState(false);

  const customMeshMethod = () => {
    const meshInstance = new Mesh(props.name, scene);

    //Set arrays for positions and indices
    const { positions, indices } = quadratoAsVertexData();

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
  };

  const customMeshRef = useRef<Mesh | null>(customMeshMethod());

  const rpm = 5;
  useBeforeRender((scene) => {
    if (customMeshRef.current) {
      // Delta time smoothes the animation.
      const deltaTimeInMillis = scene.getEngine().getDeltaTime();
      customMeshRef.current.rotation.y += (rpm / 60) * Math.PI * 2 * (deltaTimeInMillis / 1000);
    }
  });

  useHover(
    () => setHovered(true),
    () => setHovered(false),
    customMeshRef
  );

  useEffect(() => {
    console.log("hover: ", hovered);
  }, [hovered]);

  useEffect(() => {
    console.log("currentMeshRef: ", customMeshRef);
  }, [customMeshRef]);

  return (
    <mesh name={props.name} ref={customMeshRef} disposeInstanceOnUnmount position={props.position}>
      <standardMaterial name={`${props.name}-mat`} wireframe={hovered} />
    </mesh>
  );
};

export const SceneWithSpinningBoxes = () => (
  <div>
    <Engine antialias adaptToDeviceRatio={true} canvasId="babylonJS" width={"100%"} height={"100%"}>
      <Scene>
        <arcRotateCamera name="camera1" target={Vector3.Zero()} alpha={Math.PI / 2} beta={Math.PI / 4} radius={8} />
        <hemisphericLight name="light1" intensity={0.7} direction={Vector3.Up()} />
        <CustomMesh name="left" position={new Vector3(-2, 0, 0)} useWireframe={false} />
      </Scene>
    </Engine>
  </div>
);

export default SceneWithSpinningBoxes;