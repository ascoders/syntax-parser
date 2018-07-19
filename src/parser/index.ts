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
  matchWordOrStringOrNumber
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
      matchReserved(scanner, 'select'),
      selectList(scanner),
      matchReserved(scanner, 'from'),
      tableList(scanner),
      chainLineTry(whereStatement(scanner))
    );
}

// <SelectList> ::= <SelectField> ( , <SelectList> )?
function selectList(scanner: Scanner) {
  return (): IChain => chainLine(selectField(scanner), chainLineTry(matchOperator(scanner, ','), selectList(scanner)));
}

// whereStatement ::= WHERE expression
function whereStatement(scanner: Scanner) {
  return () => chainLine(matchReserved(scanner, 'where'), expression(scanner));
}

// selectField
//         ::= field alias?
//           | caseStatement alias?
//           | *
function selectField(scanner: Scanner) {
  return () =>
    chainTree(
      chainLine(field(scanner), chainLineTry(alias(scanner))),
      chainLine(caseStatement(scanner), chainLineTry(alias(scanner))),
      matchOperator(scanner, '*')
    );
}

// fieldList
//       ::= field (, fieldList)?
function fieldList(scanner: Scanner) {
  return (): IChain => chainLine(field(scanner), chainLineTry(matchOperator(scanner, ','), fieldList(scanner)));
}

// <TableList> ::= <TableName> ( , <TableList> )?
function tableList(scanner: Scanner) {
  return (): IChain => chainLine(tableName(scanner), chainLineTry(matchOperator(scanner, ','), tableList(scanner)));
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
      chainTree(
        chainLine(notOperator(scanner), expression(scanner)),
        chainLine(
          notOperator(scanner),
          matchOpenParen(scanner, '('),
          expression(scanner),
          matchCloseParen(scanner, ')')
        ),
        chainLine(predicate(scanner), logicalOperator(scanner), expression(scanner)),
        chainLine(
          matchOpenParen(scanner, '('),
          predicate(scanner),
          matchCloseParen(scanner, ')'),
          logicalOperator(scanner),
          matchOpenParen(scanner, '('),
          predicate(scanner),
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
      chainTree(
        chainLine(
          field(scanner),
          chainLineTry(matchReserved(scanner, 'not')),
          matchReserved(scanner, 'in'),
          matchOpenParen(scanner, '('),
          fieldList(scanner),
          matchCloseParen(scanner, ')')
        ),
        chainLine(field(scanner), comparisonOperator(scanner), field(scanner)),
        chainLine(
          field(scanner),
          chainLineTry(matchReserved(scanner, 'not')),
          matchReserved(scanner, 'between'),
          predicate(scanner),
          matchReserved(scanner, 'and'),
          predicate(scanner)
        ),
        chainLine(field(scanner), matchReserved(scanner, 'like'), stringMatch(scanner)),
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
  return () => chainLine(matchWordOrString(scanner), chainLineTry(alias(scanner)));
}

// Alias ::= AS Word
//         | AS'String
//         | WordOrString
function alias(scanner: Scanner) {
  return () =>
    chainTree(
      chainLine(
        matchReserved(scanner, 'as'),
        chainTree(chainLine(matchWord(scanner)), chainLine(matchString(scanner)))
      ),
      chainLine(matchWordOrString(scanner))
    );
}

// caseStatement
//           ::= CASE caseAlternative+ ELSE string END
function caseStatement(scanner: Scanner) {
  return () =>
    chainLine(
      matchOpenParen(scanner, 'case'),
      matchPlus(scanner, caseAlternative(scanner)),
      matchReserved(scanner, 'else'),
      stringMatch(scanner),
      matchCloseParen(scanner, 'end')
    );
}

// caseAlternative
//             ::= WHEN expression THEN string
function caseAlternative(scanner: Scanner) {
  return () =>
    chainLine(
      matchReserved(scanner, 'when'),
      expression(scanner),
      matchReserved(scanner, 'then'),
      stringMatch(scanner)
    );
}

// <Word> ::= Word
function wordMatch(scanner: Scanner) {
  return () => chainLine(matchWord(scanner));
}

// <String> ::= String
function stringMatch(scanner: Scanner) {
  return () => chainLine(matchString(scanner));
}

function stringOrWordMatch(scanner: Scanner) {
  return () => chainTree(wordMatch(scanner), stringMatch(scanner));
}

// <Number> ::= Number
function numberMatch(scanner: Scanner) {
  return () => chainLine(matchNumber(scanner));
}

// <Function> ::= <Word>(<Number> | *)
function functionMatch(scanner: Scanner) {
  return () =>
    chainLine(
      wordMatch(scanner),
      matchOpenParen(scanner, '('),
      chainTree(numberMatch(scanner), matchOperator(scanner, '*')),
      matchCloseParen(scanner, ')')
    );
}

// <Constant> ::= Word | String | Integer
function constant(scanner: Scanner) {
  return () => chainLine(matchWordOrStringOrNumber(scanner));
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
