import * as React from 'react';
import { parseSql } from '../src';

class Props {}

class State {}

function parse(str: string) {
  const startTime = new Date();
  const result = parseSql(str, 'bif', 100);
  const endTime = new Date();

  // tslint:disable-next-line:no-console
  console.log('sql:', str);
  // tslint:disable-next-line:no-console
  console.log('parser time', endTime.getTime() - startTime.getTime(), 'ms', ', result', result);
}

parse(`
select x from foo where (a or b) and c;
select x from foo where a or b and c

`);

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public render() {
    return <div>123123</div>;
  }
}
