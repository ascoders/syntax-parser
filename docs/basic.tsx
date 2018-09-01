import * as React from 'react';
import { sqlParser } from '../src';

class Props {}

class State {}

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public componentDidMount() {
    function parse(str: string) {
      // tslint:disable-next-line:no-console
      console.log('sql:', str);
      // tslint:disable-next-line:no-console
      console.log(sqlParser(str, 10000));
    }

    parse(`
        SELECT *
    FROM bananas
    WHERE 1!=2 AND color != 'blue' OR pees = crackers
        `);
  }

  public render() {
    return <div />;
  }
}
