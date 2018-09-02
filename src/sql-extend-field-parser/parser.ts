import { chain, createParser, many, matchTokenType, optional, plus } from '../parser';
import { binaryRecursionToArray } from '../parser/utils';
import { sqlTokenizer } from '../sql-parser/lexer';
import { getAstFromArray, reversalAst } from './utils';

const root = () => chain(statements, optional(';'))(ast => ast[0]);

const statements = () => chain(statement, optional(';', statements))(binaryRecursionToArray);

const statement = () => chain([addExpression, functionCall, caseExpression])(ast => ast[0]);

// --------------------- four arithmetic operations  ----------------------------

const addExpression = () =>
  chain(mulExpression, many(['+', '-'], mulExpression))(ast => {
    return getAstFromArray(ast);
  });

const mulExpression = () =>
  chain(mulFactor, many(['*', '/'], mulFactor))(ast => {
    return getAstFromArray(ast);
  });

const mulFactor = () =>
  chain([
    matchTokenType('number'),
    functionCall,
    matchTokenType('word'),
    chain('(', addExpression, ')')(ast => ast[1])
  ])(ast => {
    return ast[0];
  });

// --------------------- compare expression ----------------------------
const compareExpression = () =>
  chain(addExpression, optional(compareOperator, addExpression))(ast => {
    if (!ast[1]) {
      return ast[0];
    }
    return { type: 'expression', variant: 'compare', operator: ast[1][0], left: ast[0], right: ast[1][1] };
  });

const compareOperator = () => chain(['>', '<', '<>', '!=', '=', '>=', '<='])(ast => ast[0]);

// --------------------- logical expression ----------------------------

const logicalExpression = () =>
  chain(compareExpression, optional(andOperator, logicalExpression))(ast => {
    if (!ast[1]) {
      return ast[0];
    }
    return { type: 'expression', variant: 'compare', operator: ast[1][0], left: ast[1], right: ast[1][1] };
  });

const andOperator = () => chain(['and', 'or'])(ast => ast[0]);

// --------------------- function call ----------------------------

const functionCall = () =>
  chain(matchTokenType('word'), '(', [addExpression, caseExpression], ')')(ast => {
    return { type: 'expression', variant: 'functioncall', name: ast[0], arguments: ast[2] };
  });

// --------------------- case expression ----------------------------

const caseExpression = () =>
  chain('case', optional(matchTokenType('word')), plus(whenExpression), elseExpression, 'end')();

const whenExpression = () =>
  chain('when', logicalExpression, 'then', [
    matchTokenType('word'),
    matchTokenType('number'),
    matchTokenType('string')
  ])();

const elseExpression = () =>
  chain('else', [matchTokenType('number'), matchTokenType('string'), matchTokenType('word')])();

export const parser = createParser(root, sqlTokenizer);
