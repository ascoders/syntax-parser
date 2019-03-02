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
    ignore: true
  },
  {
    type: 'word',
    regexes: [/^([a-zA-Z0-9]+)/]
  },
  {
    type: 'operator',
    regexes: [/^(\+)/]
  }
]);

const root = () => chain(addExpr)(ast => ast[0]);

const addExpr = () =>
  chain(matchTokenType('word'), many(addPlus))(ast => ({
    left: ast[0].value,
    operator: ast[1] && ast[1][0].operator,
    right: ast[1] && ast[1][0].term
  }));

const addPlus = () =>
  chain(['+', '-'], root)(ast => ({
    operator: ast[0].value,
    term: ast[1]
  }));

const myParser = createParser(
  root, // Root grammar.
  myLexer // Created in lexer example.
);

// tslint:disable-next-line:no-console
console.log(myParser('a + b'));
