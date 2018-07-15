import test from 'ava';
import * as fs from 'fs';
import * as path from 'path';
import { AstParser, tokenConfig, Tokenizer } from '../src';

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

sqlTests.forEach(sqlTest => {
  sqlTest.childs.forEach(eachTest => {
    test(`${sqlTest.groupName}.${eachTest.name}`, t => {
      t.true(true);
      const tokenizer = new Tokenizer(tokenConfig);
      const tokens = tokenizer.tokenize(eachTest.content);
      const result = new AstParser(tokens).parse();

      if (!result) {
        console.log('tokens');
        console.log(tokens);
      }

      t.true(result);
    });
  });
});
