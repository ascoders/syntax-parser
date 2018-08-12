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
  const result = parser.parse(tokens, 20);
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
INSERT INTO test_dwi_pub_hbd_slr_dtr_002 SELECT
  concat_ws(
    '\u0004',
    concat(
      SUBSTRING(md5(concat(shop_id, '111111')), 1, 4),
      ':md5'
    ),
    '93206:app',
    concat('ddd:', stat_date)
  ) as rowkey,
  count(1) as pv,
  COUNT(DISTINCT visitor_id) as uv,
  COUNT(
    DISTINCT CASE
      WHEN url_type = 'ipv' THEN visitor_id
      ELSE NULL
    END
  ) AS ipv FROM (
    SELECT
      stat_date,
      stat_hour,
      visitor_id,
      url_shop as shop_id,
      url_type,
      DateFormatChangeWithZone(stat_date, 'yyyyMMdd', 'yyyyMMdd') as tmp FROM dwd_log_aplus_shop_ri union ALL SELECT
      stat_date,
      stat_hour,
      visitor_id,
      shop_id,
      url_type,
      DateFormatChangeWithZone(stat_date, 'yyyyMMdd', 'yyyyMMdd') as tmp FROM
      dwd_log_usertrack_shop_ri
  ) t
group by
  concat_ws(
    '\u0004',
    concat(
      SUBSTRING(md5(concat(shop_id, '111111')), 1, 4),
      ':md5'
    ),
    '93206:app',
    concat('ddd:', stat_date)
  ) ;
`);

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public render() {
    return <div>123123</div>;
  }
}
