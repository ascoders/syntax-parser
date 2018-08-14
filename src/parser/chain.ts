import { defaults, uniqBy } from 'lodash';
import { IToken } from '../lexer/token';
import { IMatch, match, matchFalse, matchTrue } from './match';
import { Scanner } from './scanner';
import { tailCallOptimize } from './utils';

let globalVersion = 0;

function getNewVersion() {
  return ++globalVersion;
}

// tslint:disable:max-classes-per-file

export type IMatchFn = (scanner: Scanner) => IMatch;

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

class VisiterOption {
  public onCallVisiter?: (node?: Node) => void;
  public onSuccess?: () => void;
  public onFail?: (lastNode?: Node) => void;
  public generateAst?: boolean = true;
  public onMatchNode?: (matchNode: MatchNode, store: VisiterStore, visiterOption: VisiterOption) => void = (
    matchNode,
    store,
    visiterOption
  ) => {
    const matchResult = matchNode.run(store.scanner);

    if (!matchResult.match) {
      tryChances(matchNode, store, visiterOption);
    } else {
      callParentNode(matchNode, store, visiterOption, matchResult.token);
    }
  };
}

class MatchNode {
  public parentNode: ParentNode;

  constructor(private matchFunction: IMatchFn, public matching: IMatching, public parentIndex: number) {}

  public run = (scanner: Scanner) => this.matchFunction(scanner);
}

export class FunctionNode {
  public parentNode: ParentNode;

  constructor(private chainFunction: FunctionElement, public parentIndex: number) {}

  public run = () => {
    return this.chainFunction(createChainNodeFactory(this.parentNode, this.chainFunction.name, this.parentIndex));
  };
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

  constructor(public parentIndex: number) {}
}

type SingleElement = string | any;
type IElement = SingleElement | SingleElement[];
type IElements = IElement[];
type ISolveAst = (astResult: IAst[]) => IAst;
export type IChain = (...elements: IElements) => (solveAst?: ISolveAst) => ChainNode;
type FunctionElement = (chain: IChain) => ChainNode;

const createNodeByElement = (
  element: IElement,
  parentNode: ParentNode,
  functionName: string,
  parentIndex: number
): Node => {
  if (element instanceof Array) {
    const treeNode = new TreeNode(parentIndex);
    treeNode.parentNode = parentNode;
    treeNode.childs = element.map((eachElement, childIndex) =>
      createNodeByElement(eachElement, treeNode, functionName, childIndex)
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
    // TODO: ChainNode 不要立刻执行，要在这里最终执行，否则已经初始化的信息可能不准确。
  } else if (element instanceof ChainNode) {
    element.parentNode = parentNode;
    element.functionName = functionName;
    element.parentIndex = parentIndex;
    // element.parentNode.childs[parentIndex] = element;
    return element;
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
    } else {
      const functionNode = new FunctionNode(element as FunctionElement, parentIndex);
      functionNode.parentNode = parentNode;
      return functionNode;
    }
  } else {
    throw Error(`unknow element in chain ${element}`);
  }
};

export const createChainNodeFactory = (
  parentNode?: ParentNode,
  // If parent node is a function, here will get it's name.
  functionName?: string,
  parentIndex = 0
) => (...elements: IElements) => (solveAst: ISolveAst = args => args): ChainNode => {
  const chainNode = new ChainNode(parentIndex);
  chainNode.parentNode = parentNode;
  chainNode.functionName = functionName;
  chainNode.solveAst = solveAst;

  elements = solveDirectLeftRecursion(elements, functionName);

  chainNode.childs = elements.map((element, index) => createNodeByElement(element, chainNode, functionName, index));

  return chainNode;
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

interface ITreeChance {
  treeNode: TreeNode;
  tokenIndex: number;
}

class VisiterStore {
  public restTreeChances: ITreeChance[] = [];

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

  const newVersion = getNewVersion();

  newVisiter(chainNode, newVersion, scanner, {
    onCallVisiter: () => {
      callVisiterCount++;

      if (callVisiterCount > MAX_VISITER_CALL) {
        throw Error('call visiter more then ' + MAX_VISITER_CALL);
      }
    },
    onSuccess: () => {
      success = true;
      ast = solveAst(chainNode.astResults);
    },
    onMatchNode: (matchNode, store, currentVisiterOption) => {
      const matchResult = matchNode.run(scanner);

      if (!matchResult.match) {
        tryChances(matchNode, store, currentVisiterOption);
      } else {
        // If cursor prev token isn't null, it may a cursor prev node.
        if (cursorPrevToken !== null && matchResult.token === cursorPrevToken) {
          cursorPrevNodes.push(matchNode);
        }

        callParentNode(matchNode, store, currentVisiterOption, matchResult.token);
      }
    },
    onFail: () => {
      success = false;
    }
  });

  let nextMatchings = cursorPrevNodes.reduce(
    (all, cursorPrevMatchNode) => {
      return all.concat(findNextMatchNodes(cursorPrevMatchNode).map(each => each.matching));
    },
    [] as IMatching[]
  );

  nextMatchings = uniqBy(nextMatchings, each => each.type + each.value);

  return {
    success,
    ast,
    callVisiterCount,
    nextMatchings: nextMatchings.reverse()
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
    resetHeadByVersion(node, store, visiterOption);

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
    resetHeadByVersion(node, store, visiterOption);

    const nextChild = node.childs[node.headIndex];
    if (node.headIndex < node.childs.length - 1) {
      store.restTreeChances.push({
        treeNode: node,
        tokenIndex: currentTokenIndex
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
        node.parentNode.astResults[node.parentIndex] = astValue;
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

  if (store.restTreeChances.length === 0) {
    if (visiterOption.onFail) {
      visiterOption.onFail(node);
    }
    return;
  }

  const recentChance = store.restTreeChances.pop();

  // reset scanner index
  store.scanner.setIndex(recentChance.tokenIndex);

  // reset parent node's index
  recentChance.treeNode.version = store.version;
  resetParentsHeadIndexAndVersion(recentChance.treeNode, store.version);

  visiter(recentChance.treeNode, store, visiterOption);
}

function resetHeadByVersion(node: ParentNode, store: VisiterStore, visiterOption: VisiterOption) {
  if (node.version !== store.version) {
    // If version not equal, reset headIndex
    node.version = store.version;
    node.headIndex = 0;
  }
}

const resetParentsHeadIndexAndVersion = tailCallOptimize((node: Node, version: number) => {
  if (node.parentNode) {
    node.parentNode.headIndex = node.parentIndex + 1;
    node.parentNode.version = version;
    resetParentsHeadIndexAndVersion(node.parentNode, version);
  }
});

function findNextMatchNodes(node: Node): MatchNode[] {
  const newVersion = getNewVersion();
  resetParentsHeadIndexAndVersion(node, newVersion);

  const nextMatchNodes: MatchNode[] = [];

  const visiterOption: VisiterOption = {
    generateAst: false,
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
