import { IToken } from '../lexer/token';
import {
  chain,
  ChainNode,
  execChain,
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
import { getAstFromArray, reversalAst } from './utils';

const root = () => chain(statements, optional(';'))(ast => ast[0]);

const statements = () => chain(statement, optional(';', statements))(binaryRecursionToArray);

function statement() {
  // TODO: , functionCall, caseExpression
  return chain([addExpression])(ast => ast[0]);
}

// --------------------- 四则运算 ----------------------------

const addExpression = () =>
  chain(mulExpression, many(['+', '-'], mulExpression))(ast => {
    return getAstFromArray(ast);
    // tslint:disable-next-line:no-console
    console.log('add', ast[1]);
    return ast;
  });

const mulExpression = () =>
  chain(mulFactor, many(['*', '/'], mulFactor))(ast => {
    return getAstFromArray(ast);
    // tslint:disable-next-line:no-console
    console.log('mul', ast[1]);
    return ast;
  });

const mulOperator = () => chain(['*', '/'])(ast => ast[0]);

const mulFactor = () =>
  chain([numberChain, functionCall, wordChain, chain('(', addExpression, ')')(ast => ast[1])])(ast => {
    // console.log('factor', ast[0]);
    return ast[0];
  });

// function addExpression() {
//   return createFourOperations(numberChain)();
// }

// --------------------- 比较式 ----------------------------
const compareExpression = () =>
  chain(addExpression, optional(compareOperator, addExpression))(ast => {
    if (!ast[1]) {
      return ast[0];
    }
    return { type: 'expression', variant: 'compare', operator: ast[1][0], left: ast[0], right: ast[1][1] };
  });

const compareOperator = () => chain(['>', '<', '<>', '!=', '=', '>=', '<='])(ast => ast[0]);

// --------------------- 逻辑表达式 ----------------------------

const andExpression = () =>
  chain(compareExpression, optional(andOperator, andExpression))(ast => {
    if (!ast[1]) {
      return ast[0];
    }
    return { type: 'expression', variant: 'compare', operator: ast[1][0], left: ast[1], right: ast[1][1] };
  });

const andOperator = () => chain(['AND', 'OR'])(ast => ast[0]);

// --------------------- 函数调用 ----------------------------

const functionCall = () =>
  chain(matchWord(), '(', [addExpression, caseExpression], ')')(ast => {
    return { type: 'expression', variant: 'functioncall', name: ast[0], arguments: ast[2] };
  });

// --------------------- case表达式 ----------------------------

const caseExpression = () => chain('case', optional(wordChain), plus(whenExpression), elseExpression, 'end')();

const whenExpression = () => chain('when', andExpression, 'then', [wordChain, numberChain, stringChain])();

const elseExpression = () => chain('else', [numberChain, stringChain, wordChain])();

// --------------------- terminals ----------------------------

// field
const wordChain = () => chain(matchWord())(ast => ast[0]);

// string
const stringChain = () => chain(matchString())(ast => ast[0]);

// number
const numberChain = () => chain(matchNumber())(ast => ast[0]);

class ExtendFieldParser {
  public rootChainNode: ChainNode;

  constructor() {
    this.rootChainNode = root()();
  }

  public parse = (tokens: IToken[], cursorPosition = 0) => {
    const scanner = new Scanner(tokens);
    return execChain(this.rootChainNode, scanner, cursorPosition, ast => ast[0]);
  };
}

export const parser = new ExtendFieldParser();
