import { IToken } from '../lexer/token';
import {
  chain,
  ChainNode,
  createParser,
  many,
  matchNumber,
  matchString,
  matchWord,
  optional,
  plus,
  Scanner
} from '../parser';
import { binaryRecursionToArray } from '../parser/utils';
import { createFourOperations } from '../sql-parser/four-operations';
import { sqlTokenizer } from '../sql-parser/languages';
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

const mulOperator = () => chain(['*', '/'])(ast => ast[0]);

const mulFactor = () =>
  chain([numberChain, functionCall, wordChain, chain('(', addExpression, ')')(ast => ast[1])])(ast => {
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

const andOperator = () => chain(['AND', 'OR'])(ast => ast[0]);

// --------------------- function call ----------------------------

const functionCall = () =>
  chain(matchWord, '(', [addExpression, caseExpression], ')')(ast => {
    return { type: 'expression', variant: 'functioncall', name: ast[0], arguments: ast[2] };
  });

// --------------------- case expression ----------------------------

const caseExpression = () => chain('case', optional(wordChain), plus(whenExpression), elseExpression, 'end')();

const whenExpression = () => chain('when', logicalExpression, 'then', [wordChain, numberChain, stringChain])();

const elseExpression = () => chain('else', [numberChain, stringChain, wordChain])();

// --------------------- terminals ----------------------------

// field
const wordChain = () => chain(matchWord)(ast => ast[0]);

// string
const stringChain = () => chain(matchString)(ast => ast[0]);

// number
const numberChain = () => chain(matchNumber)(ast => ast[0]);

export const parser = createParser(root, sqlTokenizer);
