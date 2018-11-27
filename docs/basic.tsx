import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { IMatching, IParseResult } from 'src/parser/define';
import { chain, createLexer, createParser, many, sqlParser } from '../src';
import { findNearestStatement, getCursorInfo, getFieldsFromStatement } from '../src/sql-parser/reader';

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

  private currentParserPromise: any = null;
  private editVersion = 0;

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

      editor.setValue(`select aaa from (select sdf from fdg) qq`);

      editor.onDidChangeModelContent((event: any) => {
        this.editVersion++;
        const currentEditVersion = this.editVersion;

        this.currentParserPromise = new Promise(resolve => {
          setTimeout(() => {
            const model = editor.getModel();

            mockAsyncParser(editor.getValue(), model.getOffsetAt(editor.getPosition())).then(parseResult => {
              resolve(parseResult);

              if (currentEditVersion !== this.editVersion) {
                return;
              }

              if (parseResult.error) {
                const newReason =
                  parseResult.error.reason === 'incomplete'
                    ? `Incomplete, expect next input: \n${parseResult.error.suggestions
                        .map((each: any) => each.value)
                        .join('\n')}`
                    : `Wrong input, expect: \n${parseResult.error.suggestions
                        .map((each: any) => each.value)
                        .join('\n')}`;

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
          const currentEditVersion = this.editVersion;
          const parseResult: IParseResult = await this.currentParserPromise;

          if (currentEditVersion !== this.editVersion) {
            return [];
          }

          const cursorInfo = getCursorInfo(parseResult.ast, parseResult.cursorKeyPath);
          const cursorRootStatement = findNearestStatement(parseResult.ast, parseResult.cursorKeyPath);

          const parserSuggestion = parseResult.nextMatchings
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
              const cursorRootStatementFields = await getFieldsFromStatement(cursorRootStatement, tableName =>
                Promise.resolve(['aa', 'bb', 'cc'].map(eachName => tableName + '.' + eachName))
              );
              return cursorRootStatementFields
                .map(cursorRootStatementField => ({
                  label: cursorRootStatementField,
                  sortText: 'D' + cursorRootStatementField,
                  kind: monaco.languages.CompletionItemKind.Field
                }))
                .concat(parserSuggestion);
            case 'tableName':
              return ['dt', 'b2b', 'tmall']
                .map(each => ({ label: each, sortText: 'D' + each, kind: monaco.languages.CompletionItemKind.Folder }))
                .concat(parserSuggestion);
            default:
              return parserSuggestion;
          }
        }
      });
    }, 2000);
  }

  public render() {
    return <div />;
  }
}
