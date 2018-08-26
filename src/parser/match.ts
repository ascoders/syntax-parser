import { IToken } from '../lexer/token';
import tokenTypes from '../lexer/token-types';
import { chain, ISolveAst } from './chain';
import { Scanner } from './scanner';

export interface IMatch {
  token: IToken;
  match: boolean;
}

function equalWordOrIncludeWords(str: string, word: string | string[]) {
  if (typeof word === 'string') {
    return str.toLowerCase() === word.toLowerCase();
  } else {
    return word.some(eachWord => eachWord.toLowerCase() === str.toLowerCase());
  }
}

function matchToken(scanner: Scanner, compare: (token: IToken) => boolean, isCostToken?: boolean): IMatch {
  const token = scanner.read();
  if (!token) {
    return {
      token: null,
      match: false
    };
  }
  if (compare(token)) {
    if (isCostToken) {
      scanner.next();
    }

    return {
      token,
      match: true
    };
  } else {
    return {
      token,
      match: false
    };
  }
}

function createMatch<T>(fn: (scanner: Scanner, arg?: T, isCostToken?: boolean) => IMatch, specialName?: string) {
  return (arg?: T) => {
    function foo() {
      return (scanner: Scanner, isCostToken?: boolean) => fn(scanner, arg, isCostToken);
    }
    foo.prototype.name = 'match';
    foo.prototype.displayName = specialName;
    return foo;
  };
}

export const match = createMatch((scanner, word: string | string[], isCostToken) =>
  matchToken(scanner, token => equalWordOrIncludeWords(token.value, word), isCostToken)
);

export const matchWord = createMatch((scanner, word, isCostToken) => {
  return matchToken(scanner, token => token.type === tokenTypes.WORD, isCostToken);
}, 'word')();

export const matchString = createMatch(
  (scanner, compare, isCostToken) => matchToken(scanner, token => token.type === tokenTypes.STRING, isCostToken),
  'string'
)();

export const matchNumber = createMatch(
  (scanner, compare, isCostToken) => matchToken(scanner, token => token.type === tokenTypes.NUMBER, isCostToken),
  'number'
)();

export const matchTrue = (): IMatch => ({
  token: null,
  match: true
});

export const matchFalse = (): IMatch => ({
  token: null,
  match: true
});

export function optional(...elements: any[]) {
  return chain([chain(...elements)(), true])(ast => ast[0]);
}

export function plus(...elements: any[]) {
  const result = chain(...elements)();
  (result as any).prototype.isPlus = true;
  return result;
}

export function optionalOneElement(element: any) {
  return chain([chain(element)(ast => ast[0]), true])(ast => ast[0]);
}

export function many(...elements: any[]) {
  return optionalOneElement(plus(...elements));
}
