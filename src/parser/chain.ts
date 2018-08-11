import { IToken } from '../lexer/interface';
import { IMatch, match, matchFalse, matchTrue } from './match';
import { Scanner } from './scanner';

let globalVersion = 0;

// tslint:disable:max-classes-per-file

export type IMatchFn = () => IMatch;

// IToken | Array<IToken> | any return object from resolveAst().
export type IAst = IToken | any;

export type Node = MatchNode | FunctionNode | TreeNode | ChainNode;

export type ParentNode = TreeNode | ChainNode;

export interface IMatching {
  // loose not cost token, and result is fixed true of false.
  type: 'string' | 'loose' | 'special';
  value: string | boolean;
}

const MAX_VISITER_CALL = 100000;

class VisiterOption {
  public onCallVisiter?: (node?: Node) => void;
  public onFinish?: () => void;
  public onFail?: (lastNode?: Node) => void;
  public generateAst = true;
  public onMatchNode?: (matchNode: MatchNode, store: VisiterStore) => void = (matchNode, store) => {
    const matchResult = matchNode.run();

    if (!matchResult.match) {
      tryChances(matchNode, store, this);
    } else {
      callParentNode(matchNode, store, this, matchResult.token);
    }
  };
}

class MatchNode {
  public parentNode: ParentNode;

  constructor(private matchFunction: IMatchFn, public matching?: IMatching) {}

  public run = () => this.matchFunction();
}

export class FunctionNode {
  public parentNode: ParentNode;

  constructor(private chainFunction: FunctionElement, private scanner: Scanner) {}

  public run = () => {
    return this.chainFunction(createChainNodeFactory(this.scanner, this.parentNode, this.chainFunction.name));
  };
}

class TreeNode {
  public parentNode: ParentNode;
  public childs: Node[] = [];
  // Current running child index.
  public headIndex = 0;

  public version: number = 0;
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
  public version: number = 0;
}

type SingleElement = string | any;
type IElement = SingleElement | SingleElement[];
type IElements = IElement[];
type ISolveAst = (astResult: IAst[]) => IAst;
export type IChain = (...elements: IElements) => (solveAst?: ISolveAst) => ChainNode;
type FunctionElement = (chain: IChain) => ChainNode;

const createNodeByElement = (
  element: IElement,
  scanner: Scanner,
  parentNode: ParentNode,
  functionName: string
): Node => {
  if (element instanceof Array) {
    const treeNode = new TreeNode();
    treeNode.parentNode = parentNode;
    treeNode.childs = element.map(eachElement => createNodeByElement(eachElement, scanner, treeNode, functionName));
    return treeNode;
  } else if (typeof element === 'string') {
    const matchNode = new MatchNode(match(element)(scanner), {
      type: 'string',
      value: element
    });
    matchNode.parentNode = parentNode;
    return matchNode;
  } else if (typeof element === 'boolean') {
    if (element) {
      const trueMatchNode = new MatchNode(matchTrue, {
        type: 'loose',
        value: true
      });
      trueMatchNode.parentNode = parentNode;
      return trueMatchNode;
    } else {
      const falseMatchNode = new MatchNode(matchFalse, {
        type: 'loose',
        value: false
      });
      falseMatchNode.parentNode = parentNode;
      return falseMatchNode;
    }
  } else if (element instanceof ChainNode) {
    element.parentNode = parentNode;
    element.functionName = functionName;
    return element;
  } else if (typeof element === 'function') {
    if (element.prototype.name === 'match') {
      const matchNode = new MatchNode(element(scanner), {
        type: 'special',
        value: element.prototype.displayName
      });
      matchNode.parentNode = parentNode;
      return matchNode;
    } else {
      const functionNode = new FunctionNode(element as FunctionElement, scanner);
      functionNode.parentNode = parentNode;
      return functionNode;
    }
  } else {
    throw Error(`unknow element in chain ${element}`);
  }
};

export const createChainNodeFactory = (
  scanner: Scanner,
  parentNode?: ParentNode,
  // If parent node is a function, here will get it's name.
  functionName?: string
) => (...elements: IElements) => (solveAst: ISolveAst = args => args): ChainNode => {
  const chainNode = new ChainNode();
  chainNode.parentNode = parentNode;
  chainNode.functionName = functionName;
  chainNode.solveAst = solveAst;

  elements = solveDirectLeftRecursion(elements, functionName);

  chainNode.childs = elements.map(element => createNodeByElement(element, scanner, chainNode, functionName));

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
  public version = 0;

  constructor(public scanner: Scanner) {}
}

export const execChain = (
  chainNode: ChainNode,
  scanner: Scanner,
  cursorIndex: number,
  solveAst: ISolveAst = args => args
) => {
  const visiterStore = new VisiterStore(scanner);
  const visiterOption = new VisiterOption();

  // Find where token cursorIndex is in
  const cursorPrevToken = scanner.getPrevTokenFromCharacterIndex(cursorIndex);
  const cursorPrevMatchNodes: MatchNode[] = [];

  visiterOption.onCallVisiter = () => {
    callVisiterCount++;

    if (callVisiterCount > MAX_VISITER_CALL) {
      throw Error('call visiter more then ' + MAX_VISITER_CALL);
    }
  };

  visiterOption.onFinish = () => {
    success = true;
    ast = solveAst(chainNode.astResults);
  };

  visiterOption.onMatchNode = (matchNode, store) => {
    const matchResult = matchNode.run();

    if (!matchResult.match) {
      tryChances(matchNode, store, visiterOption);
    } else {
      if (matchResult.token === cursorPrevToken) {
        cursorPrevMatchNodes.push(matchNode);
      }

      callParentNode(matchNode, store, visiterOption, matchResult.token);
    }
  };

  visiterOption.onFail = () => {
    success = false;
  };

  let success: boolean = false;
  let ast: IAst = null;
  let callVisiterCount = 0;

  visiter(chainNode, visiterStore, visiterOption);

  const nextMatchNodes = cursorPrevMatchNodes.reduce(
    (all, cursorPrevMatchNode) => {
      return all.concat(findNextMatchNodes(cursorPrevMatchNode));
    },
    [] as MatchNode[]
  );

  return {
    success,
    ast,
    callVisiterCount,
    nextMatchNodes
  };
};

function visiter(node: Node, store: VisiterStore, visiterOption: VisiterOption): boolean {
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
      callParentNode(node, store, visiterOption, node.solveAst(node.astResults));
    }
  } else if (node instanceof MatchNode) {
    visiterOption.onMatchNode(node, store);
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

    const parentIndex = node.parentNode.childs.findIndex(childNode => childNode === node);
    node.parentNode.childs[parentIndex] = replacedNode;
    visiter(replacedNode, store, visiterOption);
  } else {
    throw Error('Unexpected node type: ' + node);
  }
}

function callParentNode(node: Node, store: VisiterStore, visiterOption: VisiterOption, astValue: any) {
  if (!node.parentNode) {
    // Finish matching!
    if (store.scanner.isEnd()) {
      if (visiterOption.onFinish) {
        visiterOption.onFinish();
      }
    } else {
      tryChances(node, store, visiterOption);
    }
    return;
  }

  if (node.parentNode instanceof ChainNode) {
    // Equal to: const parentIndex = node.parentNode.childs.findIndex(childNode => childNode === node);
    if (visiterOption.generateAst) {
      node.parentNode.astResults[node.parentNode.headIndex - 1] = astValue;
    }
    visiter(node.parentNode, store, visiterOption);
  } else if (node.parentNode instanceof TreeNode) {
    callParentNode(node.parentNode, store, visiterOption, astValue);
  } else {
    throw Error('Unexpected parent node type: ' + node.parentNode);
  }
}

function tryChances(node: Node, store: VisiterStore, visiterOption: VisiterOption) {
  store.version = ++globalVersion;

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
  resetParentsHeadIndexAndVersion(recentChance.treeNode, store);

  visiter(recentChance.treeNode, store, visiterOption);
}

function resetHeadByVersion(node: ParentNode, store: VisiterStore, visiterOption: VisiterOption) {
  if (node.version !== store.version) {
    // If version not equal, reset headIndex
    node.version = store.version;
    node.headIndex = 0;
  }
}

function resetParentsHeadIndexAndVersion(node: Node, store: VisiterStore) {
  if (node.parentNode) {
    if (node.parentNode instanceof TreeNode || node.parentNode instanceof ChainNode) {
      const parentIndex = node.parentNode.childs.findIndex(childNode => childNode === node);
      node.parentNode.headIndex = parentIndex + 1;
      node.parentNode.version = store.version;
      resetParentsHeadIndexAndVersion(node.parentNode, store);
    }
  }
}

function findNextMatchNodes(node: Node): MatchNode[] {
  const emptyVisiterStore = new VisiterStore(new Scanner([]));
  emptyVisiterStore.version = ++globalVersion;

  resetParentsHeadIndexAndVersion(node, emptyVisiterStore);

  const visiterOption = new VisiterOption();
  visiterOption.generateAst = false;

  const nextMatchNodes: MatchNode[] = [];

  visiterOption.onMatchNode = (matchNode, store) => {
    if (matchNode.matching.type === 'loose' && matchNode.matching.value === true) {
      callParentNode(matchNode, store, visiterOption, null);
    } else {
      nextMatchNodes.push(matchNode);

      // Suppose the match failed, so we can find another possible match chance!
      tryChances(matchNode, store, visiterOption);
    }
  };

  visiter(node.parentNode, emptyVisiterStore, visiterOption);

  return nextMatchNodes;
}
