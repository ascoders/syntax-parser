import * as React from 'react';
import { chain, createLexer, createParser } from '../src';

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
    regexes: [
      /^(\(|\))/, // '(' ')'.
      /^(\+|\-)/ // operators for + -.
    ]
  }
]);

const root = () => chain(a)();

const a = () => chain('a')();

const myParser = createParser(
  root, // Root grammar.
  myLexer // Created in lexer example.
);

// tslint:disable-next-line:no-console
console.log(myParser('a'));
