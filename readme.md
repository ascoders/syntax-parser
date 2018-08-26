# cparser

cparser is a parser using pure javascript, so it can both run in browser and nodejs.

It supports:

- standard parser.
- custom sql parser.
- sql parser.

## Using for standard parser

TODO.

## Using for custom sql parser

```typescript
import { chain, matchWord, createParser, sqlTokenizer } from 'cparser';

const root = () => chain('select', matchWord, 'from', matchWord, ';')();

export const sqlParse = createParser(root, sqlTokenizer);
```

And use `parse` to parse sql string:

```typescript
const result = sqlParse('select name from table_name;');
console.log(result); // {success, ast, error, nextMatchings}
```

## Using for sql parser

```bash
npm i cparser
```

```typescript
import { parseSql } from 'cparser';

console.log(parseSql('select * from table;'));
```

## Tests

```bash
npm test
```
