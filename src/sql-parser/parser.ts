import { chain, createParser, many, matchTokenType, optional, plus } from '../parser';
import { IStatements } from './define';
import { createFourOperations } from './four-operations';
import { sqlTokenizer } from './lexer';
import { reserveKeys } from './reserve-keys';
import { flattenAll } from './utils';

const root = () => chain(statements, optional(';'))(ast => ast[0]);

const statements = () => chain(statement, many(chain(';', statement)(ast => ast[1])))(flattenAll);

const statement = () =>
  chain([
    selectStatement,
    createTableStatement,
    insertStatement,
    createViewStatement,
    setStatement,
    createIndexStatement,
    createFunctionStatement
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
  chain('from', tableSources, optional(whereStatement), optional(groupByStatement), optional(havingStatement))(ast =>
    // TODO: Ignore where group having
    ({
      sources: ast[1],
      where: ast[2],
      group: ast[3],
      having: ast[4]
    })
  );

const selectList = () => chain(selectField, many(selectListTail))(flattenAll);

const selectListTail = () => chain(',', selectField)(ast => ast[1]);

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
    )(ast => ({
      type: 'identifier',
      variant: 'column',
      name: ast[1],
      alias: ast[2]
    })),
    '*'
  ])(ast => ast[0]);

const whereStatement = () => chain('where', expression)(ast => ast[1]);

// fieldList
//       ::= field (, fieldList)?
const fieldList = () => chain(columnField, many(',', columnField))();

const tableSources = () => chain(tableSource, many(chain(',', tableSource)(ast => ast[1])))(flattenAll);

const tableSource = () =>
  chain(tableSourceItem, many(joinPart))(
    ast =>
      // TODO: Ignore join
      ast[0]
  );

const tableSourceItem = () =>
  chain([
    chain(tableName, optional(alias))(ast => ({
      type: 'identifier',
      variant: 'table',
      name: ast[0],
      alias: ast[1]
    })),
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
const alias = () => chain([chain('as', stringOrWord)(ast => ast[1]), stringOrWord])(ast => ast[0]);

// ----------------------------------- Create table statement -----------------------------------
const createTableStatement = () =>
  chain('create', 'table', stringOrWord, '(', tableOptions, ')', optional(withStatement))();

const withStatement = () => chain('with', '(', withStatements, ')')();

const withStatements = () => chain(withStatementsTail, many(',', withStatementsTail))();

const withStatementsTail = () => chain(wordSym, '=', stringSym)();

const tableOptions = () => chain(tableOption, many(',', tableOption))();

const tableOption = () =>
  chain([
    chain(stringOrWord, dataType)(),
    chain('primary', 'key', '(', primaryKeyList, ')')(),
    chain('period', 'for', 'system_time')()
  ])();

const primaryKeyList = () => chain(wordSym, optional(',', primaryKeyList))();

const tableName = () =>
  chain(
    [chain(wordSym)(), chain(wordSym, '.', wordSym)(ast => [ast[0], ast[2]])],
    optional(chain('for', 'system_time', 'as', 'of', 'proctime', '(', ')')())
  )(ast => {
    if (ast[0].length === 1) {
      return {
        type: 'identifier',
        variant: 'tableName',
        namespace: null,
        tableName: ast[0][0]
      };
    } else {
      return {
        type: 'identifier',
        variant: 'tableName',
        namespace: ast[0][0],
        tableName: ast[0][1]
      };
    }
  });

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

const partitionByClause = () => chain([wordSym, chain('partition', 'by', expression)()])(ast => ast);

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
const functionChain = () => chain([castFunction, normalFunction, ifFunction])(ast => ast[0]);

const ifFunction = () =>
  chain('if', '(', predicate, ',', field, ',', field, ')')(ast => ({
    type: 'function',
    name: 'if',
    args: [ast[2], ast[4], ast[6]]
  }));

const castFunction = () =>
  chain('cast', '(', fieldItem, 'as', dataType, ')')(ast => ({
    type: 'function',
    name: 'cast',
    args: [ast[2], ast[4]]
  }));

const normalFunction = () =>
  chain(wordSym, '(', optional(functionFields), ')')(ast => ({
    type: 'function',
    name: ast[0],
    args: ast[2]
  }));

const functionFields = () => chain(functionFieldItem, many(',', functionFieldItem))();

const functionFieldItem = () =>
  chain(many(selectSpec), [columnField, caseStatement])(ast => {
    return ast;
  });

// ----------------------------------- Case -----------------------------------
const caseStatement = () =>
  chain('case', plus(caseAlternative), optional('else', [stringOrWordOrNumber, 'null']), [
    'end',
    chain('end', 'as', wordSym)()
  ])();

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
  chain(predicate, many(['isnull', chain([chain('is', 'not')(), 'is', 'not'], ['null', columnField])()]))(); // TODO:

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
    columnField,
    optional([chain(comparisonOperator, columnField)(), chain('sounds', 'like', columnField)(), isOrNotExpression])
  )();

const columnField = () =>
  chain(field)(ast => ({
    type: 'identifier',
    variant: 'column',
    name: ast[0]
  }));

const isOrNotExpression = () =>
  chain(optional('is'), optional('not'), [
    chain('in', '(', fieldList, ')')(),
    chain('between', field, 'and', predicate)(),
    chain('like', field, optional('escape', field))(),
    chain('regexp', field)()
  ])();

const fieldItem = () =>
  chain(fieldItemDetail, many(normalOperator, fieldItem))(ast => {
    if (!ast[1]) {
      return ast[0];
    }
    return [ast[0], ast[1]];
  });

const fieldItemDetail = () =>
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

// ----------------------------------- create function expression -----------------------------------
const createFunctionStatement = () => chain('create', 'function', wordSym, 'as', stringSym)();

// ----------------------------------- others -----------------------------------

const wordSym = () =>
  chain([matchTokenType('cursor'), matchTokenType('word', { excludes: reserveKeys })])(ast => ast[0]);
const stringSym = () => chain(matchTokenType('string'))(ast => ast[0]);
const numberSym = () => chain(matchTokenType('number'))(ast => ast[0]);

const stringOrWord = () => chain([wordSym, stringSym])(ast => ast[0]);

const stringOrWordOrNumber = () => chain([wordSym, stringSym, numberChain])(ast => ast[0]);

const numberChain = () => chain(optional(['-', '+']), numberSym)();

const logicalOperator = () => chain(['and', '&&', 'xor', 'or', '||'])(ast => ast[0]);

const normalOperator = () => chain(['&&', '||'])(ast => ast[0]);

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

export const sqlParser = createParser<IStatements>(root, sqlTokenizer);
