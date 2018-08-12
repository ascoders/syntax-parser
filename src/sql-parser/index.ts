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

const statement = (chain: IChain) =>
  chain([selectStatement, createTableStatement, insertStatement, createViewStatement])(ast => ast[0]);

// select statement ----------------------------

const selectStatement = (chain: IChain) =>
  chain('select', selectList, fromClause, optional(union, selectStatement))(ast => {
    const result: any = {
      type: 'statement',
      variant: 'select',
      result: ast[1],
      from: ast[2]
    };

    return result;
  });

const union = (chain: IChain) => chain('union', ['all', 'distinct'])();

const fromClause = (chain: IChain) =>
  chain('from', tableSources, optional(whereStatement), optional('group', 'by', groupByItems))();

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

const tableSources = (chain: IChain) => chain(tableSourceItem, optional(',', tableSources))();

const tableSourceItem = (chain: IChain) => chain([tableName, chain('(', selectStatement, ')')], optional(alias))();

// Alias ::= AS WordOrString
//         | WordOrString
const alias = (chain: IChain) => chain([chain('as', stringOrWord)(), stringOrWord])();

// Create table statement ----------------------------

const createTableStatement = (chain: IChain) => chain('create', 'table', stringOrWord, '(', tableOptions, ')')();

const tableOptions = (chain: IChain) => chain(tableOption, optional(',', tableOptions))();

const tableOption = (chain: IChain) => chain(stringOrWord, dataType)();

const tableName = (chain: IChain) => chain(wordChain)();

// Create view statement ----------------------------

const createViewStatement = (chain: IChain) => chain('create', 'view', wordChain, 'as', selectStatement)();

// Insert statement ----------------------------

const insertStatement = (chain: IChain) =>
  chain('insert', optional('ignore'), 'into', tableName, optional(selectFieldsInfo), [selectStatement])();

const selectFieldsInfo = (chain: IChain) => chain('(', selectFields, ')')();

const selectFields = (chain: IChain) => chain(wordChain, optional(',', selectFields))();

// groupBy ---------------------------------------

const groupByItems = (chain: IChain) => chain(expression, optional(',', groupByItems))();

// Function ---------------------------------------

const functionChain = (chain: IChain) => chain([castFunction, normalFunction])();

const functionFields = (chain: IChain) => chain(functionFieldItem, optional(',', functionFields))();

const functionFieldItem = (chain: IChain) =>
  chain([numberChain, stringChain, chain(many(selectSpec), [wordChain, caseStatement])(), functionChain, '*'])();

// TODO:
const ifFunction = (chain: IChain) => chain()();

const castFunction = (chain: IChain) => chain('cast', '(', wordChain, 'as', dataType, ')')();

const normalFunction = (chain: IChain) => chain(wordChain, '(', optional(functionFields), ')')();

// Case -----------------------------------------

const caseStatement = (chain: IChain) => chain('case', plus(caseAlternative), 'else', [stringChain, 'null'], 'end')();

const caseAlternative = (chain: IChain) => chain('when', expression, 'then', stringOrWord)();

// Utils -----------------------------------------

// TODO: https://github.com/antlr/grammars-v4/blob/master/mysql/MySqlParser.g4#L1963
const dataType = (chain: IChain) =>
  chain([
    chain(['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext']),
    chain(['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint']),
    chain(['real', 'double', 'float']),
    chain(['decimal', 'numberic']),
    chain(['date', 'tinyblob', 'blob', 'mediumblob', 'longblob', 'bool', 'boolean']),
    chain(['bit', 'time', 'timestamp', 'datetime', 'binary', 'varbinary', 'year']),
    chain(['enum', 'set']),
    chain('geometrycollection', 'linestring', 'multilinestring', 'multipoint', 'multipolygon', 'point', 'polygon')
  ])(ast => ast[0]);

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

const logicalOperator = (chain: IChain) => chain(['and', '&&', 'xor', 'or', '||'])(ast => ast[0]);

const comparisonOperator = (chain: IChain) => chain(['=', '>', '<', '<=', '>=', '<>', '!=', '<=>'])(ast => ast[0]);

const notOperator = (chain: IChain) => chain(['not', '!'])(ast => ast[0]);

const selectSpec = (chain: IChain) =>
  chain([
    'all',
    'distinct',
    'distinctrow',
    'high_priority',
    'straight_join',
    'sql_small_result',
    'sql_big_result',
    'sql_buffer_result',
    'sql_cache',
    'sql_no_cache',
    'sql_calc_found_rows'
  ])(ast => ast[0]);

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
