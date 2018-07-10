import { match } from '../../node_modules/@types/minimatch';
import { IToken } from '../lexer/interface';
import tokenTypes from '../lexer/token-types';
import { chainLine, chainLineTry, chainTree, chainTreeTry, execChain, IChain } from './chain';
import {
  matchAll,
  matchCloseParen,
  matchNumber,
  matchOpenParen,
  matchOperator,
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
const COMPARISON_OPERATOR = ['=', '>', '<', '<=', '>=', '<>', '!=', '<=>'];
const bitOperator = ['<<', '>>', '&', '^', '|'];
const mathOperator = ['*', '/', '%', 'DIV', 'MOD', '+', '-', '--'];
const logicalOperator = ['AND', '&&', 'XOR', 'OR', '||'];

// <Statement> := <SelectStatement>
function statement(scanner: Scanner) {
  return chainTree(selectStatement(scanner));
}

// <SelectStatement> := SELECT [SelectList] FROM <TableList> [ WhereStatement ]
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

// <SelectList> := <SelectField> [ , <SelectList> ]
function selectList(scanner: Scanner) {
  return (): IChain =>
    chainLine(
      skipWhitespace(scanner),
      selectField(scanner),
      chainLineTry(skipWhitespace(scanner), matchOperator(scanner, ','), skipWhitespace(scanner), selectList(scanner))
    );
}

// <WhereStatement> := WHERE <Predicate>
function whereStatement(scanner: Scanner) {
  return () =>
    chainLine(
      skipWhitespace(scanner),
      matchReserved(scanner, 'where'),
      skipAtLeastWhitespace(scanner),
      predicate(scanner)
    );
}

// <SelectField> := <Field> [Alias]
//                | *
function selectField(scanner: Scanner) {
  return () =>
    chainTree(
      chainLine(skipWhitespace(scanner), field(scanner), chainLineTry(alias(scanner))),
      chainLine(skipWhitespace(scanner), matchOperator(scanner, '*'))
    );
}

// <TableList> := <TableName> [ , <TableList> ]
function tableList(scanner: Scanner) {
  return (): IChain =>
    chainLine(
      skipWhitespace(scanner),
      tableName(scanner),
      chainLineTry(skipWhitespace(scanner), matchOperator(scanner, ','), skipWhitespace(scanner), tableList(scanner))
    );
}

// <Predicate> := <Term> [ AND <Predicate> | OR <Predicate> ]
//              | <Field> BETWEEN <Field> AND <Field>
// TODO:
function predicate(scanner: Scanner) {
  return (): IChain =>
    chainTree(
      chainLine(
        skipWhitespace(scanner),
        term(scanner),
        chainLineTry(
          skipAtLeastWhitespace(scanner),
          chainTree(
            chainLine(matchReserved(scanner, 'and'), skipAtLeastWhitespace(scanner), predicate(scanner)),
            chainLine(matchReserved(scanner, 'or'), skipAtLeastWhitespace(scanner), predicate(scanner))
          )
        )
      ),
      chainLine(
        skipWhitespace(scanner),
        field(scanner),
        skipAtLeastWhitespace(scanner),
        matchReserved(scanner, 'between'),
        skipAtLeastWhitespace(scanner),
        field(scanner),
        skipAtLeastWhitespace(scanner),
        matchReserved(scanner, 'and'),
        field(scanner)
      )
    );
}

// <Field> :=
//          | <Function>
//          | <String>
//          | <Number>
//          | <Word>
function field(scanner: Scanner) {
  return () => chainTree(functionMatch(scanner), stringMatch(scanner), numberMatch(scanner), wordMatch(scanner));
}

// TableName := WordOrString [Alias]
function tableName(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchWordOrString(scanner), chainLineTry(alias(scanner)));
}

// Alias := AS Word
//        | AS'String
//        | WordOrString
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

// <Term> := <Constant> COMPARISON_OPERATOR <Constant>
//         | <Constant>[NOT] IN(<Constant>)
//         | <Word> LIKE <String>
// TODO:
function term(scanner: Scanner) {
  return chainTree(
    chainLine(
      skipWhitespace(scanner),
      constant(scanner),
      skipWhitespace(scanner),
      matchOperator(scanner, COMPARISON_OPERATOR),
      skipWhitespace(scanner),
      constant(scanner)
    ),
    chainLine(
      skipWhitespace(scanner),
      constant(scanner),
      skipAtLeastWhitespace(scanner),
      matchOperator(scanner, 'in'),
      skipAtLeastWhitespace(scanner),
      constant(scanner)
    ),
    chainLine(
      skipWhitespace(scanner),
      wordMatch(scanner),
      skipAtLeastWhitespace(scanner),
      matchReserved(scanner, 'like'),
      stringMatch(scanner)
    )
  );
}

// <Word> := Word
function wordMatch(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchWord(scanner));
}

// <String> := String
function stringMatch(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchString(scanner));
}

// <Number> := Number
function numberMatch(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchNumber(scanner));
}

// <Function> := <Word>(<Number>)
function functionMatch(scanner: Scanner) {
  return () =>
    chainLine(
      skipWhitespace(scanner),
      wordMatch(scanner),
      matchOpenParen(scanner, '('),
      skipWhitespace(scanner),
      numberMatch(scanner),
      skipWhitespace(scanner),
      matchCloseParen(scanner, ')')
    );
}

// <Constant> := Word | String | Integer
function constant(scanner: Scanner) {
  return () => chainLine(skipWhitespace(scanner), matchWordOrStringOrNumber(scanner));
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
