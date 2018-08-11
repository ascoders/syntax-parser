import { normal } from './sql-parser/languages';

export const tokenConfig = normal;
export { Tokenizer } from './lexer';
export { SQLAstParser } from './sql-parser';
