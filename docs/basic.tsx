import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { chain, createLexer, createParser, many, sqlParser } from '../src';
import { IMatching, IParseResult } from '../src/parser/define';
import { ICompletionItem, ITableInfo } from '../src/sql-parser/define';
import {
  findNearestStatement,
  findTableName,
  getCursorInfo,
  getFieldsFromStatement,
  ICursorInfo
} from '../src/sql-parser/reader';

const myLexer = createLexer([
  {
    type: 'whitespace',
    regexes: [/^(\s+)/],
    ignore: true
  },
  {
    type: 'word',
    regexes: [/^([a-zA-Z0-9]+)/] // 解析数字
  },
  {
    type: 'operator',
    regexes: [
      /^(\(|\))/, // 解析 ( )
      /^(,)/
    ]
  }
]);

const root = () => chain('select', many('a'))();

const myParser = createParser(
  root, // Root grammar.
  myLexer // Created in lexer example.
);

class Props {}

class State {}

const mockAsyncParser = async (text: string, index: number) => {
  return Promise.resolve().then(() => sqlParser(text, index));
};

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public componentDidMount() {
    setTimeout(() => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.create(ReactDOM.findDOMNode(this), {
        language: 'sql'
      });
      editor.layout({
        width: 1000,
        height: 500
      });

      editor.setValue(``);

      monacoSqlAutocomplete(monaco, editor, {
        onInputTableField: async tableName => {
          return Promise.resolve(
            ['aa', 'bb', 'cc']
              .map(
                eachName => _.get(tableName, 'namespace.value', '') + _.get(tableName, 'tableName.value', '') + eachName
              )
              .map(fieldName => ({
                label: fieldName,
                sortText: 'D' + fieldName,
                kind: monaco.languages.CompletionItemKind.Field
              }))
          );
        },
        onInputTableName: async () => {
          return Promise.resolve(
            ['dt', 'b2b', 'tmall'].map(each => ({
              label: each,
              sortText: 'D' + each,
              kind: monaco.languages.CompletionItemKind.Folder
            }))
          );
        },
        onHoverTableName: async cursorInfo => {
          return Promise.resolve([
            {
              value: `你 hover 在 ${cursorInfo.token.value}。类型是 ${cursorInfo.type}，表名：${_.get(
                cursorInfo,
                'tableInfo.tableName.value',
                ''
              )} 空间：${_.get(cursorInfo, 'tableInfo.namespace.value', '')}`
            }
          ]);
        },
        onHoverTableField: (fieldName, tableName) => {
          return Promise.resolve([
            {
              value: `你 hover 在 ${fieldName} 表名：${_.get(tableName, 'tableName.value', '')} 空间：${_.get(
                tableName,
                'namespace.value',
                ''
              )}`
            }
          ]);
        }
      });
    }, 2000);
  }

  public render() {
    return <div />;
  }
}

function monacoSqlAutocomplete(
  monaco: any,
  editor: any,
  opts: {
    onInputTableField: (tableName?: ITableInfo, inputValue?: string) => Promise<any>;
    onInputTableName: (inputValue?: string) => Promise<any>;
    onHoverTableName: (
      cursorInfo?: ICursorInfo<{
        tableInfo: ITableInfo;
      }>
    ) => Promise<any>;
    onHoverTableField: (fieldName?: string, tableName?: ITableInfo) => Promise<any>;
  }
) {
  // Get parser info and show error.
  let currentParserPromise: any = null;
  let editVersion = 0;

  editor.onDidChangeModelContent((event: any) => {
    editVersion++;
    const currentEditVersion = editVersion;

    currentParserPromise = new Promise(resolve => {
      setTimeout(() => {
        const model = editor.getModel();

        mockAsyncParser(editor.getValue(), model.getOffsetAt(editor.getPosition())).then(parseResult => {
          resolve(parseResult);

          if (currentEditVersion !== editVersion) {
            return;
          }

          if (parseResult.error) {
            const newReason =
              parseResult.error.reason === 'incomplete'
                ? `Incomplete, expect next input: \n${parseResult.error.suggestions
                    .map((each: any) => each.value)
                    .join('\n')}`
                : `Wrong input, expect: \n${parseResult.error.suggestions.map((each: any) => each.value).join('\n')}`;

            const errorPosition = parseResult.error.token
              ? {
                  startLineNumber: model.getPositionAt(parseResult.error.token.position[0]).lineNumber,
                  startColumn: model.getPositionAt(parseResult.error.token.position[0]).column,
                  endLineNumber: model.getPositionAt(parseResult.error.token.position[1]).lineNumber,
                  endColumn: model.getPositionAt(parseResult.error.token.position[1]).column + 1
                }
              : {
                  startLineNumber: 0,
                  startColumn: 0,
                  endLineNumber: 0,
                  endColumn: 0
                };

            model.getPositionAt(parseResult.error.token);

            monaco.editor.setModelMarkers(model, 'sql', [
              {
                ...errorPosition,
                message: newReason,
                severity: monaco.Severity.Error
              }
            ]);
          } else {
            monaco.editor.setModelMarkers(editor.getModel(), 'sql', []);
          }
        });
      });
    });
  });

  monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ' $.:{}=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    provideCompletionItems: async () => {
      const currentEditVersion = editVersion;
      const parseResult: IParseResult = await currentParserPromise;

      if (currentEditVersion !== editVersion) {
        return [];
      }

      const cursorInfo = await getCursorInfo(parseResult.ast, parseResult.cursorKeyPath);
      const cursorRootStatement = findNearestStatement(parseResult.ast, parseResult.cursorKeyPath);

      const parserSuggestion: ICompletionItem[] = parseResult.nextMatchings
        ? parseResult.nextMatchings
            .filter(matching => matching.type === 'string')
            .map(matching => ({
              label: matching.value as string,
              kind: monaco.languages.CompletionItemKind.Keyword,
              sortText: 'W' + matching.value
            }))
        : [];

      if (!cursorInfo) {
        return parserSuggestion;
      }

      switch (cursorInfo.type) {
        case 'tableField':
          const cursorRootStatementFields = await getFieldsFromStatement(
            cursorRootStatement,
            cursorInfo,
            opts.onInputTableField
          );

          return cursorRootStatementFields.concat(parserSuggestion);
        case 'tableName':
          const tableNames = await opts.onInputTableName(cursorInfo.token.value);
          return tableNames.concat(parserSuggestion);
        default:
          return parserSuggestion;
      }
    }
  });

  monaco.languages.registerHoverProvider('sql', {
    provideHover: async (model: any, position: any) => {
      const parseResult: IParseResult = await mockAsyncParser(editor.getValue(), model.getOffsetAt(position));

      const cursorInfo = await getCursorInfo(parseResult.ast, parseResult.cursorKeyPath);

      if (!cursorInfo) {
        return null as any;
      }

      let contents: any = [];

      switch (cursorInfo.type) {
        case 'tableField':
          const tableName = await findTableName(
            parseResult.ast,
            cursorInfo,
            opts.onInputTableField,
            parseResult.cursorKeyPath
          );
          contents = await opts.onHoverTableField(cursorInfo.token.value, tableName);
          break;
        case 'namespace':
        case 'tableName':
          contents = await opts.onHoverTableName(cursorInfo as ICursorInfo<{ tableInfo: ITableInfo }>);
          break;
        default:
      }

      return {
        range: monaco.Range.fromPositions(
          model.getPositionAt(cursorInfo.token.position[0]),
          model.getPositionAt(cursorInfo.token.position[1] + 1)
        ),
        contents
      };
    }
  });
}
