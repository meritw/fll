declare module "node-diff3" {
  export function merge(
    a: string[],
    o: string[],
    b: string[],
  ): { conflict: boolean; result: string[] };
}
