import { fbi } from './sql-parser/languages/fbi';

export const tokenConfig = fbi;
import { Tokenizer } from './lexer';
import { Scanner } from './parser';
import { parse } from './sql-parser';

export const parseSql = (sqlText: string, language: string = 'default', cursorIndex = 0) => {
  const tokenizer = new Tokenizer(tokenConfig);
  const tokens = tokenizer.tokenize(sqlText);
  const scanner = new Scanner(tokens);
  return parse(scanner, cursorIndex);
};
