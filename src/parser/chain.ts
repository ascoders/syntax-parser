import { defaults, set, uniq, uniqBy } from 'lodash';
import { Lexer } from '../lexer';
import { IToken } from '../lexer/token';
import { IMatch, match, matchFalse, matchTrue } from './match';
import { Scanner } from './scanner';
import { tailCallOptimize } from './utils';

const parserMap = new Map<ChainFunction, Parser>();

class Parser {
  public rootChainNode: ChainNode = null;
  public firstSet = new Map<string, MatchNode[]>();
  public firstOrFunctionSet = new Map<string, FirstOrFunctionSet[]>();
  public relatedSet = new Map<string, Set<string>>();
}

type FirstOrFunctionSet = MatchNode | string;

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

const MAX_VISITER_CALL = 10000000;

class VisiterOption {
  public onCallVisiter?: (node?: Node) => void;
  public onVisiterNextNode?: (node?: Node) => void;
  public onSuccess?: () => void;
  public onFail?: (lastNode?: Node) => void;
  public onMatchNode: (matchNode: MatchNode, store: VisiterStore, visiterOption: VisiterOption) => void;
  public generateAst?: boolean = true;
  public enableFirstSet?: boolean = true;
  public generateNextMatchNodes?: boolean = true;
}

class MatchNode {
  public parentNode: ParentNode;

  constructor(private matchFunction: IMatchFn, public matching: IMatching, public parentIndex: number) {}

  public run = (scanner: Scanner, isCostToken = true) => this.matchFunction(scanner, isCostToken);
}

export class FunctionNode {
  public parentNode: ParentNode;

  constructor(private chainFunction: ChainFunction, public parentIndex: number, public parser: Parser) {}

  public run = () => {
    return this.chainFunction()(this.parentNode, this.getFunctionName(), this.parentIndex, this.parser);
  };

  public getFunctionName = () => this.chainFunction.name;
}

interface INextMatchNode {
  matchNode: MatchNode | boolean;
  nextChances: IChance[];
  ready: boolean;
}

class TreeNode {
  public parentNode: ParentNode;
  public childs: Node[] = [];

  // Performance optimization. Quickly find next matchNode.
  public nextMatchNodes: INextMatchNode[] = [];

  constructor(public parentIndex: number) {}
}

export class ChainNode {
  public parentNode: ParentNode;
  public childs: Node[] = [];

  // The length is childs.length+1, so may be not necessary to call findNextMatchNode.
  public nextMatchNodes: INextMatchNode[] = [];

  public astResults?: IAst[] = [];

  // Eg: const foo = chain => chain()(), so the chain functionName is 'foo'.
  public functionName: string = null;

  public solveAst: ISolveAst = null;

  // Enable match plus times.
  public isPlus = false;

  public plusHeadIndex = 0;

  constructor(public parentIndex: number) {}
}

type SingleElement = string | any;
type IElement = SingleElement | SingleElement[];
type IElements = IElement[];
export type ISolveAst = (astResult: IAst[]) => IAst;

export type Chain = (...elements: IElements) => (solveAst?: ISolveAst) => ChainNodeFactory;

export type ChainNodeFactory = (
  parentNode?: ParentNode,
  // If parent node is a function, here will get it's name.
  functionName?: string,
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
      if (element.prototype.isPlus) {
        chainNode.isPlus = true;
      }
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
  const chainNodeFactory: ChainNodeFactory = (parentNode, functionName, parentIndex = 0, parser) => {
    const chainNode = new ChainNode(parentIndex);
    chainNode.parentNode = parentNode;
    chainNode.functionName = functionName;
    chainNode.solveAst = solveAst;

    chainNode.childs = elements.map((element, index) => createNodeByElement(element, chainNode, index, parser));

    if (functionName) {
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

class VisiterStore {
  public restChances: IChance[] = [];
  public nextMatchNodeFinders = new Set<{
    node: ParentNode;
    childIndex: number;
  }>();

  constructor(public scanner: Scanner, public parser: Parser) {}
}

export const createParser = (root: ChainFunction, lexer: Lexer) => (text: string, cursorIndex = 0) => {
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

  // Find where token cursorIndex is in
  const cursorPrevToken = scanner.getPrevTokenFromCharacterIndex(cursorIndex);

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

  newVisiter(
    parser.rootChainNode,
    scanner,
    {
      onCallVisiter: node => {
        callVisiterCount++;

        if (callVisiterCount > MAX_VISITER_CALL) {
          throw Error('call visiter more then ' + MAX_VISITER_CALL);
        }
      },
      onVisiterNextNode: node => {
        callParentCount++;
        if (callParentCount > MAX_VISITER_CALL) {
          throw Error('call parent more then' + MAX_VISITER_CALL);
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
          // TODO:
          // console.log('not match', matchNode.matching, matchResult.token && matchResult.token.value);
          tryChances(matchNode, store, currentVisiterOption);
        } else {
          // TODO:
          // console.log('match', matchNode.matching, matchResult.token && matchResult.token.value);
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

          visitNextNodeFromParent(matchNode, store, currentVisiterOption, matchResult.token);
        }
      },
      onFail: node => {
        success = false;
      }
    },
    parser
  );

  cursorPrevNodes = uniq(cursorPrevNodes);

  // Get next matchings
  let nextMatchNodes = cursorPrevNodes.reduce(
    (all, cursorPrevMatchNode) => {
      return all.concat(findNextMatchNodes(cursorPrevMatchNode, parser));
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

    const errorToken =
      lastMatchUnderShortestRestToken && scanner.getNextFromToken(lastMatchUnderShortestRestToken.token);

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

  return {
    rootChainNode: parser.rootChainNode,
    success,
    ast,
    callVisiterCount,
    nextMatchings: nextMatchNodes.reverse().map(each => each.matching),
    error,
    tokens,
    costs: {
      lexer: lexerTime.getTime() - startTime.getTime(),
      parser: parserTime.getTime() - startTime.getTime()
    }
  };
};

function newVisiter(node: Node, scanner: Scanner, visiterOption: VisiterOption, parser: Parser) {
  const defaultVisiterOption = new VisiterOption();
  defaults(visiterOption, defaultVisiterOption);

  const newStore = new VisiterStore(scanner, parser);
  visiter(node, newStore, visiterOption, 0);
}

const visiter = tailCallOptimize(
  (node: Node, store: VisiterStore, visiterOption: VisiterOption, childIndex: number) => {
    if (!node) {
      throw Error('no node!');
    }

    if (visiterOption.onCallVisiter) {
      visiterOption.onCallVisiter(node);
    }

    if (node instanceof ChainNode) {
      if (firstSetUnMatch(node, store, visiterOption, childIndex)) {
        return; // If unmatch, stop!
      }

      visitChildNode(node, store, visiterOption, childIndex);
    } else if (node instanceof TreeNode) {
      visitChildNode(node, store, visiterOption, childIndex);
    } else if (node instanceof MatchNode) {
      if (node.matching.type === 'loose') {
        if (node.matching.value === true) {
          visitNextNodeFromParent(node, store, visiterOption, null);
        } else {
          throw Error('Not support loose false!');
        }
      } else {
        solveNextMatchNodeFinders({ matchNode: node, store, visiterOption });
        visiterOption.onMatchNode(node, store, visiterOption);
      }
    } else if (node instanceof FunctionNode) {
      const replacedNode = node.run();

      node.parentNode.childs[node.parentIndex] = replacedNode;
      visiter(replacedNode, store, visiterOption, 0);
    } else {
      throw Error('Unexpected node type: ' + node);
    }
  }
);

function visitChildNode(node: ParentNode, store: VisiterStore, visiterOption: VisiterOption, childIndex: number) {
  const nextMatchNode = node.nextMatchNodes[childIndex];

  // If has nextMatchNode, jump to it directly.
  if (nextMatchNode && nextMatchNode.ready) {
    if (typeof nextMatchNode.matchNode === 'boolean') {
      if (nextMatchNode.matchNode === false) {
        return noNextNode(node, store, visiterOption);
      } else {
        throw Error('Unexpect next match node "true"');
      }
    } else {
      // Recover chances.
      nextMatchNode.nextChances.forEach(nextChance => {
        addChances({
          node: nextChance.node,
          store,
          visiterOption,
          tokenIndex: nextChance.tokenIndex,
          childIndex: nextChance.childIndex,
          addToNextMatchNodeFinders: false
        });
      });
      // Call target matchNode directly.
      return visiter(nextMatchNode.matchNode, store, visiterOption, 0);
    }
  } else {
    // No nextMatchNode, add it to find queue.
    store.nextMatchNodeFinders.add({
      node,
      childIndex
    });
  }

  if (node instanceof ChainNode) {
    const child = node.childs[childIndex];
    if (child) {
      visiter(child, store, visiterOption, 0);
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
      visiter(child, store, visiterOption, 0);
    } else {
      throw Error('tree node unexpect end');
    }
  }
}

const visitNextNodeFromParent = tailCallOptimize(
  (node: Node, store: VisiterStore, visiterOption: VisiterOption, astValue: any) => {
    if (visiterOption.onVisiterNextNode) {
      visiterOption.onVisiterNextNode(node);
    }

    if (!node.parentNode) {
      return noNextNode(node, store, visiterOption);
    }

    if (node.parentNode instanceof ChainNode) {
      if (visiterOption.generateAst) {
        if (node.parentNode.isPlus) {
          set(node.parentNode.astResults, `${node.parentNode.plusHeadIndex}.${node.parentIndex}`, astValue);
        } else {
          node.parentNode.astResults[node.parentIndex] = astValue;
        }
      }

      // If current node has isPlus, and run into visiterNextNode means it childs had match successful, so add a new chance.
      // TODO: ast has bug.
      if (node.parentNode.isPlus && node.parentIndex + 1 === node.parentNode.childs.length) {
        node.parentNode.plusHeadIndex++;
        addChances({
          node: node.parentNode,
          store,
          visiterOption,
          tokenIndex: store.scanner.getIndex(),
          childIndex: 0,
          addToNextMatchNodeFinders: true
        });
      }

      visiter(node.parentNode, store, visiterOption, node.parentIndex + 1);
    } else if (node.parentNode instanceof TreeNode) {
      visitNextNodeFromParent(node.parentNode, store, visiterOption, astValue);
    } else {
      throw Error('Unexpected parent node type: ' + node.parentNode);
    }
  }
);

function noNextNode(node: Node, store: VisiterStore, visiterOption: VisiterOption) {
  solveNextMatchNodeFinders({ matchNode: false, store, visiterOption });
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

  if (addToNextMatchNodeFinders) {
    addChanceToNextMatchNodeFinders({ chance, store, visiterOption });
  }
}

function tryChances(node: Node, store: VisiterStore, visiterOption: VisiterOption) {
  if (store.restChances.length === 0) {
    solveNextMatchNodeFinders({ matchNode: false, store, visiterOption });
    if (visiterOption.onFail) {
      visiterOption.onFail(node);
    }
    return;
  }

  const recentChance = store.restChances.pop();

  // reset scanner index
  store.scanner.setIndex(recentChance.tokenIndex);

  visiter(recentChance.node, store, visiterOption, recentChance.childIndex);
}

function solveNextMatchNodeFinders({
  matchNode,
  store,
  visiterOption
}: {
  matchNode: MatchNode | boolean;
  store: VisiterStore;
  visiterOption: VisiterOption;
}) {
  if (!visiterOption.generateNextMatchNodes) {
    return;
  }
  store.nextMatchNodeFinders.forEach(nextMatchNodeFinder => {
    if (!nextMatchNodeFinder.node.nextMatchNodes[nextMatchNodeFinder.childIndex]) {
      nextMatchNodeFinder.node.nextMatchNodes[nextMatchNodeFinder.childIndex] = {
        matchNode,
        nextChances: [],
        ready: true
      };
    } else {
      nextMatchNodeFinder.node.nextMatchNodes[nextMatchNodeFinder.childIndex].matchNode = matchNode;
    }
  });
  store.nextMatchNodeFinders.clear();
}

function addChanceToNextMatchNodeFinders({
  chance,
  store,
  visiterOption
}: {
  chance: IChance;
  store: VisiterStore;
  visiterOption: VisiterOption;
}) {
  if (!visiterOption.generateNextMatchNodes) {
    return;
  }
  store.nextMatchNodeFinders.forEach(nextMatchNodeFinder => {
    if (!nextMatchNodeFinder.node.nextMatchNodes[nextMatchNodeFinder.childIndex]) {
      nextMatchNodeFinder.node.nextMatchNodes[nextMatchNodeFinder.childIndex] = {
        matchNode: null,
        nextChances: [chance],
        ready: false
      };
    } else {
      nextMatchNodeFinder.node.nextMatchNodes[nextMatchNodeFinder.childIndex].nextChances.push(chance);
    }
  });
}

// find all tokens that may appear next
function findNextMatchNodes(node: Node, parser: Parser): MatchNode[] {
  const nextMatchNodes: MatchNode[] = [];

  let passCurrentNode = false;

  const visiterOption: VisiterOption = {
    generateAst: false,
    enableFirstSet: false,
    generateNextMatchNodes: false,
    onMatchNode: (matchNode, store, currentVisiterOption) => {
      if (matchNode === node && passCurrentNode === false) {
        passCurrentNode = true;
        visitNextNodeFromParent(matchNode, store, currentVisiterOption, null);
      }

      nextMatchNodes.push(matchNode);

      // Suppose the match failed, so we can find another possible match chance!
      tryChances(matchNode, store, currentVisiterOption);
    }
  };

  newVisiter(node, new Scanner([]), visiterOption, parser);

  return nextMatchNodes;
}

// First Set -----------------------------------------------------------------

function firstSetUnMatch(node: ChainNode, store: VisiterStore, visiterOption: VisiterOption, childIndex: number) {
  if (
    visiterOption.enableFirstSet &&
    node.functionName &&
    childIndex === 0 &&
    store.parser.firstSet.has(node.functionName)
  ) {
    const firstMatchNodes = store.parser.firstSet.get(node.functionName);

    // If not match any first match node, try chances
    if (!firstMatchNodes.some(firstMatchNode => firstMatchNode.run(store.scanner, false).match)) {
      // Clear caches, because we stop visit!
      store.nextMatchNodeFinders.forEach(nextMatchNodeFinder => {
        nextMatchNodeFinder.node.nextMatchNodes[nextMatchNodeFinder.childIndex] = {
          matchNode: null,
          nextChances: [],
          ready: false
        };
      });
      store.nextMatchNodeFinders.clear();

      tryChances(node, store, visiterOption);
      return true; // Yes, unMatch.
    } else {
      return false; // No, Match.
    }
  }
}

function generateFirstSet(node: ChainNode, parser: Parser) {
  const functionName = node.functionName;

  if (parser.firstSet.has(functionName)) {
    return;
  }

  const firstMatchNodes = getFirstOrFunctionSet(node, functionName, parser);
  parser.firstOrFunctionSet.set(functionName, firstMatchNodes);

  solveFirstSet(functionName, parser);
}

function getFirstOrFunctionSet(node: Node, functionName: string, parser: Parser): FirstOrFunctionSet[] {
  if (node instanceof ChainNode) {
    if (node.childs[0]) {
      return getFirstOrFunctionSet(node.childs[0], functionName, parser);
    }
  } else if (node instanceof TreeNode) {
    return node.childs.reduce((all, next) => all.concat(getFirstOrFunctionSet(next, functionName, parser)), []);
  } else if (node instanceof MatchNode) {
    return [node];
  } else if (node instanceof FunctionNode) {
    const relatedFunctionName = node.getFunctionName();

    if (parser.relatedSet.has(relatedFunctionName)) {
      parser.relatedSet.get(relatedFunctionName).add(functionName);
    } else {
      parser.relatedSet.set(relatedFunctionName, new Set([functionName]));
    }

    return [relatedFunctionName];
  } else {
    throw Error('Unexpected node: ' + node);
  }
}

function solveFirstSet(functionName: string, parser: Parser) {
  if (parser.firstSet.has(functionName)) {
    return;
  }

  const firstMatchNodes = parser.firstOrFunctionSet.get(functionName);

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

  parser.firstOrFunctionSet.set(functionName, newFirstMatchNodes);

  // If all set hasn't function node, we can solve it's relative set.
  if (newFirstMatchNodes.every(firstMatchNode => firstMatchNode instanceof MatchNode)) {
    parser.firstSet.set(functionName, newFirstMatchNodes as MatchNode[]);

    // If this functionName has related functionNames, solve them
    if (parser.relatedSet.has(functionName)) {
      const relatedFunctionNames = parser.relatedSet.get(functionName);
      relatedFunctionNames.forEach(relatedFunctionName => solveFirstSet);
    }
  }
}

// First set /////////////////////////////////////////////////////////////////
