import { IToken } from '../lexer/interface';
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

  public isEnd = () => {
    return this.index >= this.tokens.length - 1;
  };
}
