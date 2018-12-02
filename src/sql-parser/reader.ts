import * as _ from 'lodash';
import { IToken } from '../lexer/token';
import { ICompletionItem, IFrom, ISelectStatement, IStatement, IStatements, ITableInfo } from './define';

type CursorType = 'tableField' | 'tableName' | 'namespace';

export type ICursorInfo<T = {}> = {
  token: IToken;
  type: CursorType;
} & T;

type IGetFieldsByTableName = (tableName: ITableInfo, inputValue: string) => Promise<ICompletionItem[]>;

export async function getCursorInfo(rootStatement: IStatements, keyPath: string[]) {
  if (!rootStatement) {
    return null;
  }

  const cursorValue: IToken = _.get(rootStatement, keyPath);
  const cursorKey = keyPath.slice().pop();
  const parentStatement = _.get(rootStatement, keyPath.slice(0, keyPath.length - 1));

  if (!parentStatement) {
    return null;
  }

  return (await judgeStatement(parentStatement, async typePlusVariant => {
    switch (typePlusVariant) {
      case 'identifier.tableName':
        if (cursorKey === 'tableName') {
          return {
            type: 'tableName',
            token: cursorValue,
            tableInfo: parentStatement
          };
        } else if (cursorKey === 'namespace') {
          return {
            type: 'namespace',
            token: cursorValue,
            tableInfo: parentStatement
          };
        }

      case 'identifier.column':
        if (cursorKey === 'name') {
          return {
            type: 'tableField',
            token: cursorValue
          };
        }
      default:
    }
  })) as ICursorInfo;
}

export function findNearestStatement(rootStatement: IStatements, keyPath: string[]): ISelectStatement {
  if (!rootStatement) {
    return null;
  }

  if (keyPath.length === 0) {
    return null;
  }

  const value = _.get(rootStatement, keyPath);

  if (!value) {
    throw Error('Path not found from ast!');
  }

  if (!value.token && value.type === 'statement') {
    return value;
  }

  if (keyPath.length > 1) {
    return findNearestStatement(rootStatement, keyPath.slice(0, keyPath.length - 1));
  } else {
    return null;
  }
}

export async function getFieldsFromStatement(
  statement: ISelectStatement,
  cursorInfo: ICursorInfo,
  getFieldsByTableName: IGetFieldsByTableName
) {
  if (!statement) {
    return [];
  }

  switch (statement.variant) {
    // Select statement
    case 'select':
      return getFieldsByFromClauses(_.get(statement, 'from', []), cursorInfo, getFieldsByTableName);
    default:
  }

  return [];
}

async function getFieldsByFromClauses(
  fromStatements: IStatement[],
  cursorInfo: ICursorInfo,
  getFieldsByTableName: IGetFieldsByTableName
): Promise<ICompletionItem[]> {
  const fields = await Promise.all(
    fromStatements.map(fromStatement => getFieldsByFromClause(fromStatement, cursorInfo, getFieldsByTableName))
  );
  return _.flatten(fields).filter(item => !!item);
}

async function getFieldsByFromClause(
  fromStatement: IStatement,
  cursorInfo: ICursorInfo,
  getFieldsByTableName: IGetFieldsByTableName
) {
  return judgeStatement(fromStatement, async typePlusVariant => {
    switch (typePlusVariant) {
      case 'identifier.table':
        const itFromStatement = fromStatement as IFrom;
        const originFields = await getFieldsByTableName(itFromStatement.name, cursorInfo.token.value);
        originFields.forEach(originField => (originField.tableName = itFromStatement.name));
        return originFields;
      case 'statement.select':
        const ssFromStatement = fromStatement as ISelectStatement;
        const fields = await getFieldsByFromClauses(ssFromStatement.from, cursorInfo, getFieldsByTableName);

        // If select *, return all fields
        if (ssFromStatement.result.length === 1 && ssFromStatement.result[0].name.value === '*') {
          return fields;
        }

        return fields.filter(field => ssFromStatement.result.find(result => result.name.value === field.label));
      default:
        return null;
    }
  });
}

async function judgeStatement<T>(
  statement: IStatement,
  callback: (typePlusVariant?: string) => Promise<T>
): Promise<T> {
  if (!statement) {
    return null;
  }

  return callback(statement.type + '.' + statement.variant);
}

export async function findTableName(
  rootStatement: IStatements,
  cursorInfo: ICursorInfo,
  getFieldsByTableName: IGetFieldsByTableName,
  fieldKeyPath: string[]
): Promise<ITableInfo> {
  const fieldStatement = findNearestStatement(rootStatement, fieldKeyPath);
  const fields = await getFieldsFromStatement(fieldStatement, cursorInfo, getFieldsByTableName);

  const field = fields.find(eachField => eachField.label === cursorInfo.token.value);

  if (!field) {
    return null;
  }

  return field.tableName;
}
