import { IToken } from '../lexer/token';
import {
  chain,
  ChainNode,
  ChainNodeFactory,
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

function root() {
  return chain(statements, optional(';'))(ast => ast[0]);
}

function statements() {
  return chain(statement, optional(';', statements))(binaryRecursionToArray);
}

function statement() {
  // TODO: , functionCall, caseExpression
  return chain([addExpression])(ast => ast[0]);
}

// --------------------- 四则运算 ----------------------------

function addExpression() {
  return chain(mulExpression, many(['+', '-'], mulExpression))(ast => {
    return getAstFromArray(ast);
    // tslint:disable-next-line:no-console
    console.log('add', ast[1]);
    return ast;
  });
}

function mulExpression() {
  return chain(mulFactor, many(['*', '/'], mulFactor))(ast => {
    return getAstFromArray(ast);
    // tslint:disable-next-line:no-console
    console.log('mul', ast[1]);
    return ast;
  });
}

function mulOperator() {
  return chain(['*', '/'])(ast => ast[0]);
}

function mulFactor() {
  return chain([numberChain, functionCall, wordChain, chain('(', addExpression, ')')(ast => ast[1])])(ast => {
    // console.log('factor', ast[0]);
    return ast[0];
  });
}

// function addExpression() {
//   return createFourOperations(numberChain)();
// }

// --------------------- 比较式 ----------------------------
function compareExpression() {
  return chain(addExpression, optional(compareOperator, addExpression))(ast => {
    if (!ast[1]) {
      return ast[0];
    }
    return { type: 'expression', variant: 'compare', operator: ast[1][0], left: ast[0], right: ast[1][1] };
  });
}

function compareOperator() {
  return chain(['>', '<', '<>', '!=', '=', '>=', '<='])(ast => ast[0]);
}

// --------------------- 逻辑表达式 ----------------------------

function andExpression() {
  return chain(compareExpression, optional(andOperator, andExpression))(ast => {
    if (!ast[1]) {
      return ast[0];
    }
    return { type: 'expression', variant: 'compare', operator: ast[1][0], left: ast[1], right: ast[1][1] };
  });
}

function andOperator() {
  return chain(['AND', 'OR'])(ast => ast[0]);
}

// --------------------- 函数调用 ----------------------------

function functionCall() {
  return chain(matchWord(), '(', [addExpression, caseExpression], ')')(ast => {
    
    return { type: 'expression', variant: 'functioncall', name: ast[0], arguments: ast[2] };
  });
}

// --------------------- case表达式 ----------------------------

function caseExpression() {
  return chain('case', optional(wordChain), plus(whenExpression), elseExpression, 'end')();
}

function whenExpression() {
  return chain('when', andExpression, 'then', [wordChain, numberChain, stringChain])();
}

function elseExpression() {
  return chain('else', [numberChain, stringChain, wordChain])();
}

// --------------------- terminals ----------------------------

// field
function wordChain() {
  return chain(matchWord())(ast => ast[0]);
}

// string
function stringChain() {
  return chain(matchString())(ast => ast[0]);
}

// number
function numberChain() {
  return chain(matchNumber())(ast => ast[0]);
}

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
