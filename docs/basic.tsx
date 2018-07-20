import * as React from 'react';
import { AstParser, tokenConfig, Tokenizer } from '../src';

class Props {}

class State {}

// function parse(str: string) {
//   const startTime = new Date();
//   const tokenizer = new Tokenizer(tokenConfig);
//   const tokens = tokenizer.tokenize(str);
//   const endTime1 = new Date();
//   const result = new AstParser(tokens).parse();
//   const endTime2 = new Date();

//   console.log('lexer time', endTime1.getTime() - startTime.getTime(), 'ms');
//   console.log('parser time', endTime2.getTime() - endTime1.getTime(), 'ms');
//   console.log('result', result);

//   if (!result) {
//     console.log('tokens', tokens);
//   }
// }

// parse(
//   Array.from(Array(1000))
//     .map(
//       () => `
// select intersects inid, innot notin
// from fromson nots
// where colorwhere IN (nots.pon)
// `
//     )
//     .join(';')
// );

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public render() {
    return <div>123123</div>;
  }
}
