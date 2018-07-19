import { IToken } from '../lexer/interface';
import tokenTypes from '../lexer/token-types';
import { chainLine, chainLineTry, chainTree, chainTreeTry, execChain, IChain } from './chain';
import {
  match,
  matchNumber,
  matchPlus,
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
      match(scanner, 'select'),
      selectList(scanner),
      match(scanner, 'from'),
      tableList(scanner),
      chainLineTry(whereStatement(scanner))
    );
}

// <SelectList> ::= <SelectField> ( , <SelectList> )?
function selectList(scanner: Scanner) {
  return (): IChain => chainLine(selectField(scanner), chainLineTry(match(scanner, ','), selectList(scanner)));
}

// whereStatement ::= WHERE expression
function whereStatement(scanner: Scanner) {
  return () => chainLine(match(scanner, 'where'), expression(scanner));
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
      match(scanner, '*')
    );
}

// fieldList
//       ::= field (, fieldList)?
function fieldList(scanner: Scanner) {
  return (): IChain => chainLine(field(scanner), chainLineTry(match(scanner, ','), fieldList(scanner)));
}

// <TableList> ::= <TableName> ( , <TableList> )?
function tableList(scanner: Scanner) {
  return (): IChain => chainLine(tableName(scanner), chainLineTry(match(scanner, ','), tableList(scanner)));
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
    chainTree(
      chainLine(notOperator(scanner), expression(scanner)),
      chainLine(notOperator(scanner), match(scanner, '('), expression(scanner), match(scanner, ')')),
      chainLine(predicate(scanner), logicalOperator(scanner), expression(scanner)),
      chainLine(
        match(scanner, '('),
        predicate(scanner),
        match(scanner, ')'),
        logicalOperator(scanner),
        match(scanner, '('),
        predicate(scanner),
        match(scanner, ')')
      ),
      chainLine(
        predicate(scanner),
        match(scanner, 'is'),
        chainLineTry(match(scanner, 'not')),
        chainTree(match(scanner, 'true'), match(scanner, 'false'), match(scanner, 'unknown'))
      ),
      predicate(scanner)
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
    chainTree(
      chainLine(
        field(scanner),
        chainLineTry(match(scanner, 'not')),
        match(scanner, 'in'),
        match(scanner, '('),
        fieldList(scanner),
        match(scanner, ')')
      ),
      chainLine(field(scanner), comparisonOperator(scanner), field(scanner)),
      chainLine(
        field(scanner),
        chainLineTry(match(scanner, 'not')),
        match(scanner, 'between'),
        predicate(scanner),
        match(scanner, 'and'),
        predicate(scanner)
      ),
      chainLine(field(scanner), match(scanner, 'like'), stringMatch(scanner)),
      field(scanner)
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
      chainLine(stringOrWordMatch(scanner), match(scanner, '.'), match(scanner, '*')),
      chainLine(stringOrWordMatch(scanner), match(scanner, '.'), stringOrWordMatch(scanner)),
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
      chainLine(match(scanner, 'as'), chainTree(chainLine(matchWord(scanner)), chainLine(matchString(scanner)))),
      chainLine(matchWordOrString(scanner))
    );
}

// caseStatement
//           ::= CASE caseAlternative+ ELSE string END
function caseStatement(scanner: Scanner) {
  return () =>
    chainLine(
      match(scanner, 'case'),
      matchPlus(scanner, caseAlternative(scanner)),
      match(scanner, 'else'),
      stringMatch(scanner),
      match(scanner, 'end')
    );
}

// caseAlternative
//             ::= WHEN expression THEN string
function caseAlternative(scanner: Scanner) {
  return () => chainLine(match(scanner, 'when'), expression(scanner), match(scanner, 'then'), stringMatch(scanner));
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
      match(scanner, '('),
      chainTree(numberMatch(scanner), match(scanner, '*')),
      match(scanner, ')')
    );
}

// <Constant> ::= Word | String | Integer
function constant(scanner: Scanner) {
  return () => chainLine(matchWordOrStringOrNumber(scanner));
}

function logicalOperator(scanner: Scanner) {
  return () => chainLine(match(scanner, ['and', '&&', 'xor', 'or', '||']));
}

function comparisonOperator(scanner: Scanner) {
  return () => chainLine(match(scanner, ['=', '>', '<', '<=', '>=', '<>', '!=', '<=>']));
}

function notOperator(scanner: Scanner) {
  return match(scanner, ['not', '!']);
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
