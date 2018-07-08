import { IToken } from '../lexer/interface';
import tokenTypes from '../lexer/token-types';
import { Scanner } from './scanner';

export type IMatch = boolean;

function equalWordOrIncludeWords(str: string, word: string | string[]) {
  if (typeof word === 'string') {
    return str.toLowerCase() === word.toLowerCase();
  } else {
    return word.some(eachWord => eachWord.toLowerCase() === str.toLowerCase());
  }
}

function isTypeReserved(token: IToken) {
  return (
    token.type === tokenTypes.RESERVED ||
    token.type === tokenTypes.RESERVED_NEWLINE ||
    token.type === tokenTypes.RESERVED_TOPLEVEL
  );
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
  return (scanner: Scanner, arg?: T) => {
    function foo() {
      return fn(scanner, arg);
    }
    foo.prototype.name = 'match';
    return foo;
  };
}

function meetWhitespace(scanner: Scanner) {
  let lastIsWhitespace = true;
  let meetWhitespaceCount = 0;
  while (lastIsWhitespace) {
    lastIsWhitespace = matchToken(scanner, token => token.type === tokenTypes.WHITESPACE);
    if (lastIsWhitespace) {
      meetWhitespaceCount++;
    }
  }
  return meetWhitespaceCount;
}

export const skipWhitespace = createMatch(scanner => {
  meetWhitespace(scanner);
  return true;
});

export const skipAtLeastWhitespace = createMatch(scanner => {
  return meetWhitespace(scanner) > 0;
});

export const matchReserved = createMatch((scanner, word: string | string[]) =>
  matchToken(scanner, token => isTypeReserved(token) && equalWordOrIncludeWords(token.value, word))
);

export const matchOperator = createMatch((scanner, word: string | string[]) =>
  matchToken(scanner, token => token.type === tokenTypes.OPERATOR && equalWordOrIncludeWords(token.value, word))
);

export const matchOpenParen = createMatch((scanner, word: string | string[]) =>
  matchToken(scanner, token => token.type === tokenTypes.OPEN_PAREN && equalWordOrIncludeWords(token.value, word))
);

export const matchCloseParen = createMatch((scanner, word: string | string[]) =>
  matchToken(scanner, token => token.type === tokenTypes.CLOSE_PAREN && equalWordOrIncludeWords(token.value, word))
);

export const matchWord = createMatch((scanner, word?: string | string[]) => {
  if (!word) {
    return matchToken(scanner, token => token.type === tokenTypes.WORD);
  } else {
    return matchToken(scanner, token => token.type === tokenTypes.WORD && equalWordOrIncludeWords(token.value, word));
  }
});

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

export const matchAll = () => {
  function foo() {
    return true;
  }
  foo.prototype.name = 'match';
  return foo;
};
