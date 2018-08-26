import * as React from 'react';
import { sqlParse } from '../src';

class Props {}

class State {}

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public componentDidMount() {
    function parse(str: string) {
      const startTime = new Date();
      const result = sqlParse(str, 100);
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
  }

  public render() {
    return <div />;
  }
}
