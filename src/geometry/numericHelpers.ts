/**
 * Helper to create list of numbers
 * @param start first value of array
 * @param step step size
 * @param cnt amount of items
 * @param random whether the values should be randomized slightly
 * @returns number array
 */
export const createNumberList = (start: number, step: number, cnt: number, random: boolean = false): number[] => {
  const ns: number[] = [];
  if (random) {
    const rns: number[] = [];
    let s = 0;
    rns.push(s);
    for (let i = 0; i < cnt; i++) {
      s += (0.5 + Math.random()) * step;
      rns.push(s);
    }
    ns.push(...remapNumberArray(rns, start, cnt + 1 * step + start));
  } else {
    for (let i = 0; i < cnt + 1; i++) ns.push(start + i * step);
  }
  return ns;
};

/**
 * Helper method to remap number array
 * @param ns numbers to remap
 * @param min new minimum
 * @param max new maximum
 * @param minN optional minimum of ns
 * @param maxN optional maximum of ns
 * @returns remapped number[]
 */
export const remapNumberArray = (ns: number[], min: number, max: number, minN?: number, maxN?: number): number[] => {
  if (minN === undefined) minN = Math.min(...ns);
  if (maxN === undefined) maxN = Math.max(...ns);
  const range = maxN - minN;
  return ns.map((n) => ((n - (minN as number)) / range) * (max - min) + min);
};
