import { IToken } from '../lexer/interface';
import tokenTypes from '../lexer/token-types';
import { createChainNodeFactory, execChain, IChain, IChainNodeFactory } from './chain';
import { match, matchNumber, matchString, matchWord, optional, plus } from './match';
import { Scanner } from './scanner';

const unaryOperator = ['!', '~', '+', '-', 'NOT'];
const bitOperator = ['<<', '>>', '&', '^', '|'];
const mathOperator = ['*', '/', '%', 'DIV', 'MOD', '+', '-', '--'];

const root = (chain: IChain) => chain(statement, optional(plus(';', statement)));

const statement = (chain: IChain) => chain([selectStatement]);

const selectStatement = (chain: IChain) => chain('select', selectList, 'from', tableList, optional(whereStatement));

// selectList ::= selectField ( , selectList )?
const selectList = (chain: IChain) => chain(selectField, optional(',', selectList));

// whereStatement ::= WHERE expression
const whereStatement = (chain: IChain) => chain('where', expression);

// selectField
//         ::= field alias?
//           | caseStatement alias?
//           | *
const selectField = (chain: IChain) =>
  chain([chain(field, optional(alias)), chain(caseStatement, optional(alias)), '*']);

// fieldList
//       ::= field (, fieldList)?
const fieldList = (chain: IChain) => chain(field, optional(',', fieldList));

// tableList ::= tableName ( , tableList )?
const tableList = (chain: IChain) => chain(tableName, optional(',', tableList));

// expression
//        ::= notOperator expression
//          | notOperator '(' expression ')'
//          | predicate logicalOperator expression
//          | '(' expression ')' logicalOperator '(' expression ')'
//          | predicate IS NOT? (TRUE | FALSE | UNKNOWN)
//          | predicate
const expression = (chain: IChain) =>
  chain([
    chain(notOperator, expression),
    chain(notOperator, '(', expression, ')'),
    chain(predicate, logicalOperator, expression),
    chain('(', expression, ')', logicalOperator, '(', expression, ')'),
    chain(predicate, 'is', optional('not'), ['true', 'fasle', 'unknown']),
    predicate
  ]);

// predicate
//       ::= predicate NOT? IN '(' fieldList ')'
//         | left=predicate comparisonOperator right=predicate
//         | predicate NOT? BETWEEN predicate AND predicate
//         | predicate SOUNDS LIKE predicate
//         | predicate NOT? LIKE predicate (ESCAPE STRING_LITERAL)?
//         | field
const predicate = (chain: IChain) =>
  chain([
    chain(fieldList, optional('not'), 'in', '(', fieldList, ')'),
    chain(fieldList, comparisonOperator, field),
    chain(fieldList, optional('not'), 'between', predicate, 'and', predicate),
    chain(fieldList, 'like', stringChain),
    field
  ]);

// field
//   ::= <function>
//     | <number>
//     | <stringOrWord>.*
//     | <stringOrWord>.<stringOrWord>
//     | <stringOrWord>
const field = (chain: IChain) =>
  chain([
    functionChain,
    numberChain,
    chain(stringOrWord, '.', '*'),
    chain(stringOrWord, '.', stringOrWord),
    stringOrWord
  ]);

// tableName ::= wordOrString alias?
const tableName = (chain: IChain) => chain(stringOrWord, optional(alias));

// Alias ::= AS WordOrString
//         | WordOrString
const alias = (chain: IChain) => chain([chain('as', stringOrWord), stringOrWord]);

// caseStatement
//           ::= CASE caseAlternative+ ELSE string END
const caseStatement = (chain: IChain) => chain('case', plus(caseAlternative), 'else', stringChain, 'end');

// caseAlternative
//             ::= WHEN expression THEN string
const caseAlternative = (chain: IChain) => chain('when', expression, 'then', stringChain);

const wordChain = (chain: IChain) => chain(matchWord());

const stringChain = (chain: IChain) => chain(matchString());

const numberChain = (chain: IChain) => chain(matchNumber());

const stringOrWord = (chain: IChain) => chain([wordChain, stringChain]);

// function ::= word '(' number | * ')'
const functionChain = (chain: IChain) => chain(wordChain, '(', [numberChain, '*'], ')');

const logicalOperator = (chain: IChain) => chain(match(['and', '&&', 'xor', 'or', '||']));

const comparisonOperator = (chain: IChain) => chain(match(['=', '>', '<', '<=', '>=', '<>', '!=', '<=>']));

const notOperator = (chain: IChain) => chain(match(['not', '!']));

export class AstParser {
  private scanner: Scanner;

  constructor(tokens: IToken[]) {
    this.scanner = new Scanner(tokens);
  }

  public parse = () => {
    const chainNodeFactory = createChainNodeFactory(this.scanner);
    const chainNode = chainNodeFactory(root);
    return execChain(chainNode, this.scanner);
  };
}
