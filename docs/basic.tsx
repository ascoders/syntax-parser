import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { sqlParser } from '../src';

class Props {}

class State {}

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

      monaco.languages.registerCompletionItemProvider('sql', {
        // tslint:disable-next-line:no-invalid-template-strings
        triggerCharacters: ' ${}.:=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
        provideCompletionItems: (model: any, position: any) => {
          const astResult = sqlParser(model.getValue(), model.getOffsetAt(position) - 1);

          if (astResult.error) {
            const newReason =
              astResult.error.reason === 'incomplete'
                ? `Incomplete, expect next input: \n${astResult.error.suggestions.map(each => each.value).join('\n')}`
                : `Wrong input, expect: \n${astResult.error.suggestions.map(each => each.value).join('\n')}`;

            const errorPosition = astResult.error.token
              ? {
                  startLineNumber: model.getPositionAt(astResult.error.token.position[0]).lineNumber,
                  startColumn: model.getPositionAt(astResult.error.token.position[0]).column,
                  endLineNumber: model.getPositionAt(astResult.error.token.position[1]).lineNumber,
                  endColumn: model.getPositionAt(astResult.error.token.position[1]).column
                }
              : {
                  startLineNumber: 0,
                  startColumn: 0,
                  endLineNumber: 0,
                  endColumn: 0
                };

            model.getPositionAt(astResult.error.token);

            monaco.editor.setModelMarkers(editor.getModel(), 'sql', [
              {
                ...errorPosition,
                message: newReason,
                severity: monaco.Severity.Error
              }
            ]);
          } else {
            monaco.editor.setModelMarkers(editor.getModel(), 'sql', []);
          }

          return astResult.nextMatchings.map(matching => ({
            label: matching.value
          }));
        }
      });
    }, 1000);
  }

  public render() {
    return <div />;
  }
}
