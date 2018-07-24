import { IToken } from '../lexer/interface';
import tokenTypes from '../lexer/token-types';
import { IChain } from './chain';
import { Scanner } from './scanner';

export type IMatch = boolean;

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
    return false;
  }
  if (compare(token)) {
    scanner.next();
    return true;
  } else {
    return false;
  }
}

function createMatch<T>(fn: (scanner: Scanner, arg?: T) => IMatch) {
  return (arg?: T) => {
    function foo(scanner: Scanner) {
      return () => fn(scanner, arg);
    }
    foo.prototype.name = 'match';
    return foo;
  };
}

export const matchWord = createMatch((scanner, word?: string | string[]) => {
  if (!word) {
    return matchToken(scanner, token => token.type === tokenTypes.WORD);
  } else {
    return matchToken(scanner, token => token.type === tokenTypes.WORD && equalWordOrIncludeWords(token.value, word));
  }
});

export const match = createMatch((scanner, word: string | string[]) =>
  matchToken(scanner, token => equalWordOrIncludeWords(token.value, word))
);

export const matchString = createMatch(scanner => matchToken(scanner, token => token.type === tokenTypes.STRING));

export const matchNumber = createMatch(scanner => matchToken(scanner, token => token.type === tokenTypes.NUMBER));

export const matchWordOrString = createMatch(scanner =>
  matchToken(scanner, token => token.type === tokenTypes.WORD || token.type === tokenTypes.STRING)
);

export const matchWordOrStringOrNumber = createMatch(scanner =>
  matchToken(
    scanner,
    token => token.type === tokenTypes.WORD || token.type === tokenTypes.STRING || token.type === tokenTypes.NUMBER
  )
);

export const matchTrue = () => true;
export const matchFalse = () => false;

export const optional = (...elements: any[]) => (chain: IChain) => chain([chain(...elements), true]);

export const plus = (...elements: any[]) => (chain: IChain) => chain(chain(...elements), optional(plus(...elements)));
