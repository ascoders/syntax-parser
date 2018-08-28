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
      const result = sqlParse(str, 10000);
      const endTime = new Date();

      // tslint:disable-next-line:no-console
      console.log('sql:', str);
      // tslint:disable-next-line:no-console
      console.log('parser time', endTime.getTime() - startTime.getTime(), 'ms', ', result', result);
    }

    parse(`
    SELECT TABLE0.日期, TABLE0.总取件量, TABLE1.App取件量,concat(round(TABLE1.App取件量/TABLE0.总取件量 * 100,2),'%') as App占比
FROM 
    (SELECT COUNT(DISTINCT(ope.fulfil_task_id)) AS 总取件量,
         to_char(ope.gmt_create, 'yyyy-mm-dd') AS 日期
    FROM cnods.s_td_operation_delta ope
    WHERE ope.oper_code = 'courierArrive'
    GROUP BY  to_char(ope.gmt_create
    `);
  }

  public render() {
    return <div />;
  }
}
