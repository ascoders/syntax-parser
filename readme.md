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

const root = () =>
  chain('select', field, 'from', matchWord, ';')(ast => ({
    type: 'selectStatement',
    result: ast[1],
    from: ast[3]
  }));

const field = () => chain(matchWord)();

export const mySqlParse = createParser(root, sqlTokenizer);
```

And use `parse` to parse sql string:

```typescript
const result = mySqlParse('select name from table_name;');
console.log(result); // {success, ast, error, nextMatchings}

// Or get suggestions from index.
const resultWithSuggestions = mySqlParse('select name from table_name;', 12);
                                                      ^
                                                      12
console.log(resultWithSuggestions) // { nextMatchings: ['from'] }
```

## Using for sql parser

`sqlParse` is a built-in case, it's easy to build your custom sql parser, but for easy to use, we provide one.

```bash
npm i cparser
```

```typescript
import { sqlParse } from 'cparser';

console.log(sqlParse('select * from table;'));
```

## Tests

```bash
npm test
```
