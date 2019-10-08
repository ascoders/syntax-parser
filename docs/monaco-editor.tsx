/* eslint-disable no-multi-assign */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { monacoSqlAutocomplete } from '../src/demo/monaco-plugin';

class Props {
  //
}

class State {
  //
}

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();

  public state = new State();

  public root: any;

  public componentDidMount() {
    loadMonacoEditor().then((monaco: any) => {
      // eslint-disable-next-line react/no-find-dom-node
      const editor = monaco.editor.create(ReactDOM.findDOMNode(this.root), {
        value: [''].join('\n'),
        language: 'sql',
      });
      monacoSqlAutocomplete(monaco, editor);
    });
  }

  public render() {
    return (
      <div
        style={{ width: '100%', height: 600 }}
        ref={ref => {
          this.root = ref;
        }}
      />
    );
  }
}

function loadMonacoEditor() {
  return new Promise(resolve => {
    loadJs('https://unpkg.com/monaco-editor/min/vs/loader.js', () => {
      const { require } = window as any;

      require.config({ paths: { vs: 'https://unpkg.com/monaco-editor/min/vs' } });

      (window as any).MonacoEnvironment = {
        getWorkerUrl: () => {
          return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = {
            baseUrl: 'https://unpkg.com/monaco-editor/min/'
          };
          importScripts('https://unpkg.com/monaco-editor/min/vs/base/worker/workerMain.js');`)}`;
        },
      };

      // eslint-disable-next-line import/no-dynamic-require
      require(['vs/editor/editor.main'], (monaco: any) => {
        resolve(monaco);
      });
    });
  });
}

function loadJs(src: string, callback?: () => void) {
  const script: any = document.createElement('script');
  let loaded: boolean;
  script.setAttribute('src', src);
  if (callback) {
    script.onreadystatechange = script.onload = () => {
      if (!loaded) {
        callback();
      }
      loaded = true;
    };
  }
  document.getElementsByTagName('head')[0].appendChild(script);
}
