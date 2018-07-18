import { IToken } from '../lexer/interface';
import tokenTypes from '../lexer/token-types';
import { chainLine, chainLineTry, chainTree, chainTreeTry, execChain, IChain } from './chain';
import {
  matchAll,
  matchCloseParen,
  matchNumber,
  matchOpenParen,
  matchOperator,
  matchPlus,
  matchReserved,
  matchString,
  matchWord,
  matchWordOrString,
  matchWordOrStringOrNumber,
  skipAtLeastWhitespace,
  skipWhitespace
} from './match';
import { Scanner } from './scanner';

const unaryOperator = ['!', '~', '+', '-', 'NOT'];
const bitOperator = ['<<', '>>', '&', '^', '|'];
const mathOperator = ['*', '/', '%', 'DIV', 'MOD', '+', '-', '--'];

// <Statement> ::= <SelectStatement>
function statement(scanner: Scanner) {
  return chainTree(selectStatement(scanner));
}

// <SelectStatement> ::= SELECT [SelectList] FROM <TableList> WhereStatement?
function selectStatement(scanner: Scanner) {
  return () =>
    chainLine(
      skipWhitespace(scanner),
      matchReserved(scanner, 'select'),
      skipAtLeastWhitespace(scanner),
      selectList(scanner),
      skipAtLeastWhitespace(scanner),
      matchReserved(scanner, 'from'),
      skipAtLeastWhitespace(scanner),
      tableList(scanner),
      chainLineTry(skipAtLeastWhitespace(scanner), whereStatement(scanner)),
      skipWhitespace(scanner)
    );
}

// <SelectList> ::= <SelectField> ( , <SelectList> )?
function selectList(scanner: Scanner) {
  return (): IChain =>
    chainLine(
      skipWhitespace(scanner),
      selectField(scanner),
      chainLineTry(skipWhitespace(scanner), matchOperator(scanner, ','), skipWhitespace(scanner), selectList(scanner))
    );
}

// whereStatement ::= WHERE expression
function whereStatement(scanner: Scanner) {
  return () =>
    chainLine(
      skipWhitespace(scanner),
      matchReserved(scanner, 'where'),
      skipAtLeastWhitespace(scanner),
      expression(scanner)
    );
}

// selectField
//         ::= field alias?
//           | caseStatement alias?
//           | *
function selectField(scanner: Scanner) {
  return () =>
    chainTree(
      chainLine(skipWhitespace(scanner), field(scanner), chainLineTry(alias(scanner))),
      chainLine(skipWhitespace(scanner), caseStatement(scanner), chainLineTry(alias(scanner))),
      chainLine(skipWhitespace(scanner), matchOperator(scanner, '*'))
    );
}

// fieldList
//       ::= field (, fieldList)?
function fieldList(scanner: Scanner) {
  return (): IChain =>
    chainLine(
      skipWhitespace(scanner),
      field(scanner),
      chainLineTry(skipWhitespace(scanner), matchOperator(scanner, ','), skipWhitespace(scanner), fieldList(scanner))
    );
}

// <TableList> ::= <TableName> ( , <TableList> )?
function tableList(scanner: Scanner) {
  return (): IChain =>
    chainLine(
      skipWhitespace(scanner),
      tableName(scanner),
      chainLineTry(skipWhitespace(scanner), matchOperator(scanner, ','), skipWhitespace(scanner), tableList(scanner))
    );
}

// expression
//        ::= notOperator expression
//          | notOperator '(' expression ')'
//          | predicate logicalOperator expression
//          | '(' expression ')' logicalOperator '(' expression ')'
//          | predicate IS NOT? (TRUE | FALSE | UNKNOWN)
//          | predicate
function expression(scanner: Scanner) {
  return (): IChain =>
    chainLine(
      skipWhitespace(scanner),
      chainTree(
        chainLine(notOperator(scanner), skipAtLeastWhitespace(scanner), expression(scanner)),
        chainLine(
          notOperator(scanner),
          skipWhitespace(scanner),
          matchOpenParen(scanner, '('),
          skipWhitespace(scanner),
          expression(scanner),
          skipWhitespace(scanner),
          matchCloseParen(scanner, ')')
        ),
        chainLine(
          predicate(scanner),
          skipAtLeastWhitespace(scanner),
          logicalOperator(scanner),
          skipAtLeastWhitespace(scanner),
          expression(scanner)
        ),
        chainLine(
          matchOpenParen(scanner, '('),
          skipWhitespace(scanner),
          predicate(scanner),
          skipWhitespace(scanner),
          matchCloseParen(scanner, ')'),
          skipWhitespace(scanner),
          logicalOperator(scanner),
          skipWhitespace(scanner),
          matchOpenParen(scanner, '('),
          skipWhitespace(scanner),
          predicate(scanner),
          skipWhitespace(scanner),
          matchCloseParen(scanner, ')')
        ),
        chainLine(
          predicate(scanner),
          matchReserved(scanner, 'is'),
          chainLineTry(matchReserved(scanner, 'not')),
          chainTree(matchReserved(scanner, 'true'), matchReserved(scanner, 'false'), matchReserved(scanner, 'unknown'))
        ),
        predicate(scanner)
      )
    );
}

// predicate
//       ::= predicate NOT? IN '(' fieldList ')'
//         | left=predicate comparisonOperator right=predicate
//         | predicate NOT? BETWEEN predicate AND predicate
//         | predicate SOUNDS LIKE predicate
//         | predicate NOT? LIKE predicate (ESCAPE STRING_LITERAL)?
//         | field
function predicate(scanner: Scanner) {
  return (): IChain =>
    chainLine(
      skipWhitespace(scanner),
      chainTree(
        chainLine(
          field(scanner),
          chainLineTry(skipAtLeastWhitespace(scanner), matchReserved(scanner, 'not')),
          skipAtLeastWhitespace(scanner),
          matchReserved(scanner, 'in'),
          skipWhitespace(scanner),
          matchOpenParen(scanner, '('),
          skipWhitespace(scanner),
          fieldList(scanner),
          skipWhitespace(scanner),
          matchCloseParen(scanner, ')')
        ),
        chainLine(
          field(scanner),
          skipWhitespace(scanner),
          comparisonOperator(scanner),
          skipWhitespace(scanner),
          field(scanner)
        ),
        chainLine(
          field(scanner),
          chainLineTry(skipAtLeastWhitespace(scanner), matchReserved(scanner, 'not')),
          skipAtLeastWhitespace(scanner),
          matchReserved(scanner, 'between'),
          skipAtLeastWhitespace(scanner),
          predicate(scanner),
          skipAtLeastWhitespace(scanner),
          matchReserved(scanner, 'and'),
          skipAtLeastWhitespace(scanner),
          predicate(scanner)
        ),
        chainLine(field(scanner), skipAtLeastWhitespace(scanner), matchReserved(scanner, 'like'), stringMatch(scanner)),
        field(scanner)
      )
    );
}

// field
//   ::= <function>
//     | <number>
//     | <stringOrWord>.*
//     | <stringOrWord>.<stringOrWord>
//     | <stringOrWord>
function field(scanner: Scanner) {
  return () =>
    chainTree(
      functionMatch(scanner),
      numberMatch(scanner),
      chainLine(stringOrWordMatch(scanner), matchOperator(scanner, '.'), matchOperator(scanner, '*')),
      chainLine(stringOrWordMatch(scanner), matchOperator(scanner, '.'), stringOrWordMatch(scanner)),
      stringOrWordMatch(scanner)
    );
}

// TableName ::= WordOrString [Alias]
function tableName(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchWordOrString(scanner), chainLineTry(alias(scanner)));
}

// Alias ::= AS Word
//         | AS'String
//         | WordOrString
function alias(scanner: Scanner) {
  return () =>
    chainTree(
      chainLine(
        skipWhitespace(scanner),
        matchReserved(scanner, 'as'),
        chainTree(
          chainLine(skipAtLeastWhitespace(scanner), matchWord(scanner)),
          chainLine(skipWhitespace(scanner), matchString(scanner))
        )
      ),
      chainLine(skipWhitespace(scanner), matchWordOrString(scanner))
    );
}

// caseStatement
//           ::= CASE caseAlternative+ ELSE string END
function caseStatement(scanner: Scanner) {
  return () =>
    chainLine(
      skipWhitespace(scanner),
      matchOpenParen(scanner, 'case'),
      skipAtLeastWhitespace(scanner),
      matchPlus(scanner, caseAlternative(scanner)),
      skipAtLeastWhitespace(scanner),
      matchReserved(scanner, 'else'),
      skipAtLeastWhitespace(scanner),
      stringMatch(scanner),
      skipAtLeastWhitespace(scanner),
      matchCloseParen(scanner, 'end')
    );
}

// caseAlternative
//             ::= WHEN expression THEN string
function caseAlternative(scanner: Scanner) {
  return () =>
    chainLine(
      skipWhitespace(scanner),
      matchReserved(scanner, 'when'),
      skipAtLeastWhitespace(scanner),
      expression(scanner),
      skipAtLeastWhitespace(scanner),
      matchReserved(scanner, 'then'),
      skipAtLeastWhitespace(scanner),
      stringMatch(scanner)
    );
}

// <Word> ::= Word
function wordMatch(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchWord(scanner));
}

// <String> ::= String
function stringMatch(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchString(scanner));
}

function stringOrWordMatch(scanner: Scanner) {
  return () => chainTree(wordMatch(scanner), stringMatch(scanner));
}

// <Number> ::= Number
function numberMatch(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchNumber(scanner));
}

// <Function> ::= <Word>(<Number> | *)
function functionMatch(scanner: Scanner) {
  return () =>
    chainLine(
      skipWhitespace(scanner),
      wordMatch(scanner),
      matchOpenParen(scanner, '('),
      skipWhitespace(scanner),
      chainTree(numberMatch(scanner), matchOperator(scanner, '*')),
      skipWhitespace(scanner),
      matchCloseParen(scanner, ')')
    );
}

// <Constant> ::= Word | String | Integer
function constant(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchWordOrStringOrNumber(scanner));
}

function logicalOperator(scanner: Scanner) {
  return () => chainLine(matchReserved(scanner, ['and', '&&', 'xor', 'or', '||']));
}

function comparisonOperator(scanner: Scanner) {
  return () => chainLine(matchOperator(scanner, ['=', '>', '<', '<=', '>=', '<>', '!=', '<=>']));
}

function notOperator(scanner: Scanner) {
  return matchReserved(scanner, ['not', '!']);
}

export class AstParser {
  private scanner: Scanner;

  constructor(tokens: IToken[]) {
    this.scanner = new Scanner(tokens);
  }

  public parse = () => {
    const node = statement(this.scanner)();
    return execChain(node, this.scanner);
  };
}
