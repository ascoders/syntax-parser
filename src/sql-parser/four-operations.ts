import { Chain, chain, ChainNodeFactory, optional } from '../parser';

// Four operations ---------------------------------
export function createFourOperations(field: () => ChainNodeFactory) {


  // 四则运算
  function addExpr() {
    return chain(term, exprTail)();
  }

  function exprTail() {
    return chain(optional(chain(addOp, term, exprTail)()))();
  }

  function term() {
    return chain(factor, termTail)();
  }

  function termTail() {
    return chain(optional(chain(mulOp, factor, termTail)()))();
  }

  function mulOp() {
    return chain(['*', '/', '%', 'MOD', 'DIV'])(ast => ast[0]);
  }

  function addOp() {
    return chain(['+', '-'])(ast => ast[0]);
  }

  function factor() {
    return chain([chain('(', addExpr, ')')(ast => ast[1]), field])(ast => ast[0]);
  }

  return addExpr;
}
