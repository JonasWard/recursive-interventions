import { areParallel } from "../geometry/vectorHelpers";
import { Vector3 } from "@babylonjs/core";

test("sums numbers", () => {
  expect(areParallel(new Vector3(1, 0, 0), new Vector3(1, 0, 0))).toEqual(true);
  expect(areParallel(new Vector3(1, 0, 0), new Vector3(-1, 0, 0))).toEqual(true);
});
