import { chain, ChainFunction, optional } from '../parser';

// Four operations ---------------------------------
export function createFourOperations(field: ChainFunction) {
  const addExpr = () => chain(term, exprTail)(ast => ast[0]);

  const exprTail = () => chain(optional(addOp, term, exprTail))();

  const term = () => chain(factor, termTail)(ast => ast[0]);

  const termTail = () => chain(optional(mulOp, factor, termTail))();

  const mulOp = () => chain(['*', '/', '%'])(ast => ast[0]);

  const addOp = () => chain(['+', '-'])(ast => ast[0]);

  const factor = () => chain([chain('(', addExpr, ')')(ast => ast[1]), field])(ast => ast[0]);

  return addExpr;
}
