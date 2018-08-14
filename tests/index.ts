import test from 'ava';
import * as fs from 'fs';
import * as path from 'path';
import { SQLAstParser, tokenConfig, Tokenizer } from '../src';

const sqlTests: Array<{
  groupName: string;
  childs: Array<{
    name: string;
    content: string;
  }>;
}> = [];

const sqlGroups = fs.readdirSync(path.join(__dirname, '../../tests/sqls'));
sqlGroups.forEach(sqlGroup => {
  const sqlTest = { groupName: sqlGroup, childs: [] as any };
  sqlTests.push(sqlTest);

  const eachSqlNames = fs.readdirSync(path.join(__dirname, '../../tests/sqls', sqlGroup));
  eachSqlNames.forEach(eachSqlName => {
    if (!eachSqlName.endsWith('.sql')) {
      return;
    }

    const sqlContent = fs.readFileSync(path.join(__dirname, '../../tests/sqls', sqlGroup, eachSqlName)).toString();
    const sqlDetail = {
      name: eachSqlName,
      content: sqlContent
    };
    sqlTest.childs.push(sqlDetail);
  });
});

const parser = new SQLAstParser();

sqlTests.forEach(sqlTest => {
  sqlTest.childs.forEach(eachTest => {
    test(`${sqlTest.groupName}.${eachTest.name}`, t => {
      const tokenizer = new Tokenizer(tokenConfig);
      const tokens = tokenizer.tokenize(eachTest.content);
      const result = parser.parse(tokens);

      if (!result.success) {
        // tslint:disable-next-line:no-console
        // console.log('tokens');
        // tslint:disable-next-line:no-console
        // console.log(tokens);
      }

      t.true(result.success);
    });
  });
});
