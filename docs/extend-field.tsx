import * as React from 'react';
import { sqlParse } from '../src';

class Props {}

class State {}

function parseExtendFieldString(str: string, offset: number) {
  const startTime = new Date();
  const result = sqlParse(str, offset);
  const endTime = new Date();

  // tslint:disable-next-line:no-console
  console.log('lexer time', endTime.getTime() - startTime.getTime(), 'ms', ', result', result);
}

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public componentDidMount() {
    parseExtendFieldString(`1 + (2 * 3) + (4 * 5) + (6 * 7) + (8 + 9)`, 100);
  }

  public render() {
    return <div>123123</div>;
  }
}
