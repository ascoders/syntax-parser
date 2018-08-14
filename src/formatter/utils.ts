import { IToken } from '../lexer/token';
import tokenTypes from '../lexer/token-types';

export function prevTokenIsSemicolon(tokens: IToken[], index: number) {
  let searchIndex = index - 1;
  let searchContinue = true;
  let endWithSemicolon = false;
  while (searchIndex >= 0 && searchContinue) {
    const searchToken = tokens[searchIndex];

    switch (searchToken.type) {
      case tokenTypes.WHITESPACE:
        break;
      case tokenTypes.OPERATOR:
        if (searchToken.value === ';') {
          endWithSemicolon = true;
        }
        searchContinue = false;
        break;
      default:
        searchContinue = false;
        break;
    }

    searchIndex--;
  }

  return endWithSemicolon;
}

// select  abc        from
//          |          |
//       oneText  currentToken
export function prevHasOnlyOneTextUntilReservedWord(tokens: IToken[], index: number) {
  let searchIndex = index - 1;
  let wordCount = 0;
  let searchContinue = true;
  let isOk = true;

  if (searchIndex < 0) {
    return false;
  }

  while (searchIndex >= 0 && searchContinue) {
    const searchToken = tokens[searchIndex];

    switch (searchToken.type) {
      case tokenTypes.WHITESPACE:
        break;
      case tokenTypes.WORD:
        wordCount++;
        if (wordCount > 1) {
          isOk = false;
          searchContinue = false;
        }
        break;
      case tokenTypes.RESERVED_NEWLINE:
      case tokenTypes.RESERVED:
      case tokenTypes.RESERVED_TOPLEVEL:
        searchContinue = false;
        break;
      default:
        break;
    }

    searchIndex--;
  }

  return isOk;
}

//    select      abc  from
//      |          |
// currentToken oneText
export function nextHasOnlyOneTextUntilReservedWord(tokens: IToken[], index: number) {
  let searchIndex = index + 1;
  let wordCount = 0;
  let searchContinue = true;
  let isOk = true;

  if (searchIndex > tokens.length - 1) {
    return false;
  }

  while (searchIndex <= tokens.length - 1 && searchContinue) {
    const searchToken = tokens[searchIndex];

    switch (searchToken.type) {
      case tokenTypes.WHITESPACE:
        break;
      case tokenTypes.WORD:
        wordCount++;
        if (wordCount > 1) {
          isOk = false;
          searchContinue = false;
        }
        break;
      case tokenTypes.RESERVED_NEWLINE:
      case tokenTypes.RESERVED:
      case tokenTypes.RESERVED_TOPLEVEL:
        searchContinue = false;
        break;
      default:
        break;
    }

    searchIndex++;
  }

  return isOk;
}
