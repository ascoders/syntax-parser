import { defaults, get, set, uniq, uniqBy } from 'lodash';
import { Lexer } from '../lexer';
import { IToken } from '../lexer/token';
import { cursorSymbol } from './definition';
import { IMatch, match, matchFalse, matchTrue } from './match';
import { Scanner } from './scanner';
import { getPathFromObjectByValue, getTokenValue, tailCallOptimize } from './utils';

const parserMap = new Map<ChainFunction, Parser>();

class Parser {
  public rootChainNode: ChainNode = null;
  public firstSet = new Map<ChainFunction, MatchNode[]>();
  public firstOrFunctionSet = new Map<ChainFunction, FirstOrFunctionSet[]>();
  public relatedSet = new Map<ChainFunction, Set<ChainFunction>>();
}

type FirstOrFunctionSet = MatchNode | ChainFunction;

// tslint:disable:max-classes-per-file

export type IMatchFn = (scanner: Scanner, isCostToken: boolean) => IMatch;

// IToken | Array<IToken> | any return object from resolveAst().
export type IAst = IToken | any;

export type Node = MatchNode | FunctionNode | TreeNode | ChainNode;

export type ParentNode = TreeNode | ChainNode;

export interface IMatching {
  // loose not cost token, and result is fixed true of false.
  type: 'string' | 'loose' | 'special';
  value: string | boolean;
}

const MAX_VISITER_CALL = 1000000;

class VisiterStore {
  public restChances: IChance[] = [];
  public nextMatchNodeFinders = new Set<{
    node: ParentNode;
    childIndex: number;
  }>();
  public stop = false;
  // TODO:
  public cursorAst?: IAst = null;

  constructor(public scanner: Scanner, public parser: Parser) {}
}

class VisiterOption {
  public onCallVisiter?: (node?: Node, store?: VisiterStore) => void;
  public onVisiterNextNode?: (node?: Node, store?: VisiterStore) => void;
  public onSuccess?: () => void;
  public onFail?: (lastNode?: Node) => void;
  public onMatchNode: (matchNode: MatchNode, store: VisiterStore, visiterOption: VisiterOption) => void;
  public generateAst?: boolean = true;
  public enableFirstSet?: boolean = true;
  public cursorToken?: IToken = null;
}

class MatchNode {
  public parentNode: ParentNode;

  constructor(private matchFunction: IMatchFn, public matching: IMatching, public parentIndex: number) {}

  public run = (scanner: Scanner, isCostToken = true) => this.matchFunction(scanner, isCostToken);
}

export class FunctionNode {
  public parentNode: ParentNode;

  constructor(public chainFunction: ChainFunction, public parentIndex: number, public parser: Parser) {}

  public run = () => {
    return this.chainFunction()(this.parentNode, this.chainFunction, this.parentIndex, this.parser);
  };
}

interface INextMatchNode {
  matchNode: MatchNode | boolean;
  nextChances: IChance[];
  ready: boolean;
}

class TreeNode {
  public parentNode: ParentNode;
  public childs: Node[] = [];

  constructor(public parentIndex: number) {}
}

export class ChainNode {
  public parentNode: ParentNode;
  public childs: Node[] = [];

  public astResults?: IAst[] = [];

  // Eg: const foo = chain => chain()(), so the chain creatorFunction is 'foo'.
  public creatorFunction: ChainFunction = null;

  public solveAst: ISolveAst = null;

  constructor(public parentIndex: number) {}
}

type SingleElement = string | any;
export type IElement = SingleElement | SingleElement[];
export type IElements = IElement[];
export type ISolveAst = (astResult: IAst[]) => IAst;

export type Chain = (...elements: IElements) => (solveAst?: ISolveAst) => ChainNodeFactory;

export type ChainNodeFactory = (
  parentNode?: ParentNode,
  // If parent node is a function, here will get it's name.
  creatorFunction?: ChainFunction,
  parentIndex?: number,
  parser?: Parser
) => ChainNode;

export type ChainFunction = () => ChainNodeFactory;

const createNodeByElement = (element: IElement, parentNode: ParentNode, parentIndex: number, parser: Parser): Node => {
  if (element instanceof Array) {
    const treeNode = new TreeNode(parentIndex);
    treeNode.parentNode = parentNode;
    treeNode.childs = element.map((eachElement, childIndex) =>
      createNodeByElement(eachElement, treeNode, childIndex, parser)
    );
    return treeNode;
  } else if (typeof element === 'string') {
    const matchNode = new MatchNode(
      match(element)(),
      {
        type: 'string',
        value: element
      },
      parentIndex
    );
    matchNode.parentNode = parentNode;
    return matchNode;
  } else if (typeof element === 'boolean') {
    if (element) {
      const trueMatchNode = new MatchNode(
        matchTrue,
        {
          type: 'loose',
          value: true
        },
        parentIndex
      );
      trueMatchNode.parentNode = parentNode;
      return trueMatchNode;
    } else {
      const falseMatchNode = new MatchNode(
        matchFalse,
        {
          type: 'loose',
          value: false
        },
        parentIndex
      );
      falseMatchNode.parentNode = parentNode;
      return falseMatchNode;
    }
  } else if (typeof element === 'function') {
    if (element.prototype.name === 'match') {
      const matchNode = new MatchNode(
        element(),
        {
          type: 'special',
          value: element.prototype.displayName
        },
        parentIndex
      );
      matchNode.parentNode = parentNode;
      return matchNode;
    } else if (element.prototype.name === 'chainNodeFactory') {
      const chainNode = element(parentNode, null, parentIndex, parser);
      return chainNode;
    } else {
      const functionNode = new FunctionNode(element as ChainFunction, parentIndex, parser);
      functionNode.parentNode = parentNode;
      return functionNode;
    }
  } else {
    throw Error(`unknow element in chain ${element}`);
  }
};

export const chain: Chain = (...elements) => (solveAst = args => args) => {
  const chainNodeFactory: ChainNodeFactory = (parentNode, creatorFunction, parentIndex = 0, parser) => {
    const chainNode = new ChainNode(parentIndex);
    chainNode.parentNode = parentNode;
    chainNode.creatorFunction = creatorFunction;
    chainNode.solveAst = solveAst;

    chainNode.childs = elements.map((element, index) => createNodeByElement(element, chainNode, index, parser));

    if (creatorFunction) {
      generateFirstSet(chainNode, parser);
    }

    return chainNode;
  };
  chainNodeFactory.prototype.name = 'chainNodeFactory';

  return chainNodeFactory;
};

interface IChance {
  node: ParentNode;
  childIndex: number;
  tokenIndex: number;
}

export const createParser = (root: ChainFunction, lexer: Lexer) => (text: string, cursorIndex: number = null) => {
  const startTime = new Date();
  const tokens = lexer(text);
  const lexerTime = new Date();
  const scanner = new Scanner(tokens);

  let parser: Parser = null;

  if (parserMap.has(root)) {
    parser = parserMap.get(root);
  } else {
    parser = new Parser();
    parser.rootChainNode = root()(null, null, 0, parser);
    parserMap.set(root, parser);
  }

  // Find where token cursorIndex is in.
  const cursorToken = scanner.getTokenByCharacterIndex(cursorIndex);
  const cursorPrevToken = scanner.getPrevTokenByCharacterIndex(cursorIndex).prevToken;

  // Generate cursor token, if cursor position is not in a token.
  // Return cursor token.
  let cursorAddonToken = cursorToken;

  if (!cursorAddonToken && cursorIndex !== null) {
    // If cursor not on token, add `cursorToken` to tokens!
    cursorAddonToken = {
      systemType: 'cursor',
      type: null,
      value: null,
      position: [cursorIndex, cursorIndex]
    };
    scanner.addToken(cursorAddonToken);
  }

  // If cursorPrevToken is null, the cursor prev node is root.
  let cursorPrevNodes: Node[] = cursorPrevToken === null ? [parser.rootChainNode] : [];

  let success: boolean = false;
  let ast: IAst = null;
  let callVisiterCount = 0;
  let callParentCount = 0;
  let lastMatchUnderShortestRestToken: {
    restTokenCount: number;
    matchNode: MatchNode;
    token: IToken;
  } = null;

  newVisiter({
    node: parser.rootChainNode,
    scanner,
    cursorToken: cursorAddonToken,
    visiterOption: {
      onCallVisiter: (node, store) => {
        callVisiterCount++;

        if (callVisiterCount > MAX_VISITER_CALL) {
          store.stop = true;
        }
      },
      onVisiterNextNode: (node, store) => {
        callParentCount++;
        if (callParentCount > MAX_VISITER_CALL) {
          store.stop = true;
        }
      },
      onSuccess: () => {
        success = true;
        ast = parser.rootChainNode.solveAst
          ? parser.rootChainNode.solveAst(parser.rootChainNode.astResults)
          : parser.rootChainNode.astResults;
      },
      onMatchNode: (matchNode, store, currentVisiterOption) => {
        const matchResult = matchNode.run(store.scanner);

        if (!matchResult.match) {
          tryChances(matchNode, store, currentVisiterOption);
        } else {
          const restTokenCount = store.scanner.getRestTokenCount();
          // Last match at least token remaining, is the most readable reason for error.
          if (
            !lastMatchUnderShortestRestToken ||
            (lastMatchUnderShortestRestToken && lastMatchUnderShortestRestToken.restTokenCount > restTokenCount)
          ) {
            lastMatchUnderShortestRestToken = {
              matchNode,
              token: matchResult.token,
              restTokenCount
            };
          }

          // If cursor prev token isn't null, it may a cursor prev node.
          if (cursorPrevToken !== null && matchResult.token === cursorPrevToken) {
            cursorPrevNodes.push(matchNode);
          }

          visitNextNodeFromParent(matchNode, store, currentVisiterOption, getTokenValue(matchResult.token));
        }
      },
      onFail: node => {
        success = false;
      }
    },
    parser
  });

  cursorPrevNodes = uniq(cursorPrevNodes);

  // Get next matchings
  let nextMatchNodes = cursorPrevNodes.reduce(
    (all, cursorPrevNode) => {
      return all.concat(findNextMatchNodes(cursorPrevNode, parser));
    },
    [] as MatchNode[]
  );

  nextMatchNodes = uniqBy(nextMatchNodes, each => each.matching.type + each.matching.value);

  // If has next token, see whether the double next match node match this next token.
  const cursorNextToken = scanner.getNextTokenFromCharacterIndex(cursorIndex);

  if (cursorNextToken) {
    nextMatchNodes = nextMatchNodes.filter(nextMatchNode =>
      findNextMatchNodes(nextMatchNode, parser).some(
        nextNextMatchNode => nextNextMatchNode.matching.value === cursorNextToken.value
      )
    );
  }

  // Get error message
  let error: {
    token: IToken;
    reason: 'wrong' | 'incomplete';
    suggestions: IMatching[];
  } = null;

  if (!success) {
    const suggestions = uniqBy(
      (lastMatchUnderShortestRestToken
        ? findNextMatchNodes(lastMatchUnderShortestRestToken.matchNode, parser)
        : findNextMatchNodes(parser.rootChainNode, parser)
      ).map(each => each.matching),
      each => each.type + each.value
    );

    const errorToken = lastMatchUnderShortestRestToken && scanner.getNextByToken(lastMatchUnderShortestRestToken.token);

    if (errorToken) {
      error = {
        suggestions,
        token: errorToken,
        reason: 'wrong'
      };
    } else {
      error = {
        suggestions,
        token: lastMatchUnderShortestRestToken ? lastMatchUnderShortestRestToken.token : null,
        reason: 'incomplete'
      };
    }
  }

  const parserTime = new Date();

  // Find cursor ast from whole ast.
  const cursorKeyFullPath = getPathFromObjectByValue(ast, cursorSymbol);
  const cursorKeyFullPaths = cursorKeyFullPath.split('.');
  const cursorKeyFullParentPath = cursorKeyFullPaths.slice(0, cursorKeyFullPaths.length - 1).join('.');
  const cursorKeyPath = cursorKeyFullPaths.slice().pop();
  const cursorParentAst = get(ast, cursorKeyFullParentPath);

  return {
    rootChainNode: parser.rootChainNode,
    success,
    ast,
    callVisiterCount,
    cursorParentAst,
    cursorKeyPath,
    nextMatchings: nextMatchNodes
      .reverse()
      .map(each => each.matching)
      .filter(each => !!each.value),
    error,
    tokens,
    costs: {
      lexer: lexerTime.getTime() - startTime.getTime(),
      parser: parserTime.getTime() - startTime.getTime()
    }
  };
};

function newVisiter({
  node,
  scanner,
  visiterOption,
  parser,
  cursorToken
}: {
  node: Node;
  scanner: Scanner;
  visiterOption: VisiterOption;
  parser: Parser;
  cursorToken?: IToken;
}) {
  const defaultVisiterOption = new VisiterOption();
  defaultVisiterOption.cursorToken = cursorToken;
  defaults(visiterOption, defaultVisiterOption);

  const newStore = new VisiterStore(scanner, parser);
  visiter({ node, store: newStore, visiterOption, childIndex: 0 });
}

const visiter = tailCallOptimize(
  ({
    node,
    store,
    visiterOption,
    childIndex
  }: {
    node: Node;
    store: VisiterStore;
    visiterOption: VisiterOption;
    childIndex: number;
  }) => {
    if (store.stop) {
      fail(node, store, visiterOption);
      return;
    }

    if (!node) {
      throw Error('no node!');
    }

    if (visiterOption.onCallVisiter) {
      visiterOption.onCallVisiter(node, store);
    }

    if (node instanceof ChainNode) {
      if (firstSetUnMatch(node, store, visiterOption, childIndex)) {
        return; // If unmatch, stop!
      }

      visitChildNode({ node, store, visiterOption, childIndex });
    } else if (node instanceof TreeNode) {
      visitChildNode({ node, store, visiterOption, childIndex });
    } else if (node instanceof MatchNode) {
      if (node.matching.type === 'loose') {
        if (node.matching.value === true) {
          visitNextNodeFromParent(node, store, visiterOption, null);
        } else {
          throw Error('Not support loose false!');
        }
      } else {
        visiterOption.onMatchNode(node, store, visiterOption);
      }
    } else if (node instanceof FunctionNode) {
      const replacedNode = node.run();

      node.parentNode.childs[node.parentIndex] = replacedNode;
      visiter({ node: replacedNode, store, visiterOption, childIndex: 0 });
    } else {
      throw Error('Unexpected node type: ' + node);
    }
  }
);

function visitChildNode({
  node,
  store,
  visiterOption,
  childIndex
}: {
  node: ParentNode;
  store: VisiterStore;
  visiterOption: VisiterOption;
  childIndex: number;
}) {
  if (node instanceof ChainNode) {
    const child = node.childs[childIndex];
    if (child) {
      visiter({ node: child, store, visiterOption, childIndex: 0 });
    } else {
      visitNextNodeFromParent(
        node,
        store,
        visiterOption,
        visiterOption.generateAst ? node.solveAst(node.astResults) : null
      );
    }
  } else {
    // Node === TreeNode
    const child = node.childs[childIndex];
    if (childIndex + 1 < node.childs.length) {
      addChances({
        node,
        store,
        visiterOption,
        tokenIndex: store.scanner.getIndex(),
        childIndex: childIndex + 1,
        addToNextMatchNodeFinders: true
      });
    }
    if (child) {
      visiter({ node: child, store, visiterOption, childIndex: 0 });
    } else {
      throw Error('tree node unexpect end');
    }
  }
}

const visitNextNodeFromParent = tailCallOptimize(
  (node: Node, store: VisiterStore, visiterOption: VisiterOption, astValue: any) => {
    if (store.stop) {
      fail(node, store, visiterOption);
      return;
    }

    if (visiterOption.onVisiterNextNode) {
      visiterOption.onVisiterNextNode(node, store);
    }

    if (!node.parentNode) {
      return noNextNode(node, store, visiterOption);
    }

    if (node.parentNode instanceof ChainNode) {
      if (visiterOption.generateAst) {
        node.parentNode.astResults[node.parentIndex] = astValue;
      }

      visiter({ node: node.parentNode, store, visiterOption, childIndex: node.parentIndex + 1 });
    } else if (node.parentNode instanceof TreeNode) {
      visitNextNodeFromParent(node.parentNode, store, visiterOption, astValue);
    } else {
      throw Error('Unexpected parent node type: ' + node.parentNode);
    }
  }
);

function noNextNode(node: Node, store: VisiterStore, visiterOption: VisiterOption) {
  if (store.scanner.isEnd()) {
    if (visiterOption.onSuccess) {
      visiterOption.onSuccess();
    }
  } else {
    tryChances(node, store, visiterOption);
  }
}

function addChances({
  node,
  store,
  visiterOption,
  tokenIndex,
  childIndex,
  addToNextMatchNodeFinders
}: {
  node: ParentNode;
  store: VisiterStore;
  visiterOption: VisiterOption;
  tokenIndex: number;
  childIndex: number;
  addToNextMatchNodeFinders: boolean;
}) {
  const chance = {
    node,
    tokenIndex,
    childIndex
  };

  store.restChances.push(chance);
}

function tryChances(node: Node, store: VisiterStore, visiterOption: VisiterOption) {
  if (store.restChances.length === 0) {
    fail(node, store, visiterOption);
    return;
  }

  const recentChance = store.restChances.pop();

  // reset scanner index
  store.scanner.setIndex(recentChance.tokenIndex);

  visiter({ node: recentChance.node, store, visiterOption, childIndex: recentChance.childIndex });
}

function fail(node: Node, store: VisiterStore, visiterOption: VisiterOption) {
  if (visiterOption.onFail) {
    visiterOption.onFail(node);
  }
}

// find all tokens that may appear next
function findNextMatchNodes(node: Node, parser: Parser): MatchNode[] {
  const nextMatchNodes: MatchNode[] = [];

  let passCurrentNode = false;

  const visiterOption: VisiterOption = {
    generateAst: false,
    enableFirstSet: false,
    onMatchNode: (matchNode, store, currentVisiterOption) => {
      if (matchNode === node && passCurrentNode === false) {
        passCurrentNode = true;
        visitNextNodeFromParent(matchNode, store, currentVisiterOption, null);
      } else {
        nextMatchNodes.push(matchNode);
      }

      // Suppose the match failed, so we can find another possible match chance!
      tryChances(matchNode, store, currentVisiterOption);
    }
  };

  newVisiter({ node, scanner: new Scanner([]), visiterOption, parser });

  return nextMatchNodes;
}

// First Set -----------------------------------------------------------------

function firstSetUnMatch(node: ChainNode, store: VisiterStore, visiterOption: VisiterOption, childIndex: number) {
  if (
    visiterOption.enableFirstSet &&
    node.creatorFunction &&
    childIndex === 0 &&
    store.parser.firstSet.has(node.creatorFunction)
  ) {
    const firstMatchNodes = store.parser.firstSet.get(node.creatorFunction);

    // If not match any first match node, try chances
    if (!firstMatchNodes.some(firstMatchNode => firstMatchNode.run(store.scanner, false).match)) {
      tryChances(node, store, visiterOption);
      return true; // Yes, unMatch.
    } else {
      return false; // No, Match.
    }
  }
}

function generateFirstSet(node: ChainNode, parser: Parser) {
  if (parser.firstSet.has(node.creatorFunction)) {
    return;
  }

  const firstMatchNodes = getFirstOrFunctionSet(node, node.creatorFunction, parser);
  parser.firstOrFunctionSet.set(node.creatorFunction, firstMatchNodes);

  solveFirstSet(node.creatorFunction, parser);
}

function getFirstOrFunctionSet(node: Node, creatorFunction: ChainFunction, parser: Parser): FirstOrFunctionSet[] {
  if (node instanceof ChainNode) {
    if (node.childs[0]) {
      return getFirstOrFunctionSet(node.childs[0], creatorFunction, parser);
    }
  } else if (node instanceof TreeNode) {
    return node.childs.reduce((all, next) => all.concat(getFirstOrFunctionSet(next, creatorFunction, parser)), []);
  } else if (node instanceof MatchNode) {
    return [node];
  } else if (node instanceof FunctionNode) {
    if (parser.relatedSet.has(node.chainFunction)) {
      parser.relatedSet.get(node.chainFunction).add(creatorFunction);
    } else {
      parser.relatedSet.set(node.chainFunction, new Set([creatorFunction]));
    }

    return [node.chainFunction];
  } else {
    throw Error('Unexpected node: ' + node);
  }
}

function solveFirstSet(creatorFunction: ChainFunction, parser: Parser) {
  if (parser.firstSet.has(creatorFunction)) {
    return;
  }

  const firstMatchNodes = parser.firstOrFunctionSet.get(creatorFunction);

  // Try if relate functionName has done first set.
  const newFirstMatchNodes = firstMatchNodes.reduce(
    (all, firstMatchNode) => {
      if (typeof firstMatchNode === 'string') {
        if (parser.firstSet.has(firstMatchNode)) {
          all = all.concat(parser.firstSet.get(firstMatchNode));
        } else {
          all.push(firstMatchNode);
        }
      } else {
        all.push(firstMatchNode);
      }

      return all;
    },
    [] as FirstOrFunctionSet[]
  );

  parser.firstOrFunctionSet.set(creatorFunction, newFirstMatchNodes);

  // If all set hasn't function node, we can solve it's relative set.
  if (newFirstMatchNodes.every(firstMatchNode => firstMatchNode instanceof MatchNode)) {
    parser.firstSet.set(creatorFunction, newFirstMatchNodes as MatchNode[]);

    // If this functionName has related functionNames, solve them
    if (parser.relatedSet.has(creatorFunction)) {
      const relatedFunctionNames = parser.relatedSet.get(creatorFunction);
      relatedFunctionNames.forEach(relatedFunctionName => solveFirstSet);
    }
  }
}

// First set /////////////////////////////////////////////////////////////////
