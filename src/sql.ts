import { fbi } from './sql-parser/languages/fbi';

export const tokenConfig = fbi;
export { Tokenizer } from './lexer';
export { SQLAstParser } from './sql-parser';
