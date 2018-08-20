import { Chain, chain, ChainNodeFactory, optional } from '../parser';

// Four operations ---------------------------------
export function createFourOperations(field: () => ChainNodeFactory) {
  function expr() {
    return chain(term, exprTail)();
  }

  function exprTail() {
    return chain(optional([chain('+', term, exprTail)(), chain('-', term, exprTail)]))();
  }

  function term() {
    return chain(factor, termTail)();
  }

  function termTail() {
    return chain(optional([chain('*', factor, termTail)(), chain('/', factor, termTail)()]))();
  }

  function factor() {
    return chain([chain('(', expr, ')')(), field])();
  }

  return expr;
}
