import { IToken } from '../lexer/interface';
import {
  ChainNode,
  createChainNodeFactory,
  execChain,
  IChain,
  many,
  matchNumber,
  matchString,
  matchWord,
  optional,
  plus,
  Scanner
} from '../parser';
import { binaryRecursionToArray } from '../parser/utils';

const unaryOperator = ['!', '~', '+', '-', 'NOT'];
const bitOperator = ['<<', '>>', '&', '^', '|'];
const mathOperator = ['*', '/', '%', 'DIV', 'MOD', '+', '-', '--'];

const root = (chain: IChain) => chain(statements, optional(';'))(ast => ast[0]);

const statements = (chain: IChain) => chain(statement, optional(';', statements))(binaryRecursionToArray);

const statement = (chain: IChain) => chain([selectStatement, createTableStatement, insertStatement])(ast => ast[0]);

// select statement ----------------------------

const selectStatement = (chain: IChain) =>
  chain('select', selectList, 'from', tableList, optional(whereStatement))(ast => {
    const result: any = {
      type: 'statement',
      variant: 'select',
      result: ast[1],
      from: ast[3]
    };

    if (ast[4]) {
      result.where = ast[4][0];
    }

    return result;
  });

// selectList ::= selectField ( , selectList )?
const selectList = (chain: IChain) => chain(selectField, optional(',', selectList))(binaryRecursionToArray);

// whereStatement ::= WHERE expression
const whereStatement = (chain: IChain) => chain('where', expression)(ast => ast[1]);

// selectField
//         ::= not? field alias?
//         ::= not? ( field ) alias?
//           | caseStatement alias?
//           | *
const selectField = (chain: IChain) =>
  chain([
    chain([chain(many('not'), field)(), chain(many('not'), '(', field, ')')()], optional(alias))(),
    chain(caseStatement, optional(alias))(),
    '*'
  ])();

// fieldList
//       ::= field (, fieldList)?
const fieldList = (chain: IChain) => chain(field, optional(',', fieldList))();

// tableList ::= tableName ( , tableList )?
const tableList = (chain: IChain) => chain(tableName, optional(',', tableList))();

// tableName ::= wordOrString alias?
const tableName = (chain: IChain) => chain(stringOrWord, optional(alias))();

// Alias ::= AS WordOrString
//         | WordOrString
const alias = (chain: IChain) => chain([chain('as', stringOrWord)(), stringOrWord])();

// caseStatement
//           ::= CASE caseAlternative+ ELSE string END
const caseStatement = (chain: IChain) => chain('case', plus(caseAlternative), 'else', stringChain, 'end')();

// caseAlternative
//             ::= WHEN expression THEN string
const caseAlternative = (chain: IChain) => chain('when', expression, 'then', stringChain)();

// Create table statement ----------------------------

const createTableStatement = (chain: IChain) => chain('create', 'table', stringOrWord, '(', tableOptions, ')')();

const tableOptions = (chain: IChain) => chain(tableOption, optional(',', tableOptions))();

const tableOption = (chain: IChain) => chain(stringOrWord, dataType)();

const dataType = (chain: IChain) => chain(['int', 'varchar'])(ast => ast[0]);

// Insert statement

const insertStatement = (chain: IChain) =>
  chain('insert', optional('ignore'), 'into', tableName, optional(selectFieldsInfo), [selectStatement])();

const selectFieldsInfo = (chain: IChain) => chain('(', selectFields, ')')();

const selectFields = (chain: IChain) => chain(wordChain, optional(',', selectFields))();

// Utils -----------------------------------------

// expression
//        ::= notOperator expression
//          | notOperator '(' expression ')'
//          | predicate logicalOperator expression
//          | '(' expression ')' logicalOperator '(' expression ')'
//          | predicate IS NOT? (TRUE | FALSE | UNKNOWN)
//          | ( expression )
const expression = (chain: IChain) =>
  chain([
    chain(notOperator, expression)(),
    chain(notOperator, '(', expression, ')')(),
    chain(predicate, many(logicalOperator, expression))(),
    chain(predicate, 'is', optional('not'), ['true', 'fasle', 'unknown'])(),
    chain('(', expression, ')')()
  ])(ast => ast[0]);

// predicate
//       ::= predicate NOT? IN '(' fieldList ')'
//         | left=predicate comparisonOperator right=predicate
//         | predicate NOT? BETWEEN predicate AND predicate
//         | predicate SOUNDS LIKE predicate
//         | predicate NOT? LIKE predicate (ESCAPE STRING_LITERAL)?
//         | field
//         | ( predicate )
const predicate = (chain: IChain) =>
  chain([
    chain(fieldList, optional('not'), 'in', '(', fieldList, ')')(),
    chain(fieldList, comparisonOperator, field)(),
    chain(fieldList, optional('not'), 'between', predicate, 'and', predicate)(),
    chain(fieldList, 'like', stringChain)(),
    field,
    chain('(', predicate, ')')()
  ])();

// field
//   ::= <function>
//     | <number>
//     | <stringOrWord>.*
//     | <stringOrWord>.<stringOrWord>
//     | <stringOrWord>
const field = (chain: IChain) =>
  chain([
    functionChain,
    numberChain,
    chain(stringOrWord, '.', '*')(),
    chain(stringOrWord, '.', stringOrWord)(),
    stringOrWord
  ])(ast => ast[0]);

const wordChain = (chain: IChain) => chain(matchWord())(ast => ast[0]);

const stringChain = (chain: IChain) => chain(matchString())(ast => ast[0]);

const numberChain = (chain: IChain) => chain(matchNumber())(ast => ast[0]);

const stringOrWord = (chain: IChain) => chain([wordChain, stringChain])(ast => ast[0]);

// function ::= word '(' number | * ')'
const functionChain = (chain: IChain) => chain(wordChain, '(', [numberChain, '*'], ')')();

const logicalOperator = (chain: IChain) => chain(['and', '&&', 'xor', 'or', '||'])(ast => ast[0]);

const comparisonOperator = (chain: IChain) => chain(['=', '>', '<', '<=', '>=', '<>', '!=', '<=>'])(ast => ast[0]);

const notOperator = (chain: IChain) => chain(['not', '!'])(ast => ast[0]);

export class SQLAstParser {
  public rootChainNode: ChainNode;

  constructor() {
    const chainNodeFactory = createChainNodeFactory();
    this.rootChainNode = chainNodeFactory(root)();
  }

  public parse = (tokens: IToken[], cursorPosition = 0) => {
    const scanner = new Scanner(tokens);
    return execChain(this.rootChainNode, scanner, cursorPosition, ast => ast[0]);
  };
}
