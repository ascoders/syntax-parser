import { Chain, chain, ChainNodeFactory, optional } from '../parser';

// Four operations ---------------------------------
export function createFourOperations(field: () => ChainNodeFactory) {
  const addExpr = () => chain(term, exprTail)();

  const exprTail = () => chain(optional(chain(addOp, term, exprTail)()))();

  const term = () => chain(factor, termTail)();

  const termTail = () => chain(optional(chain(mulOp, factor, termTail)()))();

  const mulOp = () => chain(['*', '/', '%', 'MOD', 'DIV'])(ast => ast[0]);

  const addOp = () => chain(['+', '-'])(ast => ast[0]);

  const factor = () => chain([chain('(', addExpr, ')')(ast => ast[1]), field])(ast => ast[0]);

  return addExpr;
}
