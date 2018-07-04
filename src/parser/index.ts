import { IToken } from '../lexer/interface';
import tokenTypes from '../lexer/token-types';

const unaryOperator = ['!', '~', '+', '-', 'NOT'];
const COMPARISON_OPERATOR = ['=', '>', '<', '<=', '>=', '<>', '!=', '<=>'];
const bitOperator = ['<<', '>>', '&', '^', '|'];
const mathOperator = ['*', '/', '%', 'DIV', 'MOD', '+', '-', '--'];
const logicalOperator = ['AND', '&&', 'XOR', 'OR', '||'];

function isReserved(token: IToken) {
  return (
    token.type === tokenTypes.RESERVED ||
    token.type === tokenTypes.RESERVED_NEWLINE ||
    token.type === tokenTypes.RESERVED_TOPLEVEL
  );
}

function isWordOrString(token: IToken) {
  return token.type === tokenTypes.WORD || token.type === tokenTypes.STRING;
}

function isWordOrStringOrNumber(token: IToken) {
  return token.type === tokenTypes.WORD || token.type === tokenTypes.STRING || token.type === tokenTypes.NUMBER;
}

export class AstParser {
  private index = 0;
  private root = {};
  private stacks = [this.root];
  private tokens: IToken[] = [];
  private debugLogs: any[] = [];

  constructor(tokens: IToken[]) {
    this.tokens = tokens;
  }

  public parse = () => {
    let isParseSuccess = this.statement();

    if (isParseSuccess) {
      this.jumpWhitespaces();

      if (this.index < this.tokens.length - 1) {
        isParseSuccess = false;
        this.debugLog(`Error: unexpected token ${this.tokens[this.index].value}`);
      }
    }

    return { isParseSuccess, debugLogs: this.debugLogs };
  };

  private debugLog = (...messages: any[]) => {
    this.debugLogs.push(...messages);
  };

  private debugLogHC = (...messages: any[]) => () => {
    this.debugLogs.push(...messages);
    return true;
  };

  private match = (compare: (token: IToken) => boolean) => () => {
    const token = this.tokens[this.index];
    this.debugLog(`match. index: ${this.index}, token:`, token);

    if (!token) {
      this.debugLog('no word to match');
      return false;
    }

    if (compare(token)) {
      this.index++;
      this.debugLog('matched');
      return true;
    } else {
      this.debugLog('missMatch');
      return false;
    }
  };

  /**
   * All matchs must be true.
   */
  private matchAll = (...fns: Array<() => boolean>) => () => {
    const indexSnapshot = this.index;
    const hasFalse = fns.some(fn => fn() === false);

    if (hasFalse) {
      // If not match all, reset index
      this.index = indexSnapshot;
      return false;
    }

    return true;
  };

  /**
   * Like matchAll but always return true.
   */
  private tryMatchAll = (...fns: Array<() => boolean>) => () => {
    const indexSnapshot = this.index;
    const hasFalse = fns.some(fn => fn() === false);

    if (hasFalse) {
      // If not match all, reset index
      this.index = indexSnapshot;
      return true;
    }

    return true;
  };

  /**
   * At least match one.
   */
  private matchSome = (...fns: Array<() => boolean>) => () => {
    const indexSnapshot = this.index;
    const hasTrue = fns.some(fn => fn() === true);

    if (!hasTrue) {
      // If not match all, reset index
      this.index = indexSnapshot;
      return false;
    }

    return true;
  };

  private jumpAtLeastOneWhitespace = () => {
    let hasJump = false;
    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index];
      if (this.tokens[this.index].type !== tokenTypes.WHITESPACE) {
        break;
      } else {
        this.debugLog(`jump. index: ${this.index}, token:`, token);
        hasJump = true;
        this.index++;
      }
    }

    return hasJump;
  };

  private jumpWhitespaces = () => {
    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index];
      if (this.tokens[this.index].type !== tokenTypes.WHITESPACE) {
        break;
      } else {
        this.debugLog(`jump. index: ${this.index}, token:`, token);
        this.index++;
      }
    }
    return true;
  };

  // <Statement> := <SelectStatement>
  private statement = () => {
    return this.selectStatement();
  };

  // <SelectStatement> := SELECT [SelectList] FROM <TableList> [ WhereStatement ]
  // TODO:
  private selectStatement = () => {
    this.debugLog('Enter selectStatement');
    return this.matchAll(
      this.jumpWhitespaces,
      this.match(token => isReserved(token) && token.value.toLowerCase() === 'select'),
      this.jumpAtLeastOneWhitespace,
      this.selectList,
      this.debugLogHC('Back to selectStatement'),
      this.jumpAtLeastOneWhitespace,
      this.match(token => isReserved(token) && token.value.toLowerCase() === 'from'),
      this.jumpAtLeastOneWhitespace,
      this.tableList,
      this.tryMatchAll(this.matchSome(this.matchAll(this.jumpAtLeastOneWhitespace, this.whereStatement)))
    )();
  };

  // <WhereStatement> := WHERE <Predicate>
  private whereStatement = () => {
    this.debugLog('Enter whereStatement');
    return this.matchAll(
      this.jumpWhitespaces,
      this.match(token => isReserved(token) && token.value.toLowerCase() === 'where'),
      this.jumpAtLeastOneWhitespace,
      this.predicate
    )();
  };

  // <SelectList> := <SelectField> [ , <SelectList> ]
  private selectList = (): boolean => {
    this.debugLog('Enter selectList');
    return this.matchAll(
      this.jumpWhitespaces,
      this.selectField,
      this.debugLogHC('Back to selectList'),
      this.tryMatchAll(
        this.jumpWhitespaces,
        this.match(token => token.type === tokenTypes.OPERATOR && token.value === ','),
        this.jumpWhitespaces,
        this.selectList
      )
    )();
  };

  // <TableList> := <TableName> [ , <TableList> ]
  private tableList = (): boolean => {
    this.debugLog('Enter tableList');
    return this.matchAll(
      this.jumpWhitespaces,
      this.tableName,
      this.debugLogHC('Back to tableList'),
      this.tryMatchAll(
        this.jumpWhitespaces,
        this.match(token => token.type === tokenTypes.OPERATOR && token.value === ','),
        this.jumpWhitespaces,
        this.tableList
      )
    )();
  };

  // TableName [AS Alias | Alias]
  private tableName = () => {
    this.debugLog('Enter tableName');
    return this.matchAll(
      this.jumpWhitespaces,
      this.match(isWordOrString),
      this.tryMatchAll(
        this.jumpAtLeastOneWhitespace,
        this.matchSome(
          this.matchAll(
            this.match(token => isReserved(token) && token.value.toLowerCase() === 'as'),
            this.jumpAtLeastOneWhitespace,
            this.match(isWordOrString)
          ),
          this.match(isWordOrString)
        )
      )
    )();
  };

  // <SelectField> := <Field> [AS Alias | Alias]
  //                | *
  private selectField = () => {
    this.debugLog('Enter field');
    return this.matchSome(
      this.matchAll(
        this.jumpWhitespaces,
        this.field,
        this.tryMatchAll(
          this.jumpAtLeastOneWhitespace,
          this.matchSome(
            this.matchAll(
              this.match(token => isReserved(token) && token.value.toLowerCase() === 'as'),
              this.jumpAtLeastOneWhitespace,
              this.match(isWordOrString)
            ),
            this.match(isWordOrString)
          )
        )
      ),
      this.matchAll(
        this.jumpWhitespaces,
        this.match(token => token.type === tokenTypes.OPERATOR && token.value.toLowerCase() === '*')
      )
    )();
  };

  // <Field> := <Word>
  //          | <String>
  //          | <Number>
  //          | function TODO:
  private field = () => {
    this.debugLog('Enter field');
    return this.matchSome(
      this.matchAll(this.jumpWhitespaces, this.word),
      this.matchAll(this.jumpWhitespaces, this.string),
      this.matchAll(this.jumpWhitespaces, this.number)
    )();
  };

  // <Predicate> := <Term> [ AND <Predicate> | OR <Predicate> ]
  //              | <Field> BETWEEN <Field> AND <Field>
  // TODO:
  private predicate = (): boolean => {
    this.debugLog('Enter predicate');
    return this.matchSome(
      this.matchAll(
        this.jumpWhitespaces,
        this.term,
        this.tryMatchAll(
          this.jumpAtLeastOneWhitespace,
          this.matchSome(
            this.matchAll(
              this.match(token => isReserved(token) && token.value.toLowerCase() === 'and'),
              this.jumpAtLeastOneWhitespace,
              this.predicate
            ),
            this.matchAll(
              this.match(token => isReserved(token) && token.value.toLowerCase() === 'or'),
              this.jumpAtLeastOneWhitespace,
              this.predicate
            )
          )
        )
      ),
      this.matchAll(
        this.jumpWhitespaces,
        this.field,
        this.jumpAtLeastOneWhitespace,
        this.match(token => isReserved(token) && token.value.toLowerCase() === 'between'),
        this.jumpAtLeastOneWhitespace,
        this.field,
        this.jumpAtLeastOneWhitespace,
        this.match(token => isReserved(token) && token.value.toLowerCase() === 'and'),
        this.field
      )
    )();
  };

  // <Term> := <Constant> COMPARISON_OPERATOR <Constant>
  //         | <Constant>[NOT] IN(<Constant>)
  //         | <Word> LIKE <String>
  // TODO:
  private term = () => {
    this.debugLog('Enter term');
    return this.matchSome(
      this.matchAll(
        this.jumpWhitespaces,
        this.constant,
        this.jumpWhitespaces,
        this.match(
          token =>
            token.type === tokenTypes.OPERATOR &&
            COMPARISON_OPERATOR.some(comparison => comparison === token.value.toLowerCase())
        ),
        this.jumpWhitespaces,
        this.constant
      ),
      this.matchAll(
        this.jumpWhitespaces,
        this.constant,
        this.jumpAtLeastOneWhitespace,
        this.match(token => token.type === tokenTypes.OPERATOR && token.value.toLowerCase() === 'in'),
        this.jumpAtLeastOneWhitespace,
        this.constant
      ),
      this.matchAll(
        this.jumpWhitespaces,
        this.word,
        this.jumpAtLeastOneWhitespace,
        this.match(token => isReserved(token) && token.value.toLowerCase() === 'like'),
        this.string
      )
    )();
  };

  // <Constant> := Word | String | Integer
  // TODO:
  private constant = () => {
    this.debugLog('Enter constant');
    return this.matchAll(this.jumpWhitespaces, this.match(isWordOrStringOrNumber))();
  };

  private word = () => {
    this.debugLog('Enter word');
    return this.matchAll(this.jumpWhitespaces, this.match(token => token.type === tokenTypes.WORD))();
  };

  private string = () => {
    this.debugLog('Enter string');
    return this.matchAll(this.jumpWhitespaces, this.match(token => token.type === tokenTypes.STRING))();
  };

  private number = () => {
    this.debugLog('Enter number');
    return this.matchAll(this.jumpWhitespaces, this.match(token => token.type === tokenTypes.NUMBER))();
  };
}
