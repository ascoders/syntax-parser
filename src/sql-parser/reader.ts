import * as _ from 'lodash';
import { IToken } from '../lexer/token';
import { ICompletionItem, IFrom, ISelectStatement, ISource, IStatement, IStatements, ITableInfo } from './define';

type CursorType = 'tableField' | 'tableName' | 'namespace' | 'functionName';

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
        } else {
          return null;
        }
      case 'function':
        return {
          type: 'functionName',
          token: cursorValue
        };
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
      return getFieldsByFromClauses(_.get(statement, 'from.sources', []), cursorInfo, getFieldsByTableName);
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
        const itFromStatement = fromStatement as ISource;
        let originFields = await getFieldsByTableName(itFromStatement.name, cursorInfo.token.value);
        originFields = originFields.map(originField => {
          return {
            ...originField,
            tableInfo: itFromStatement.name,
            originFieldName: originField.label
          };
        });
        return originFields;
      case 'statement.select':
        const ssFromStatement = fromStatement as ISelectStatement;
        const fields = await getFieldsByFromClauses(ssFromStatement.from.sources, cursorInfo, getFieldsByTableName);

        // If select *, return all fields
        if (ssFromStatement.result.length === 1 && ssFromStatement.result[0].name.value === '*') {
          return fields;
        }

        return fields
          .map(field => {
            const selectedField = ssFromStatement.result.find(result => result.name.value === field.label);
            if (!selectedField) {
              return null;
            }

            if (selectedField.alias) {
              return {
                ...field,
                label: selectedField.alias.value
              };
            }
            return field;
          })
          .filter(field => field !== null);
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

  if (statement.variant) {
    return callback(statement.type + '.' + statement.variant);
  } else {
    return callback(statement.type);
  }
}

export async function findFieldExtraInfo(
  rootStatement: IStatements,
  cursorInfo: ICursorInfo,
  getFieldsByTableName: IGetFieldsByTableName,
  fieldKeyPath: string[]
): Promise<ICompletionItem> {
  const fieldStatement = findNearestStatement(rootStatement, fieldKeyPath);
  const fields = await getFieldsFromStatement(fieldStatement, cursorInfo, getFieldsByTableName);
  const field = fields.find(eachField => eachField.label === cursorInfo.token.value);

  if (!field) {
    return null;
  }

  return field;
}
