import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { sqlParser } from '../src';

class Props {}

class State {}

// test
const testSql = `
select 
	ccw                        
    ,ccd_ccd               
	,case when bc_type in (1,2) then '暗黑破坏神'
		  when bc_type = 0 then '暗黑破坏神' else 'null' end as bc_type
    ,substr(regexp_replace(create_time,'-',''),1,8) as date_id
    ,register_type
	,punish_status_id
from(
select *  
from cco_busi.dwd_tb_gm_visit_df
where 
ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')
)a 
left outer join(
select user_id as seller_id,ccd,bc_type from tbcdm.dim_tb_seller where ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')
)b 
on cast(a.user_id as bigint)= b.seller_id
`;

const result = sqlParser(testSql);
console.log(result);

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

      editor.onDidChangeModelContent((event: any) => {
        this.editVersion++;
        const currentEditVersion = this.editVersion;

        this.currentParserPromise = new Promise(resolve => {
          setTimeout(() => {
            const model = editor.getModel();

            mockAsyncParser(editor.getValue(), model.getOffsetAt(editor.getPosition()) - 1).then(astResult => {
              resolve(astResult);

              if (currentEditVersion !== this.editVersion) {
                return;
              }

              if (astResult.error) {
                const newReason =
                  astResult.error.reason === 'incomplete'
                    ? `Incomplete, expect next input: \n${astResult.error.suggestions
                        .map(each => each.value)
                        .join('\n')}`
                    : `Wrong input, expect: \n${astResult.error.suggestions.map(each => each.value).join('\n')}`;

                const errorPosition = astResult.error.token
                  ? {
                      startLineNumber: model.getPositionAt(astResult.error.token.position[0]).lineNumber,
                      startColumn: model.getPositionAt(astResult.error.token.position[0]).column,
                      endLineNumber: model.getPositionAt(astResult.error.token.position[1]).lineNumber,
                      endColumn: model.getPositionAt(astResult.error.token.position[1]).column + 1
                    }
                  : {
                      startLineNumber: 0,
                      startColumn: 0,
                      endLineNumber: 0,
                      endColumn: 0
                    };

                model.getPositionAt(astResult.error.token);

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
        // tslint:disable-next-line:no-invalid-template-strings
        triggerCharacters: ' ${}.:=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
        provideCompletionItems: async () => {
          const currentEditVersion = this.editVersion;
          const astResult = await this.currentParserPromise;

          if (currentEditVersion !== this.editVersion) {
            return [];
          }

          return astResult.nextMatchings.map((matching: any) => ({
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
