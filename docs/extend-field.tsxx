import * as React from 'react';
import { tokenConfig, Tokenizer } from '../src/sql';
import { parser } from '../src/sql-extend-field-parser';

class Props {}

class State {}

function parseExtendFieldString(str: string, offset: number) {
  const startTime = new Date();
  const tokenizer = new Tokenizer(tokenConfig);
  const tokens = tokenizer.tokenize(str);
  // tslint:disable-next-line:no-console
  console.log(tokens);
  const endTime1 = new Date();
  const result = parser.parse(tokens, offset);
  const endTime2 = new Date();

  // tslint:disable-next-line:no-console
  console.log('lexer time', endTime1.getTime() - startTime.getTime(), 'ms');
  // tslint:disable-next-line:no-console
  console.log('parser time', endTime2.getTime() - endTime1.getTime(), 'ms');
  // tslint:disable-next-line:no-console
  console.log('result', result);

  if (!result.success) {
    // tslint:disable-next-line:no-console
    console.log('error tokens', tokens);
  }
}

parseExtendFieldString(`1 + (2 * 3) + (4 * 5) + (6 * 7) + (8 + 9)`, 100);

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public render() {
    return <div>123123</div>;
  }
}
