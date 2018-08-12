import { IAst } from './chain';

export const binaryRecursionToArray = (ast: IAst[]) => {
  if (ast[1]) {
    return [ast[0]].concat(ast[1][1]);
  } else {
    return [ast[0]];
  }
};

export function tailCallOptimize<T>(f: T): T {
  let value: any;
  let active = false;
  const accumulated: any[] = [];
  return function accumulator(this: any) {
    accumulated.push(arguments);
    if (!active) {
      active = true;
      while (accumulated.length) {
        value = (f as any).apply(this, accumulated.shift());
      }
      active = false;
      return value;
    }
  } as any;
}
