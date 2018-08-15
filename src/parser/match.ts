import { IToken } from '../lexer/token';
import tokenTypes from '../lexer/token-types';
import { IChain } from './chain';
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

function matchToken(scanner: Scanner, compare: (token: IToken) => boolean): IMatch {
  const token = scanner.read();
  if (!token) {
    return {
      token: null,
      match: false
    };
  }
  if (compare(token)) {
    scanner.next();
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

function createMatch<T>(fn: (scanner: Scanner, arg?: T) => IMatch, specialName?: string) {
  return (arg?: T) => {
    function foo() {
      return (scanner: Scanner) => fn(scanner, arg);
    }
    foo.prototype.name = 'match';
    foo.prototype.displayName = specialName;
    return foo;
  };
}

export const match = createMatch((scanner, word: string | string[]) =>
  matchToken(scanner, token => equalWordOrIncludeWords(token.value, word))
);

export const matchWord = createMatch((scanner, word?: string | string[]) => {
  if (!word) {
    return matchToken(scanner, token => token.type === tokenTypes.WORD);
  } else {
    return matchToken(scanner, token => token.type === tokenTypes.WORD && equalWordOrIncludeWords(token.value, word));
  }
}, 'word');

export const matchString = createMatch(
  scanner => matchToken(scanner, token => token.type === tokenTypes.STRING),
  'string'
);

export const matchNumber = createMatch(
  scanner => matchToken(scanner, token => token.type === tokenTypes.NUMBER),
  'number'
);

export const matchWordOrString = createMatch(scanner =>
  matchToken(scanner, token => token.type === tokenTypes.WORD || token.type === tokenTypes.STRING)
);

export const matchTrue = (): IMatch => ({
  token: null,
  match: true
});
export const matchFalse = (): IMatch => ({
  token: null,
  match: true
});

export const optional = (...elements: any[]) => (chain: IChain) => chain([chain(...elements)(), true])(ast => ast[0]);

export const plus = (...elements: any[]) => (chain: IChain) => {
  const result = chain(...elements)();
  result.isPlus = true;
  return result;
};

export const many = (...elements: any[]) => optional(plus(...elements));
