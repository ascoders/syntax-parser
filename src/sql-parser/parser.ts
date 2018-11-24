import { chain, createParser, many, matchTokenType, optional, plus } from '../parser';
import { createFourOperations } from './four-operations';
import { sqlTokenizer } from './lexer';
import { reserveKeys } from './reserve-keys';
import { flattenAll } from './utils';

const root = () => chain(statements, optional(';'))(ast => ast[0]);

const statements = () => chain(statement, many(';', statement))(ast => ast[0]);

const statement = () =>
  chain([
    selectStatement,
    createTableStatement,
    insertStatement,
    createViewStatement,
    setStatement,
    createIndexStatement
  ])(ast => ast[0]);

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
  chain('from', tableSources, optional(whereStatement), optional(groupByStatement), optional(havingStatement))(
    ast =>
      // TODO: Ignore where group having
      ast[1]
  );

const selectList = () => chain(selectField, many(selectListTail))(flattenAll);

const selectListTail = () => chain(',', selectField)(ast => ast[1]);

const whereStatement = () => chain('where', expression)(ast => ast[1]);

// selectField
//         ::= not? field alias?
//         ::= not? ( field ) alias?
//           | caseStatement alias?
//           | *
const selectField = () =>
  chain([
    chain(
      many('not'),
      [
        chain(field, optional(overClause))(
          ast =>
            // TODO: Ignore overClause
            ast[0]
        ),
        chain('(', field, ')')(),
        caseStatement
      ],
      optional(alias)
    )(
      ast =>
        // TODO: Ignore not and alias
        ast[1]
    ),
    '*'
  ])(ast => ast[0]);

// fieldList
//       ::= field (, fieldList)?
const fieldList = () => chain(field, many(',', field))();

const tableSources = () => chain(tableSource, many(tableSourcesTail))(flattenAll);

const tableSourcesTail = () => chain(',', tableSource)(ast => ast[1]);

const tableSource = () =>
  chain(tableSourceItem, many(joinPart))(
    ast =>
      // TODO: Ignore join
      ast[0]
  );

const tableSourceItem = () =>
  chain([
    chain(tableName, optional(alias))(
      ast =>
        // TODO: Ignore alias
        ast[0]
    ),
    chain([selectStatement, chain('(', selectStatement, ')')(ast => ast[1])], alias)(ast => ({
      ...ast[0],
      alias: ast[1]
    }))
  ])(ast => ast[0]);

const joinPart = () =>
  chain(
    [
      'join',
      'straight_join',
      chain(['inner', 'cross'], 'join')(),
      chain(['left', 'right'], optional('outer'), 'join')(),
      chain('natural', optional(['left', 'right'], optional('outer')), 'join')()
    ],
    tableSourceItem,
    optional('on', expression)
  )();

// Alias ::= AS WordOrString
//         | WordOrString
const alias = () => chain([chain('as', stringOrWord)(), stringOrWord])();

// ----------------------------------- Create table statement -----------------------------------
const createTableStatement = () =>
  chain('create', 'table', stringOrWord, '(', tableOptions, ')', optional(withStatement))();

const withStatement = () => chain('with', '(', withStatements, ')')();

const withStatements = () => chain(withStatementsTail, many(',', withStatementsTail))();

const withStatementsTail = () => chain(wordSym, '=', stringSym)();

const tableOptions = () => chain(tableOption, many(',', tableOption))();

const tableOption = () => chain(stringOrWord, dataType)();

const tableName = () => chain([wordSym, chain(wordSym, '.', wordSym)()])(ast => ast[0]);

// ----------------------------------- Having --------------------------------------------------
const havingStatement = () => chain('having', expression)();

// ----------------------------------- Create view statement -----------------------------------
const createViewStatement = () => chain('create', 'view', wordSym, 'as', selectStatement)();

// ----------------------------------- Insert statement -----------------------------------
const insertStatement = () =>
  chain('insert', optional('ignore'), 'into', tableName, optional(selectFieldsInfo), [selectStatement])(ast => {
    return {
      type: 'statement',
      variant: 'insert',
      into: {
        type: 'indentifier',
        variant: 'table',
        name: ast[3]
      },
      result: ast[5]
    };
  });

const selectFieldsInfo = () => chain('(', selectFields, ')')();

const selectFields = () => chain(wordSym, many(',', wordSym))();

// ----------------------------------- groupBy -----------------------------------
const groupByStatement = () => chain('group', 'by', fieldList)();

// ----------------------------------- orderBy -----------------------------------
const orderByClause = () => chain('order', 'by', orderByExpressionList)();

const orderByExpressionList = () => chain(orderByExpression, many(',', orderByExpression))();

const orderByExpression = () => chain(expression, optional(['asc', 'desc']))();

/*
<PARTITION BY clause> ::=  
PARTITION BY value_expression , ... [ n ] 
*/

const partitionByClause = () => chain('partition', 'by', expression)(ast => ast);

/*
OVER (   
       [ <PARTITION BY clause> ]  
       [ <ORDER BY clause> ]   
       [ <ROW or RANGE clause> ]  
      )  
*/
const overClause = () => chain('over', '(', overTailExpression, ')')();

const overTailExpression = () =>
  chain([partitionByClause, chain(field, orderByClause)()], many(',', overTailExpression))();

// ----------------------------------- limit -----------------------------------
const limitClause = () =>
  chain('limit', [numberSym, chain(numberSym, ',', numberSym)(), chain(numberSym, 'offset', numberSym)()])();

// ----------------------------------- Function -----------------------------------
const functionChain = () => chain([castFunction, normalFunction, ifFunction])();

const ifFunction = () => chain('if', '(', predicate, ',', field, ',', field, ')')();

const castFunction = () => chain('cast', '(', fieldItem, 'as', dataType, ')')();

const normalFunction = () => chain(wordSym, '(', optional(functionFields), ')')();

const functionFields = () => chain(functionFieldItem, many(',', functionFieldItem))();

const functionFieldItem = () => chain(many(selectSpec), [field, caseStatement])();

// ----------------------------------- Case -----------------------------------
const caseStatement = () =>
  chain('case', plus(caseAlternative), optional('else', [stringSym, 'null', numberSym]), 'end')();

const caseAlternative = () => chain('when', expression, 'then', fieldItem)();

// ----------------------------------- set statement -----------------------------------

const setStatement = () => chain('set', variableAssignments)();

const variableAssignments = () => chain(variableAssignment, many(',', variableAssignment))();

const variableAssignment = () => chain(fieldItem, '=', fieldItem)();

// ----------------------------------- Utils -----------------------------------

// TODO: https://github.com/antlr/grammars-v4/blob/master/mysql/MySqlParser.g4#L1963
const dataType = () =>
  chain([
    chain(['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext'])(ast => ast[0]),
    chain(['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'])(ast => ast[0]),
    chain(['real', 'double', 'float'])(ast => ast[0]),
    chain(['decimal', 'numberic'])(ast => ast[0]),
    chain(['date', 'tinyblob', 'blob', 'mediumblob', 'longblob', 'bool', 'boolean'])(ast => ast[0]),
    chain(['bit', 'time', 'timestamp', 'datetime', 'binary', 'varbinary', 'year'])(ast => ast[0]),
    chain(['enum', 'set'])(ast => ast[0]),
    chain('geometrycollection', 'linestring', 'multilinestring', 'multipoint', 'multipolygon', 'point', 'polygon')(
      ast => ast[0]
    )
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

// /*
//  *boolean_primary:
//  *   boolean_primary IS [NOT] NULL
//  * | boolean_primary <=> predicate
//  * | boolean_primary comparison_operator predicate
//  * | boolean_primary comparison_operator {ALL | ANY} (subquery)
//  * | predicate
// **/
const booleanPrimary = () =>
  chain(predicate, many(['isnull', chain(optional('is'), optional('not'), ['null', field])()]))();

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
  chain(field, optional([chain(comparisonOperator, field)(), chain('sounds', 'like', field)(), isOrNotExpression]))();

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
    chain(
      stringOrWordOrNumber,
      optional([chain('.', '*')(ast => '.*'), chain(':', normalFunction)(), plus(dotStringOrWordOrNumber)])
    )(
      ast =>
        // TODO: Ignore others
        ast[0]
    ),
    '*'
  ])(ast => ast[0]);

const dotStringOrWordOrNumber = () => chain('.', stringOrWordOrNumber)(ast => ast[0] + ast[1]);

const field = () => createFourOperations(fieldItem)();

// ----------------------------------- create index expression -----------------------------------
const createIndexStatement = () => chain('create', 'index', indexItem, onStatement, whereStatement)();

const indexItem = () => chain(stringSym, many('.', stringSym))();

const onStatement = () => chain('ON', stringSym, '(', fieldForIndexList, ')')();

const fieldForIndex = () => chain(stringSym, optional(['ASC', 'DESC']))();

const fieldForIndexList = () => chain(fieldForIndex, many(',', fieldForIndex))();

// ----------------------------------- others -----------------------------------

const wordSym = () => chain(matchTokenType('word', { excludes: reserveKeys }))(ast => ast[0]);
const stringSym = () => chain(matchTokenType('string'))(ast => ast[0]);
const numberSym = () => chain(matchTokenType('number'))(ast => ast[0]);

const stringOrWord = () => chain([wordSym, stringSym])(ast => ast[0]);

const stringOrWordOrNumber = () => chain([wordSym, stringSym, numberChain])(ast => ast[0]);

const numberChain = () => chain(optional(['-', '+']), numberSym)();

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

export const sqlParser = createParser(root, sqlTokenizer);
