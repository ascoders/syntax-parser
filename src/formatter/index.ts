import { trimEnd } from 'lodash';
import { Tokenizer } from '../lexer';
import { IToken } from '../lexer/token';
import tokenTypes from '../lexer/token-types';
import Indentation from './indentation';
import InlineBlock from './inline-block';
import Params from './params';
import {
  nextHasOnlyOneTextUntilReservedWord,
  prevHasOnlyOneTextUntilReservedWord,
  prevTokenIsSemicolon
} from './utils';

export default class Formatter {
  private cfg: any;
  private indentation: Indentation;
  private inlineBlock: InlineBlock;
  private params: Params;
  private tokenizer: Tokenizer;
  private previousReservedWord: any;

  /**
   * @param {Object} cfg
   *   @param {Object} cfg.indent
   *   @param {Object} cfg.params
   * @param {Tokenizer} tokenizer
   */
  constructor(cfg: any, tokenizer: Tokenizer) {
    this.cfg = cfg || {};
    this.indentation = new Indentation(this.cfg.indent);
    this.inlineBlock = new InlineBlock();
    this.params = new Params(this.cfg.params);
    this.tokenizer = tokenizer;
    this.previousReservedWord = {};
  }

  /**
   * Formats whitespaces in a SQL string to make it easier to read.
   *
   * @param {String} query The SQL query string
   * @return {String} formatted query
   */
  public format(query: string) {
    const tokens = this.tokenizer.tokenize(query);
    const formattedQuery = this.getFormattedQueryFromTokens(tokens);

    return formattedQuery.trim();
  }

  public getFormattedQueryFromTokens(tokens: IToken[]) {
    let formattedQuery = '';

    tokens.forEach((token, index) => {
      if (token.type === tokenTypes.WHITESPACE) {
        return;
      } else if (token.type === tokenTypes.LINE_COMMENT) {
        formattedQuery = this.formatLineComment(token, formattedQuery);
      } else if (token.type === tokenTypes.BLOCK_COMMENT) {
        formattedQuery = this.formatBlockComment(token, formattedQuery);
      } else if (token.type === tokenTypes.RESERVED_TOPLEVEL) {
        formattedQuery = this.formatToplevelReservedWord(tokens, index, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.RESERVED_NEWLINE) {
        formattedQuery = this.formatNewlineReservedWord(token, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.RESERVED) {
        formattedQuery = this.formatWithSpaces(token, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.OPEN_PAREN) {
        formattedQuery = this.formatOpeningParentheses(tokens, index, formattedQuery);
      } else if (token.type === tokenTypes.CLOSE_PAREN) {
        formattedQuery = this.formatClosingParentheses(token, formattedQuery);
      } else if (token.type === tokenTypes.PLACEHOLDER) {
        formattedQuery = this.formatPlaceholder(token, formattedQuery);
      } else if (token.value === ',') {
        formattedQuery = this.formatComma(token, formattedQuery);
      } else if (token.value === ':') {
        formattedQuery = this.formatWithSpaceAfter(token, formattedQuery);
      } else if (token.value === '.') {
        formattedQuery = this.formatWithoutSpaces(token, formattedQuery);
      } else if (token.value === ';') {
        formattedQuery = this.formatLineComment(token, trimEnd(formattedQuery), 2);
      } else {
        formattedQuery = this.formatWithSpaces(token, formattedQuery);
      }
    });
    return formattedQuery;
  }

  public formatLineComment(token: IToken, query: string, line = 1) {
    return this.addNewline(query + token.value, line);
  }

  public formatBlockComment(token: IToken, query: string) {
    return this.addNewline(this.addNewline(query) + this.indentComment(token.value));
  }

  public indentComment(comment: string) {
    return comment.replace(/\n/g, '\n' + this.indentation.getIndent());
  }

  public formatToplevelReservedWord(tokens: IToken[], index: number, query: string) {
    const currentToken = tokens[index];

    this.indentation.decreaseTopLevel();

    if (prevTokenIsSemicolon(tokens, index)) {
      // Add two line, e.p: select * from card;\n\n select ..
      query = this.addNewline(query, 2);
    } else if (
      prevHasOnlyOneTextUntilReservedWord(tokens, index) &&
      nextHasOnlyOneTextUntilReservedWord(tokens, index)
    ) {
      // Don't add newline.
    } else {
      query = this.addNewline(query);
    }

    this.indentation.increaseToplevel();

    query += this.equalizeWhitespace(currentToken.value);

    if (nextHasOnlyOneTextUntilReservedWord(tokens, index)) {
      if (!query.endsWith(' ')) {
        query += ' ';
      }
    } else {
      query = this.addNewline(query);
    }

    return query;
  }

  public formatNewlineReservedWord(currentToken: IToken, query: string) {
    return this.addNewline(query) + this.equalizeWhitespace(currentToken.value) + ' ';
  }

  // Replace any sequence of whitespace characters with single space
  public equalizeWhitespace(str: string) {
    return str.replace(/\s+/g, ' ');
  }

  // Opening parentheses increase the block indent level and start a new line
  public formatOpeningParentheses(tokens: IToken[], index: number, query: string) {
    // Take out the preceding space unless there was whitespace there in the original query or another opening parens
    const previousToken = tokens[index - 1];
    if (previousToken && previousToken.type !== tokenTypes.WHITESPACE && previousToken.type !== tokenTypes.OPEN_PAREN) {
      query = trimEnd(query);
    }
    query += tokens[index].value;

    this.inlineBlock.beginIfPossible(tokens, index);

    if (!this.inlineBlock.isActive()) {
      this.indentation.increaseBlockLevel();
      query = this.addNewline(query);
    }
    return query;
  }

  // Closing parentheses decrease the block indent level
  public formatClosingParentheses(token: IToken, query: string) {
    if (this.inlineBlock.isActive()) {
      this.inlineBlock.end();
      return this.formatWithSpaceAfter(token, query);
    } else {
      this.indentation.decreaseBlockLevel();
      return this.formatWithSpaces(token, this.addNewline(query));
    }
  }

  public formatPlaceholder(token: IToken, query: string) {
    return query + this.params.get(token) + ' ';
  }

  // Commas start a new line (unless within inline parentheses or SQL "LIMIT" clause)
  public formatComma(token: IToken, query: string) {
    query = trimEnd(query) + token.value + ' ';

    if (this.inlineBlock.isActive()) {
      return query;
    } else if (/^LIMIT$/i.test(this.previousReservedWord.value)) {
      return query;
    } else {
      return this.addNewline(query);
    }
  }

  public formatWithSpaceAfter(token: IToken, query: string) {
    return trimEnd(query) + token.value + ' ';
  }

  public formatWithoutSpaces(token: IToken, query: string) {
    return trimEnd(query) + token.value;
  }

  public formatWithSpaces(token: IToken, query: string) {
    return query + token.value + ' ';
  }

  public addNewline(query: string, lineNumber = 1) {
    return (
      trimEnd(query) +
      Array.from(Array(lineNumber))
        .map(() => '\n')
        .join('') +
      this.indentation.getIndent()
    );
  }
}
