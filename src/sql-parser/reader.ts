import * as _ from 'lodash';
import { IToken } from '../lexer/token';
import { IFrom, ISelectStatement, IStatement, IStatements } from './define';

type CursorType = 'tableField' | 'tableName';

type IGetFieldsByTableName = (tableName: string) => Promise<any>;

export function getCursorInfo(rootStatement: IStatements, keyPath: string[]) {
  if (!rootStatement) {
    return null;
  }

  const cursorValue: IToken = _.get(rootStatement, keyPath);
  const cursorKey = keyPath.slice().pop();
  const parentStatement = _.get(rootStatement, keyPath.slice(0, keyPath.length - 1));

  if (!parentStatement) {
    return null;
  }

  return judgeStatement(parentStatement, typePlusVariant => {
    let cursorType: CursorType = null;
    switch (typePlusVariant) {
      case 'identifier.table':
        if (cursorKey === 'name') {
          cursorType = 'tableName';
        }
        break;
      case 'identifier.column':
        if (cursorKey === 'name') {
          cursorType = 'tableField';
        }
        break;
      default:
    }
    return {
      type: cursorType,
      value: cursorValue.value
    };
  }) as {
    value: string;
    type: CursorType;
  };
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

export async function getFieldsFromStatement(statement: ISelectStatement, getFieldsByTableName: IGetFieldsByTableName) {
  if (!statement) {
    return null;
  }

  switch (statement.variant) {
    // Select statement
    case 'select':
      const from: IFrom[] = _.get(statement, 'from', []);
      return _.flatten(await Promise.all(from.map(source => getFieldsByFromClause(source, getFieldsByTableName))));
    default:
  }
}

async function getFieldsByFromClause(fromStatement: IFrom, getFieldsByTableName: IGetFieldsByTableName) {
  return judgeStatement(fromStatement, typePlusVariant => {
    switch (typePlusVariant) {
      case 'identifier.table':
        return getFieldsByTableName(fromStatement.name.value);
    }
  });
}

function judgeStatement<T>(statement: IStatement, callback: (typePlusVariant?: string) => T): T {
  if (!statement) {
    return null;
  }

  return callback(statement.type + '.' + statement.variant);
}
