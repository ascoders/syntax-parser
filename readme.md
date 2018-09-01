# cparser

cparser is a parser using pure javascript, so it can both run in browser and nodejs.

It supports:

- lexer.
- parser.

## Lexer

```typescript
import { Lexer } from 'cparser';

const myLexer = createLexer([
  {
    type: 'whitespace',
    regexes: [/^(\s+)/],
    ignore: true
  },
  {
    type: 'word',
    regexes: [/^([a-zA-Z0-9]+)/]
  },
  {
    type: 'operator',
    regexes: [
      /^(\(|\))/, // '(' ')'.
      /^(\+|\-|\*|\/)/ // operators.
    ]
  }
]);
```

**type**

`Token` type name, you can use any value here, and you will use it in the parser stage.

**regexes**

Regexes that use to be matched for each `Token` type.

**ignore**

The matching `Token` will not be added to the `Token` result queue.

In general, whitespace can be ignored in syntax parsing.

### Example

```typescript
const tokens = myLexer('a + b - (c*d)');

// tokens:
// [
//   { "type": "word", "value": "a", "position": [0, 1] },
//   { "type": "operator", "value": "+", "position": [2, 3] },
//   { "type": "word", "value": "b", "position": [4, 5] },
//   { "type": "operator", "value": "-", "position": [6, 7] },
//   { "type": "operator", "value": "(", "position": [8, 9] },
//   { "type": "word", "value": "c", "position": [9, 10] },
//   { "type": "operator", "value": "*", "position": [10, 11] },
//   { "type": "word", "value": "d", "position": [11, 12] },
//   { "type": "operator", "value": ")", "position": [12, 13] }
// ]
```

## Parser

## Built-in language

### Sql

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
