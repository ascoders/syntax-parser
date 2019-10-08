/* eslint-disable no-use-before-define */
import * as React from 'react';
import { chain, createLexer, createParser, many, matchTokenType } from '../src';

class Props {}

class State {}

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();

  public state = new State();

  public render() {
    return <div />;
  }
}

const myLexer = createLexer([
  {
    type: 'whitespace',
    regexes: [/^(\s+)/],
    ignore: true,
  },
  {
    type: 'word',
    regexes: [/^([a-zA-Z0-9]+)/],
  },
  {
    type: 'operator',
    regexes: [/^(\+)/],
  },
]);

const root = () => {
  return chain(addExpr)(ast => {
    return ast[0];
  });
};

const addExpr = () => {
  return chain(matchTokenType('word'), many(addPlus))(ast => {
    return {
      left: ast[0].value,
      operator: ast[1] && ast[1][0].operator,
      right: ast[1] && ast[1][0].term,
    };
  });
};

const addPlus = () => {
  return chain(['+', '-'], root)(ast => {
    return {
      operator: ast[0].value,
      term: ast[1],
    };
  });
};

const myParser = createParser(
  root, // Root grammar.
  myLexer, // Created in lexer example.
);

// eslint-disable-next-line no-console
console.log(myParser('a + b'));
