import * as React from 'react';
import { SQLAstParser, tokenConfig, Tokenizer } from '../src';

class Props {}

class State {}

const parser = new SQLAstParser();

function parse(str: string) {
  const startTime = new Date();
  const tokenizer = new Tokenizer(tokenConfig);
  const tokens = tokenizer.tokenize(str);
  const endTime1 = new Date();
  const result = parser.parse(tokens, 20);
  const endTime2 = new Date();

  // tslint:disable-next-line:no-console
  console.log('lexer time', endTime1.getTime() - startTime.getTime(), 'ms');
  // tslint:disable-next-line:no-console
  console.log('parser time', endTime2.getTime() - endTime1.getTime(), 'ms');
  // tslint:disable-next-line:no-console
  console.log('result', result);

  if (!result) {
    // tslint:disable-next-line:no-console
    console.log('tokens', tokens);
  }
}

parse(`
select a from b;
`);

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public render() {
    return <div>123123</div>;
  }
}
