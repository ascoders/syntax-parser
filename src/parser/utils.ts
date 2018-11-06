import { IToken } from 'src/lexer/token';
import { IAst } from './chain';
import { cursorSymbol } from './definition';

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

export function getTokenValue(token: IToken) {
  if (token.systemType === null) {
    return token.value;
  } else {
    switch (token.systemType) {
      case 'cursor':
        return cursorSymbol;
      default:
        return null;
    }
  }
}

export function getPathFromObjectByValue(obj: any, val: any, path?: string) {
  path = path || '';
  let fullpath = '';
  for (const key in obj) {
    if (obj[key] === val) {
      if (path === '') {
        return key;
      } else {
        return path + '.' + key;
      }
    } else if (typeof obj[key] === 'object') {
      fullpath = getPathFromObjectByValue(obj[key], val, path === '' ? key : path + '.' + key) || fullpath;
    }
  }
  return fullpath;
}
