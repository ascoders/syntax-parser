import { IToken } from '../lexer/token';
import { chain, createParser, many, matchNumber, matchString, matchWord, optional, plus, Scanner } from '../parser';
import { binaryRecursionToArray } from '../parser/utils';
import { createFourOperations } from './four-operations';
import { sqlTokenizer } from './languages';

const unaryOperator = ['!', '~', '+', '-', 'NOT'];
const bitOperator = ['<<', '>>', '&', '^', '|'];
const mathOperator = ['*', '/', '%', 'DIV', 'MOD', '+', '-', '--'];

const root = () => chain(statements, optional(';'))(ast => ast[0]);

const statements = () => chain(statement, many(';', statement))();

const statement = () =>
  chain([selectStatement, createTableStatement, insertStatement, createViewStatement, setStatement, indexStatement])(
    ast => ast[0]
  );

// ----------------------------------- select statement -----------------------------------

const selectStatement = () =>
  chain(
    'select',
    selectList,
    fromClause,
    optional(orderByClause),
    optional(limitClause),
    optional(union, selectStatement)
  )(ast => {
    const result: any = {
      type: 'statement',
      variant: 'select',
      result: ast[1],
      from: ast[2]
    };

    return result;
  });

const union = () => chain('union', ['all', 'distinct'])();

const fromClause = () =>
  chain('from', tableSources, optional(whereStatement), optional(groupByStatement), optional(havingStatement))();

const selectList = () =>
  chain(selectField, many(',', selectField))(ast => {
    return ast;
  });

const whereStatement = () => chain('where', expression)(ast => ast[1]);

// selectField
//         ::= not? field alias?
//         ::= not? ( field ) alias?
//           | caseStatement alias?
//           | *
const selectField = () =>
  chain([
    chain([chain(many('not'), field)(), chain(many('not'), '(', field, ')')(), caseStatement], optional(alias))(),
    '*'
  ])();

// fieldList
//       ::= field (, fieldList)?
const fieldList = () => chain(field, many(',', field))();

const tableSources = () => chain(tableSource, many(',', tableSource))();

// prettier-ignore
const tableSource = () =>
  chain([
    chain(tableSourceItem, many(joinPart))(),
    chain('(', tableSourceItem, many(joinPart), ')')()
  ])();

const tableSourceItem = () =>
  chain([
    chain(tableName, optional(alias))(),
    chain([selectStatement, chain('(', selectStatement, ')')()], alias)(),
    chain('(', tableSources, ')')()
  ])();

const joinPart = () =>
  chain([
    chain(['inner', 'cross'], 'join', tableSourceItem, optional('on', expression))(),
    chain('straight_join', tableSourceItem, optional('on', expression))(),
    chain(['left', 'right'], optional('outer'), 'join', tableSourceItem, optional('on', expression))(),
    chain('natural', optional(['left', 'right'], optional('outer')), 'join', tableSourceItem)()
  ])();

// Alias ::= AS WordOrString
//         | WordOrString
const alias = () => chain([chain('as', stringOrWord)(), stringOrWord])();

// ----------------------------------- Create table statement -----------------------------------
const createTableStatement = () => chain('create', 'table', stringOrWord, '(', tableOptions, ')')();

const tableOptions = () => chain(tableOption, many(',', tableOption))();

const tableOption = () => chain(stringOrWord, dataType)();

const tableName = () => chain([matchWord, chain(matchWord, '.', matchWord)()])();

// ----------------------------------- Having --------------------------------------------------
const havingStatement = () => chain('having', expression)();

// ----------------------------------- Create view statement -----------------------------------
const createViewStatement = () => chain('create', 'view', matchWord, 'as', selectStatement)();

// ----------------------------------- Insert statement -----------------------------------
const insertStatement = () =>
  chain('insert', optional('ignore'), 'into', tableName, optional(selectFieldsInfo), [selectStatement])();

const selectFieldsInfo = () => chain('(', selectFields, ')')();

const selectFields = () => chain(matchWord, many(',', matchWord))();

// ----------------------------------- groupBy -----------------------------------
const groupByStatement = () => chain('group', 'by', fieldList)();

// ----------------------------------- orderBy -----------------------------------
const orderByClause = () => chain('order', 'by', orderByExpressionList)();

const orderByExpressionList = () => chain(orderByExpression, many(',', orderByExpression))();

const orderByExpression = () => chain(expression, optional(['asc', 'desc']))();

// ----------------------------------- limit -----------------------------------
const limitClause = () =>
  chain('limit', [matchNumber, chain(matchNumber, ',', matchNumber)(), chain(matchNumber, 'offset', matchNumber)()])();

// ----------------------------------- Function -----------------------------------
const functionChain = () => chain([castFunction, normalFunction, ifFunction])();

const functionFields = () => chain(functionFieldItem, many(',', functionFieldItem))();

const functionFieldItem = () => chain(many(selectSpec), [field, caseStatement])();

const ifFunction = () => chain('if', '(', predicate, ',', field, ',', field, ')')();

const castFunction = () => chain('cast', '(', matchWord, 'as', dataType, ')')();

const normalFunction = () => chain(matchWord, '(', optional(functionFields), ')')();

// ----------------------------------- Case -----------------------------------
const caseStatement = () =>
  chain('case', plus(caseAlternative), optional('else', [matchString, 'null', matchNumber]), 'end')();

const caseAlternative = () => chain('when', expression, 'then', fieldItem)();

// ----------------------------------- set statement -----------------------------------

const setStatement = () => chain('set', [variableAssignments])();

const variableAssignments = () => chain(variableAssignment, many(',', variableAssignment))();

const variableAssignment = () => chain(fieldItem, '=', [fieldItem, 'true'])();

// ----------------------------------- Utils -----------------------------------

// TODO: https://github.com/antlr/grammars-v4/blob/master/mysql/MySqlParser.g4#L1963
const dataType = () =>
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

// ----------------------------------- Expression -----------------------------------

/*
 * expr:
 *   expr OR expr
 * | expr || expr
 * | expr XOR expr
 * | expr AND expr
 * | expr && expr
 * | NOT expr
 * | ! expr
 * | boolean_primary IS [NOT] {TRUE | FALSE | UNKNOWN}
 * | boolean_primary 
**/

const expression = () => chain(expressionHead, many(logicalOperator, expression))();

const expressionHead = () =>
  chain([
    chain('(', expression, ')')(),
    chain(notOperator, expression)(),
    chain(booleanPrimary, optional(chain('is', optional('not'), ['true', 'false', 'unknown'])()))
  ])();

/*
 *boolean_primary:
 *   boolean_primary IS [NOT] NULL
 * | boolean_primary <=> predicate
 * | boolean_primary comparison_operator predicate
 * | boolean_primary comparison_operator {ALL | ANY} (subquery)
 * | predicate
**/
const booleanPrimary = () =>
  chain(
    predicate,
    many([
      'isnull',
      chain(optional('is'), optional('not'), ['null', field])(),
      chain(comparisonOperator, predicate)()
      // chain(comparisonOperator, ['ALL',  'ANY'], (subquery))
    ])
  )();

/*
 * predicate:
 *    field SOUNDS LIKE field
 *  | field [NOT] IN (subquery)
 *  | field [NOT] IN (expr [, expr] ...)
 *  | field [NOT] BETWEEN field AND predicate
 *  | field [NOT] LIKE simple_expr [ESCAPE simple_expr]
 *  | field [NOT] REGEXP field
 *  | field
**/
const predicate = () =>
  chain(
    field,
    optional([chain(comparisonOperator, [field, 'null'])(), chain('sounds', 'like', field)(), isOrNotExpression])
  )();

const isOrNotExpression = () =>
  chain(optional('is'), optional('not'), [
    chain('in', '(', fieldList, ')')(),
    chain('between', field, 'and', predicate)(),
    chain('like', field, optional('escape', field))(),
    chain('regexp', field)()
  ])();

const fieldItem = () =>
  chain([
    functionChain,
    chain(stringOrWordOrNumber, [optional('.', '*'), plus('.', stringOrWordOrNumber)])(), // 字段
    '*'
  ])(ast => ast[0]);

const field = () => createFourOperations(fieldItem)();

// ----------------------------------- create index expression -----------------------------------
const indexStatement = () => chain('create', 'index', indexItem, onStatement, whereStatement)();

const indexItem = () => chain(matchString, many('.', matchString))();

const onStatement = () => chain('ON', matchString, '(', fieldForIndexList, ')')();

const fieldForIndex = () => chain(matchString, optional(['ASC', 'DESC']))();

const fieldForIndexList = () => chain(fieldForIndex, many(',', fieldForIndex))();

// ----------------------------------- Terminals -----------------------------------

const stringOrWord = () => chain([matchWord, matchString])(ast => ast[0]);

const stringOrWordOrNumber = () => chain([matchWord, matchString, matchNumber])(ast => ast[0]);

const logicalOperator = () => chain(['and', '&&', 'xor', 'or', '||'])(ast => ast[0]);

const comparisonOperator = () => chain(['=', '>', '<', '<=', '>=', '<>', '!=', '<=>'])(ast => ast[0]);

const notOperator = () => chain(['not', '!'])(ast => ast[0]);

const selectSpec = () =>
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

export const sqlParse = createParser(root, sqlTokenizer);
