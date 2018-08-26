import { defaults, uniqBy } from 'lodash';
import { IToken } from '../lexer/token';
import { IMatch, match, matchFalse, matchTrue } from './match';
import { Scanner } from './scanner';
import { tailCallOptimize } from './utils';

type FirstOrFunctionSet = MatchNode | string;

// First set
const firstSet = new Map<string, MatchNode[]>();
const firstOrFunctionSet = new Map<string, FirstOrFunctionSet[]>();
const relatedSet = new Map<string, Set<string>>();

let globalVersion = 0;

function getNewVersion() {
  return ++globalVersion;
}

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
  public onCallParentNode?: (node?: Node) => void;
  public onSuccess?: () => void;
  public onFail?: (lastNode?: Node) => void;
  public generateAst?: boolean = true;
  public onMatchNode: (matchNode: MatchNode, store: VisiterStore, visiterOption: VisiterOption) => void;
  public enableFirstSet?: boolean = true;
}

class MatchNode {
  public parentNode: ParentNode;

  constructor(private matchFunction: IMatchFn, public matching: IMatching, public parentIndex: number) {}

  public run = (scanner: Scanner, isCostToken = true) => this.matchFunction(scanner, isCostToken);
}

export class FunctionNode {
  public parentNode: ParentNode;

  constructor(private chainFunction: ChainFunction, public parentIndex: number) {}

  public run = () => {
    return this.chainFunction()(this.parentNode, this.getFunctionName(), this.parentIndex);
  };

  public getFunctionName = () => this.chainFunction.name;
}

class TreeNode {
  public parentNode: ParentNode;
  public childs: Node[] = [];
  // Current running child index.
  public headIndex = 0;

  public version: number = null;

  constructor(public parentIndex: number) {}
}

export class ChainNode {
  public parentNode: ParentNode;
  public childs: Node[] = [];
  public astResults?: IAst[] = [];
  // Current running child index.
  public headIndex = 0;

  // Eg: const foo = chain => chain()(), so the chain functionName is 'foo'.
  public functionName: string = null;

  public solveAst: ISolveAst = null;

  // When try new tree chance, set tree node and it's parent chain node a new version, so all child visiter will reset headIndex if version if different.
  public version: number = null;

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
  parentIndex?: number
) => ChainNode;

export type ChainFunction = () => ChainNodeFactory;

const createNodeByElement = (element: IElement, parentNode: ParentNode, parentIndex: number): Node => {
  if (element instanceof Array) {
    const treeNode = new TreeNode(parentIndex);
    treeNode.parentNode = parentNode;
    treeNode.childs = element.map((eachElement, childIndex) => createNodeByElement(eachElement, treeNode, childIndex));
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
      const chainNode = element(parentNode, null, parentIndex);
      if (element.prototype.isPlus) {
        chainNode.isPlus = true;
      }
      return chainNode;
    } else {
      const functionNode = new FunctionNode(element as ChainFunction, parentIndex);
      functionNode.parentNode = parentNode;
      return functionNode;
    }
  } else {
    throw Error(`unknow element in chain ${element}`);
  }
};

export const chain: Chain = (...elements) => (solveAst = args => args) => {
  const chainNodeFactory: ChainNodeFactory = (parentNode, functionName, parentIndex = 0) => {
    const chainNode = new ChainNode(parentIndex);
    chainNode.parentNode = parentNode;
    chainNode.functionName = functionName;
    chainNode.solveAst = solveAst;

    elements = solveDirectLeftRecursion(elements, functionName);

    chainNode.childs = elements.map((element, index) => createNodeByElement(element, chainNode, index));

    if (functionName) {
      generateFirstSet(chainNode);
    }

    return chainNode;
  };
  chainNodeFactory.prototype.name = 'chainNodeFactory';

  return chainNodeFactory;
};

/**
 * Solve direct left recursion.
 * a -> a + b
 *    | a + c
 *    | d
 *    | e
 * ===
 * a -> (d | e) ((+ b) | (+ c))*
 */
function solveDirectLeftRecursion(elements: any[], parentFunctionName: string) {
  const leftRecursionElements = elements.filter(element => element.name === parentFunctionName);
  const normalElements = elements.filter(element => element.name !== parentFunctionName);

  // TODO:
  // console.log(leftRecursionElements, normalElements);

  return elements;
}

interface IChance {
  node: ParentNode;
  headIndex: number;
  tokenIndex: number;
}

class VisiterStore {
  public restChances: IChance[] = [];

  constructor(public scanner: Scanner, public version: number) {}
}

export const execChain = (
  chainNode: ChainNode,
  scanner: Scanner,
  cursorIndex: number,
  solveAst: ISolveAst = args => args
) => {
  // Find where token cursorIndex is in
  const cursorPrevToken = scanner.getPrevTokenFromCharacterIndex(cursorIndex);

  // If cursorPrevToken is null, the cursor prev node is root.
  const cursorPrevNodes: Node[] = cursorPrevToken === null ? [chainNode] : [];

  let success: boolean = false;
  let ast: IAst = null;
  let callVisiterCount = 0;
  let callParentCount = 0;
  let lastMatchUnderShortestRestToken: {
    restTokenCount: number;
    matchNode: MatchNode;
    token: IToken;
  } = null;

  const newVersion = getNewVersion();

  newVisiter(chainNode, newVersion, scanner, {
    onCallVisiter: node => {
      callVisiterCount++;

      if (callVisiterCount > MAX_VISITER_CALL) {
        throw Error('call visiter more then ' + MAX_VISITER_CALL);
      }
    },
    onCallParentNode: node => {
      callParentCount++;

      if (callParentCount > MAX_VISITER_CALL) {
        throw Error('call parent more then' + MAX_VISITER_CALL);
      }
    },
    onSuccess: () => {
      success = true;
      ast = solveAst(chainNode.astResults);
    },
    onMatchNode: (matchNode, store, currentVisiterOption) => {
      const matchResult = matchNode.run(store.scanner);

      if (!matchResult.match) {
        // console.log('xxxxxxx', matchResult.token && matchResult.token.value, matchNode.matching);
        tryChances(matchNode, store, currentVisiterOption);
      } else {
        const restTokenCount = store.scanner.getRestTokenCount();
        if (matchNode.matching.type !== 'loose') {
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
        }

        // console.log('ooooooo', matchResult.token && matchResult.token.value, matchNode.matching);
        // If cursor prev token isn't null, it may a cursor prev node.
        if (cursorPrevToken !== null && matchResult.token === cursorPrevToken) {
          cursorPrevNodes.push(matchNode);
        }

        callParentNode(matchNode, store, currentVisiterOption, matchResult.token);
      }
    },
    onFail: node => {
      success = false;
    }
  });

  // Get next matchings
  let nextMatchings = cursorPrevNodes.reduce(
    (all, cursorPrevMatchNode) => {
      return all.concat(findNextMatchNodes(cursorPrevMatchNode).map(each => each.matching));
    },
    [] as IMatching[]
  );
  nextMatchings = uniqBy(nextMatchings, each => each.type + each.value);

  // Get error message
  let error: {
    token: IToken;
    reason: 'wrong' | 'incomplete';
    suggestion: IMatching[];
  } = null;

  if (!success) {
    const suggestion = uniqBy(
      (lastMatchUnderShortestRestToken
        ? findNextMatchNodes(lastMatchUnderShortestRestToken.matchNode)
        : findNextMatchNodes(chainNode)
      ).map(each => each.matching),
      each => each.type + each.value
    );

    const errorToken =
      lastMatchUnderShortestRestToken && scanner.getNextFromToken(lastMatchUnderShortestRestToken.token);

    if (errorToken) {
      error = {
        suggestion,
        token: errorToken,
        reason: 'wrong'
      };
    } else {
      error = {
        suggestion,
        token: lastMatchUnderShortestRestToken ? lastMatchUnderShortestRestToken.token : null,
        reason: 'incomplete'
      };
    }
  }

  return {
    success,
    ast,
    callVisiterCount,
    nextMatchings: nextMatchings.reverse(),
    error
  };
};

function newVisiter(node: Node, version: number, scanner: Scanner, visiterOption: VisiterOption) {
  const defaultVisiterOption = new VisiterOption();
  defaults(visiterOption, defaultVisiterOption);

  const newStore = new VisiterStore(scanner, version);
  visiter(node, newStore, visiterOption);
}

const visiter = tailCallOptimize((node: Node, store: VisiterStore, visiterOption: VisiterOption) => {
  if (!node) {
    return false;
  }

  if (visiterOption.onCallVisiter) {
    visiterOption.onCallVisiter(node);
  }

  const currentTokenIndex = store.scanner.getIndex();

  if (node instanceof ChainNode) {
    resetHeadByVersion(node, store);
    // If has first set, we can fail soon.
    if (visiterOption.enableFirstSet && node.functionName && node.headIndex === 0 && firstSet.has(node.functionName)) {
      const firstMatchNodes = firstSet.get(node.functionName);

      // If not match any first match node, set false
      if (!firstMatchNodes.some(firstMatchNode => firstMatchNode.run(store.scanner, false).match)) {
        node.headIndex = node.childs.length;

        tryChances(node, store, visiterOption);
        return;
      } else {
        // first set success
      }
    }

    const nextChild = node.childs[node.headIndex];
    if (nextChild) {
      node.headIndex++;
      visiter(nextChild, store, visiterOption);
    } else {
      callParentNode(node, store, visiterOption, visiterOption.generateAst ? node.solveAst(node.astResults) : null);
    }
  } else if (node instanceof MatchNode) {
    visiterOption.onMatchNode(node, store, visiterOption);
  } else if (node instanceof TreeNode) {
    resetHeadByVersion(node, store);

    const nextChild = node.childs[node.headIndex];
    if (node.headIndex < node.childs.length - 1) {
      store.restChances.push({
        node,
        tokenIndex: currentTokenIndex,
        headIndex: node.headIndex + 1
      });
    }
    if (nextChild) {
      node.headIndex++;
      visiter(nextChild, store, visiterOption);
    }
  } else if (node instanceof FunctionNode) {
    const replacedNode = node.run();

    node.parentNode.childs[node.parentIndex] = replacedNode;
    visiter(replacedNode, store, visiterOption);
  } else {
    throw Error('Unexpected node type: ' + node);
  }
});

const callParentNode = tailCallOptimize(
  (node: Node, store: VisiterStore, visiterOption: VisiterOption, astValue: any) => {
    if (visiterOption.onCallParentNode) {
      visiterOption.onCallParentNode(node);
    }

    if (!node.parentNode) {
      // Finish matching!
      if (store.scanner.isEnd()) {
        if (visiterOption.onSuccess) {
          visiterOption.onSuccess();
        }
      } else {
        tryChances(node, store, visiterOption);
      }
      return;
    }

    if (node.parentNode instanceof ChainNode) {
      if (visiterOption.generateAst) {
        if (node.parentNode.isPlus) {
          if (node.parentNode.headIndex === 1) {
            // TODO: 不用push，用具体下标，因为可能有回溯，回溯的时候用push可能导致结果不准确
            node.parentNode.astResults.push([]);
          }
          node.parentNode.astResults[node.parentNode.astResults.length - 1][node.parentIndex] = astValue;
        } else {
          node.parentNode.astResults[node.parentIndex] = astValue;
        }
      }

      // If current node has isPlus, and run into callParentNode means it childs had match successful, so add a new chance.
      // TODO: ast has bug.
      if (node.parentNode.isPlus && node.parentNode.headIndex === node.parentNode.childs.length) {
        // console.log('!!!!!!!!call parent plus, add chance', node.parentNode);
        node.parentNode.plusHeadIndex++;
        store.restChances.push({
          node: node.parentNode,
          headIndex: 0,
          tokenIndex: store.scanner.getIndex()
        });
      }

      visiter(node.parentNode, store, visiterOption);
    } else if (node.parentNode instanceof TreeNode) {
      callParentNode(node.parentNode, store, visiterOption, astValue);
    } else {
      throw Error('Unexpected parent node type: ' + node.parentNode);
    }
  }
);

function tryChances(node: Node, store: VisiterStore, visiterOption: VisiterOption) {
  store.version = getNewVersion();

  if (store.restChances.length === 0) {
    if (visiterOption.onFail) {
      visiterOption.onFail(node);
    }
    return;
  }

  // console.log('try chance, chance before', store.restTreeChances.length);

  const recentChance = store.restChances.pop();

  // console.log('chance after', store.restTreeChances.length);

  // reset scanner index
  store.scanner.setIndex(recentChance.tokenIndex);

  // reset node headIndex
  recentChance.node.headIndex = recentChance.headIndex;

  // reset parent node's index
  recentChance.node.version = store.version;

  // console.log('tryChances', recentChance.node, recentChance.tokenIndex, recentChance.headIndex);

  resetParentsHeadIndexAndVersion(recentChance.node, store.version);

  visiter(recentChance.node, store, visiterOption);
}

function resetHeadByVersion(node: ParentNode, store: VisiterStore) {
  if (node.version !== store.version) {
    // If version not equal, reset headIndex
    node.version = store.version;
    node.headIndex = 0;
    // 清空astResults
    if (node instanceof ChainNode) {
      node.astResults = [];
    }
  }
}

// chain(mulExp, many(mulOp, mulExp)), 假设现在在many里面的mulExp里面，那么此时其实是可以回到many的第一个节点mulOp的，这里是直接移到后面去了应该
const resetParentsHeadIndexAndVersion = tailCallOptimize((node: Node, version: number) => {
  if (node.parentNode) {
    node.parentNode.headIndex = node.parentIndex + 1;

    // Be sure not overflow more than one.
    if (node.parentNode.headIndex > node.parentNode.childs.length) {
      node.parentNode.headIndex = node.parentNode.childs.length;
    }

    node.parentNode.version = version;
    resetParentsHeadIndexAndVersion(node.parentNode, version);
  }
});

// find all tokens that may appear next
function findNextMatchNodes(node: Node): MatchNode[] {
  const newVersion = getNewVersion();
  resetParentsHeadIndexAndVersion(node, newVersion);

  const nextMatchNodes: MatchNode[] = [];

  const visiterOption: VisiterOption = {
    generateAst: false,
    enableFirstSet: false,
    onMatchNode: (matchNode, store, currentVisiterOption) => {
      if (matchNode.matching.type === 'loose' && matchNode.matching.value === true) {
        callParentNode(matchNode, store, currentVisiterOption, null);
      } else {
        nextMatchNodes.push(matchNode);

        // Suppose the match failed, so we can find another possible match chance!
        tryChances(matchNode, store, currentVisiterOption);
      }
    }
  };

  if (node.parentNode) {
    newVisiter(node.parentNode, newVersion, new Scanner([]), visiterOption);
  } else {
    newVisiter(node, newVersion, new Scanner([]), visiterOption);
  }

  return nextMatchNodes;
}

function generateFirstSet(node: ChainNode) {
  const functionName = node.functionName;

  if (firstSet.has(functionName)) {
    return;
  }

  const firstMatchNodes = getFirstOrFunctionSet(node, functionName);
  firstOrFunctionSet.set(functionName, firstMatchNodes);

  solveFirstSet(functionName);

  return firstMatchNodes;
}

function getFirstOrFunctionSet(node: Node, functionName: string): FirstOrFunctionSet[] {
  if (node instanceof ChainNode) {
    if (node.childs[0]) {
      return getFirstOrFunctionSet(node.childs[0], functionName);
    }
  } else if (node instanceof TreeNode) {
    return node.childs.reduce((all, next) => all.concat(getFirstOrFunctionSet(next, functionName)), []);
  } else if (node instanceof MatchNode) {
    return [node];
  } else if (node instanceof FunctionNode) {
    const relatedFunctionName = node.getFunctionName();

    if (relatedSet.has(relatedFunctionName)) {
      relatedSet.get(relatedFunctionName).add(functionName);
    } else {
      relatedSet.set(relatedFunctionName, new Set([functionName]));
    }

    return [relatedFunctionName];
  } else {
    throw Error('Unexpected node: ' + node);
  }
}

function solveFirstSet(functionName: string) {
  if (firstSet.has(functionName)) {
    return;
  }

  const firstMatchNodes = firstOrFunctionSet.get(functionName);

  // Try if relate functionName has done first set.
  const newFirstMatchNodes = firstMatchNodes.reduce(
    (all, firstMatchNode) => {
      if (typeof firstMatchNode === 'string') {
        if (firstSet.has(firstMatchNode)) {
          all = all.concat(firstSet.get(firstMatchNode));
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

  firstOrFunctionSet.set(functionName, newFirstMatchNodes);

  // If all set hasn't function node, we can solve it's relative set.
  if (newFirstMatchNodes.every(firstMatchNode => firstMatchNode instanceof MatchNode)) {
    firstSet.set(functionName, newFirstMatchNodes as MatchNode[]);

    // If this functionName has related functionNames, solve them
    if (relatedSet.has(functionName)) {
      const relatedFunctionNames = relatedSet.get(functionName);
      relatedFunctionNames.forEach(relatedFunctionName => solveFirstSet);
    }
  }
}
