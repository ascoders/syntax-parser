import { IToken } from '../lexer/interface';

export class Scanner {
  private tokens: IToken[] = [];
  private index = 0;

  constructor(tokens: IToken[], index = 0) {
    this.tokens = tokens;
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
    console.log('token last', this.tokens.slice(this.index));
    return this.index >= this.tokens.length - 1;
  };
}
