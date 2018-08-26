import * as React from 'react';
import { parseSql } from '../src';

class Props {}

class State {}

function parse(str: string) {
  const startTime = new Date();
  const result = parseSql(str, 'bif', 100);
  const endTime = new Date();

  // tslint:disable-next-line:no-console
  console.log('parser time', endTime.getTime() - startTime.getTime(), 'ms', ', result', result);
}

parse(`
/* select id from Movies where id in
 * (select movie_id from Rooms where seats > 75);
 * SELECT 1; /* select id from Movies where id in
 * (select movie_id from Rooms where seats > 75);
 * /*
 * nested block comment -- here is another one
 * /* another nest level
 * and this
 *
 * some more stuff here
 */

select movie_id
 -- FROM Movies
 -- WHERE seats != 0
from Rooms -- unicorn
AS hat
   -- comments!
where seats > 75 -- happy birthday

;SELECT 2 FROM -- comments
hats
`);

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public render() {
    return <div>123123</div>;
  }
}
