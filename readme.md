# cparser

Light and fast parser using javascript. Both in nodejs and broswer.

# Use for sql parser

```bash
npm i cparser
```

```typescript
import { parseSql } from 'cparser';

console.log(parseSql('select * from table;'));
```

# Use for custom parser

```typescript
import { chain, execChain, many, matchNumber, matchString, matchWord, optional, plus, Scanner } from 'cparser';

const root = () => chain('select', '*', 'from', 'table', ';')();

export const parse = (scanner: Scanner, cursorPosition = 0) => {
  return execChain(root, scanner, cursorPosition, ast => ast[0]);
};
```

# Tests

```bash
npm test
```
