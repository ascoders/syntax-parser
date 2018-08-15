import { ChainNode, IChain, optional } from '../parser';

// Four operations ---------------------------------
export function createFourOperations(field: (chain: IChain) => ChainNode) {
  const expr = (chain: IChain) => chain(term, exprTail)();

  const exprTail = (chain: IChain) => chain(optional([chain('+', term, exprTail)(), chain('-', term, exprTail)]))();

  const term = (chain: IChain) => chain(factor, termTail)();

  const termTail = (chain: IChain) =>
    chain(optional([chain('*', factor, termTail)(), chain('/', factor, termTail)()]))();

  const factor = (chain: IChain) => chain([chain('(', expr, ')')(), field])();

  return expr;
}
