import { IToken } from '../lexer/token';

export type IStatements = IStatement[];

export interface IStatement {
  type: 'statement' | 'identifier';
  variant: string;
}

export interface ISelectStatement extends IStatement {
  from: IFrom;
  result: IResult[];
}

export interface IResult extends IStatement {
  name: IToken;
  alias: IToken;
}

export interface IFrom extends IStatement {
  sources: ISource[];
  where?: any;
  group?: any;
  having?: any;
}

export interface ISource extends IStatement {
  name: ITableInfo & IStatement;
  alias: IToken;
}

export interface ITableInfo {
  tableName: IToken;
  namespace: IToken;
}

export interface ICompletionItem {
  label: string;
  kind: string;
  sortText: string;
  tableInfo?: ITableInfo;
  originFieldName?: string;
}
