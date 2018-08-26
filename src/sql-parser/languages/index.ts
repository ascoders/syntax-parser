import { Tokenizer } from '../../lexer';
import { IToken } from '../../lexer/token';
import { blink } from './blink';
import { fbi } from './fbi';
import { Language } from './Language';
import { normal } from './normal';

export type TokenizerFactory = (text: string) => IToken[];

export const sqlTokenizer: TokenizerFactory = sqlText => {
  const tokenizer = new Tokenizer(fbi);
  return tokenizer.tokenize(sqlText);
};
