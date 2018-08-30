import { Tokenizer } from '../../lexer';
import { IToken } from '../../lexer/token';
import { Language } from './language';

export type TokenizerFactory = (text: string) => IToken[];

export const sqlTokenizer: TokenizerFactory = sqlText => {
  const tokenizer = new Tokenizer(new Language());
  return tokenizer.tokenize(sqlText);
};
