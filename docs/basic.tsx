import * as _ from 'lodash';
import * as React from 'react';
import { chain, createLexer, createParser, many, matchTokenType, optional, sqlParser } from '../src';

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
      /^(\+|\-|\*|\/)/ // operators for + -.
    ]
  }
]);

const root = () => chain(term, many(addOp, term))(parseTermAst);

const term = () => chain(factor, many(mulOp, factor))(parseTermAst);

const mulOp = () => chain(['*', '/'])(ast => ast[0].value);

const addOp = () => chain(['+', '-'])(ast => ast[0].value);

const factor = () =>
  chain([chain('(', root, ')')(ast => ast[1]), chain(matchTokenType('word'))(ast => ast[0].value)])(ast => ast[0]);

const parseTermAst = (ast: any) =>
  ast[1]
    ? ast[1].reduce(
        (obj: any, next: any) =>
          next[0]
            ? {
                operator: next[0],
                left: obj || ast[0],
                right: next[1]
              }
            : {
                operator: next[1].operator,
                left: obj || ast[0],
                right: next[1].right
              },
        null
      )
    : ast[0];

const myParser = createParser(
  root, // Root grammar.
  myLexer // Created in lexer example.
);
const result = myParser('1', 10);

// tslint:disable-next-line:no-console
console.log(JSON.stringify(result.nextMatchings, null, 2));

class Props {}

class State {}

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public componentDidMount() {
    function parse(str: string) {
      // tslint:disable-next-line:no-console
      // console.log('sql:', str);
      // tslint:disable-next-line:no-console
      // console.log(sqlParser(str, 10000));
    }

    // parse(`
    //     SELECT *
    // FROM bananas
    // WHERE 1!=2 AND color != 'blue' OR pees = crackers
    //     `);
  }

  public render() {
    return <div />;
  }
}
