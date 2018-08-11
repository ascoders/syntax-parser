import { IAst } from './chain';

export const binaryRecursionToArray = (ast: IAst[]) => {
  if (ast[1]) {
    return [ast[0]].concat(ast[1][1]);
  } else {
    return [ast[0]];
  }
};
