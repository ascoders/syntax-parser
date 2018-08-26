import { IToken } from '../lexer/token';
import tokenTypes from '../lexer/token-types';

export class Scanner {
  private tokens: IToken[] = [];
  private index = 0;

  constructor(tokens: IToken[], index = 0) {
    // ignore whitespace, comment
    this.tokens = tokens.filter(
      token =>
        token.type !== tokenTypes.WHITESPACE &&
        token.type !== tokenTypes.COMMENT &&
        token.type !== tokenTypes.LINE_COMMENT &&
        token.type !== tokenTypes.BLOCK_COMMENT
    );
    this.index = index;
  }

  public read = () => {
    const token = this.tokens[this.index];
    if (token) {
      return token;
    } else {
      return false;
    }
  };

  public next = () => {
    this.index++;
  };

  public getIndex = () => this.index;

  public setIndex = (index: number) => (this.index = index);

  public getRestTokenCount = () => this.tokens.length - this.index - 1;

  public getNextFromToken = (token: IToken) => {
    const currentTokenIndex = this.tokens.findIndex(eachToken => eachToken === token);
    if (currentTokenIndex > -1) {
      if (currentTokenIndex + 1 < this.tokens.length) {
        return this.tokens[currentTokenIndex + 1];
      } else {
        return null;
      }
    } else {
      throw Error(`token ${token.value} not exist in scanner.`);
    }
  };

  public isEnd = () => {
    return this.index >= this.tokens.length;
  };

  public getPrevTokenFromCharacterIndex = (characterIndex: number) => {
    let prevToken: IToken = null;

    this.tokens.forEach(token => {
      if (token.position[1] < characterIndex) {
        prevToken = token;
      }
    });

    return prevToken;
  };
}
