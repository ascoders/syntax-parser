import { IToken } from './token';

interface ILexerConfig {
  type: string;
  regexes: RegExp[];
  /**
   * Will match, by not add to token list.
   */
  ignore?: boolean;
}

export class Tokenizer {
  constructor(public lexerConfig: ILexerConfig[]) {}

  public tokenize(input: string) {
    const tokens = [];
    let token: IToken;
    let lastPosition = 0;

    // Keep processing the string until it is empty
    while (input.length) {
      // Get the next token and the token type
      const result = this.getNextToken(input);

      token = result.token;

      if (!token) {
        throw Error(`Unexpected string when lexer:\n${input}`);
      }

      token.position = [lastPosition, lastPosition + token.value.length];
      lastPosition += token.value.length;

      // Advance the string
      input = input.substring(token.value.length);

      if (!result.config.ignore) {
        tokens.push(token);
      }
    }
    return tokens;
  }

  private getNextToken(input: string) {
    for (const eachLexer of this.lexerConfig) {
      for (const regex of eachLexer.regexes) {
        const token = this.getTokenOnFirstMatch({ input, type: eachLexer.type, regex });
        if (token) {
          return {
            token,
            config: eachLexer
          };
        }
      }
    }

    return null;
  }

  private getTokenOnFirstMatch({ input, type, regex }: { input: string; type: string; regex: RegExp }) {
    const matches = input.match(regex);

    if (matches) {
      return { type, value: matches[1] };
    }
  }
}
