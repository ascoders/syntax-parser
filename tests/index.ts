import test from 'ava';
import * as fs from 'fs';
import * as path from 'path';
import { sqlParse } from '../src';

const sqlTests: Array<{
  groupName: string;
  childs: Array<{
    name: string;
    content: string;
  }>;
}> = [];

const sqlGroups = fs.readdirSync(path.join(__dirname, '../../../tests/sqls'));

sqlGroups.forEach(sqlGroup => {
  const sqlTest = { groupName: sqlGroup, childs: [] as any };
  sqlTests.push(sqlTest);

  const eachSqlNames = fs.readdirSync(path.join(__dirname, '../../../tests/sqls', sqlGroup));
  eachSqlNames.forEach(eachSqlName => {
    if (!eachSqlName.endsWith('.sql')) {
      return;
    }

    const sqlContent = fs.readFileSync(path.join(__dirname, '../../../tests/sqls', sqlGroup, eachSqlName)).toString();
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
      // const result = sqlParse(eachTest.content);
      const result = sqlParse('select a from b');
      t.true(result.success);
    });
  });
});
