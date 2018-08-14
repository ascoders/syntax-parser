import { IToken } from '../lexer/token';

/**
 * Handles placeholder replacement with given params.
 */
export default class Params {
  private params: {
    [key: string]: string;
  };
  private index = 0;

  /**
   * @param {Object} params
   */
  constructor(params: { [key: string]: string }) {
    if (params) {
      this.params = params;
    }
  }

  /**
   * Returns param value that matches given placeholder with param key.
   * @param {Object} token
   *   @param {String} token.key Placeholder key
   *   @param {String} token.value Placeholder value
   * @return {String} param or token.value when params are missing
   */
  public get(token: IToken) {
    if (!this.params) {
      return token.value;
    }
    if (token.key) {
      return this.params[token.key];
    }
    return this.params[this.index++];
  }
}
