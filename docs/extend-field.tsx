import * as React from 'react';
import { parser } from '../src/sql-extend-field-parser';

class Props {}

class State {}

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public componentDidMount() {
    function parse(str: string, index: number) {
      // tslint:disable-next-line:no-console
      // tslint:disable-next-line:no-console
      console.log(parser(str, index));
    }

    parse(`1 + (2 * 3) + (4 * 5) + (6 * 7) + (8 + 9)`, 100);
  }

  public render() {
    return <div>123123</div>;
  }
}
