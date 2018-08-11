import { Language } from './Language';

const validateText = `[a-zA-Z0-9_\u4e00-\u9fa5]`;

export const fbi = new Language({
  wordChars: [`\\$\\{${validateText}+\\}`]
});
