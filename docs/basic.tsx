import * as React from 'react';
import { AstParser, tokenConfig, Tokenizer } from '../src';

class Props {}

class State {}

// function parse(str: string) {
//   const startTime = new Date();
//   const tokenizer = new Tokenizer(tokenConfig);
//   const tokens = tokenizer.tokenize(str);
//   const result = new AstParser(tokens).parse();
//   const endTime = new Date();

//   console.log('time', endTime.getTime() - startTime.getTime(), 'ms');
//   console.log('result', result);

//   if (!result) {
//     console.log('tokens', tokens);
//   }
// }

// parse(`
// SELECT *
// FROM bananas
// WHERE 1 != 2 AND color != 'blue' OR pees = crackers
// `);

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public render() {
    return <div>123123</div>;
  }
}
