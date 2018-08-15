import * as React from 'react';
import { SQLAstParser, tokenConfig, Tokenizer } from '../src';

class Props {}

class State {}

const parser = new SQLAstParser();

function parse(str: string) {
  const startTime = new Date();
  const tokenizer = new Tokenizer(tokenConfig);
  const tokens = tokenizer.tokenize(str);
  const endTime1 = new Date();
  const result = parser.parse(tokens, 100);
  const endTime2 = new Date();

  // tslint:disable-next-line:no-console
  console.log('lexer time', endTime1.getTime() - startTime.getTime(), 'ms');
  // tslint:disable-next-line:no-console
  console.log('parser time', endTime2.getTime() - endTime1.getTime(), 'ms');
  // tslint:disable-next-line:no-console
  console.log('result', result);

  if (!result.success) {
    // tslint:disable-next-line:no-console
    console.log('error tokens', tokens);
  }
}

parse(`
SELECT TABLE0.日期, TABLE0.总取件量, TABLE1.App取件量,concat(round(TABLE1.App取件量/TABLE0.总取件量 * 100,2),'%') as App占比
FROM 
    (SELECT COUNT(DISTINCT(ope.fulfil_task_id)) AS 总取件量,
         to_char(ope.gmt_create, 'yyyy-mm-dd') AS 日期
    FROM cnods.s_td_operation_delta ope
    WHERE ope.oper_code = 'courierArrive'
    GROUP BY  to_char(ope.gmt_create,'yyyy-mm-dd') ) TABLE0
LEFT JOIN 
    (SELECT COUNT(DISTINCT(ope.fulfil_task_id)) AS App取件量,
         to_char(ope.gmt_create, 'yyyy-mm-dd') AS 日期_1
    FROM cnods.s_td_operation_delta ope
    WHERE ope.oper_code = 'courierArrive'
            AND get_json_object(ope.app_client_info, '$.pkgName') = '菜鸟包裹侠'
    GROUP BY  to_char(ope.gmt_create,'yyyy-mm-dd') ) TABLE1
ON TABLE0.日期 = TABLE1.日期_1
ORDER BY TABLE0.日期
`);

// ---喵供_货单
// select substr(t1.ds,1,6) ds,t1.cate_level1_name,t1.hdj as 货单价_打标商品,t2.hdj_hy 货单价_行业,t1.hdj/t1.hdj_365-1 as 同比增幅_打标商品
// 	,t2.hdj_hy/t2.hdj_hy_365-1 as 同比增幅_行业
// from youpin_item_cjzh t1
// join hy_cjzh t2
// on (t1.ds=t2.ds and t1.cate_level1_name=t2.cate_level1_name)
// where substr(t1.ds,1,6)>=\${bizdate1} and substr(t1.ds,1,6)<=\${bizdate2}
// 	and substr(t2.ds,1,6)>=\${bizdate1} and substr(t2.ds,1,6)<=\${bizdate2}
// 	and t1.market<>'喵住'

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public render() {
    return <div>123123</div>;
  }
}
