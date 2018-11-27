import { IToken } from '../lexer/token';

export type IStatements = IStatement[];

export interface IStatement {
  type: 'statement' | 'identifier';
  variant: string;
}

export interface ISelectStatement extends IStatement {
  from: IFrom[];
  result: IResult[];
}

export interface IResult {}

export interface IFrom extends IStatement {
  name: IToken;
  alias: IToken;
}
