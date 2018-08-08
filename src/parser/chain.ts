import { IMatch, match, matchFalse, matchTrue } from './match';
import { Scanner } from './scanner';

type IMatchFn = () => IMatch;

type IAstStatement = any;

type Node = MatchNode | FunctionNode | TreeNode | ChainNode;

type ParentNode = TreeNode | ChainNode;

class MatchNode {
  public parentNode: ParentNode;

  constructor(private matchFunction: IMatchFn) {}

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
  public astResults?: IAstStatement[] = [];
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
type ISolveAst = (astResult: IAstStatement[]) => IAstStatement;
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
    const matchNode = new MatchNode(match(element)(scanner));
    matchNode.parentNode = parentNode;
    return matchNode;
  } else if (typeof element === 'boolean') {
    if (element) {
      const trueMatchNode = new MatchNode(matchTrue);
      trueMatchNode.parentNode = parentNode;
      return trueMatchNode;
    } else {
      const falseMatchNode = new MatchNode(matchFalse);
      falseMatchNode.parentNode = parentNode;
      return falseMatchNode;
    }
  } else if (element instanceof ChainNode) {
    element.parentNode = parentNode;
    element.functionName = functionName;
    return element;
  } else if (typeof element === 'function') {
    if (element.prototype.name === 'match') {
      const matchNode = new MatchNode(element(scanner));
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
  public treeChances: ITreeChance[] = [];
  public callVisiterCount = 0;
  public callTreeChanceCount = 0;
  public success: boolean = null;
  public failReason: string = null;
}

export const execChain = (chainNode: ChainNode, scanner: Scanner) => {
  const visiterStore = new VisiterStore();
  visiter(chainNode, scanner, visiterStore);

  return visiterStore;
};

const MAX_VISITER_CALL = 100000;
const MAX_TREE_CALL = 10000;

function visiter(node: Node, scanner: Scanner, store: VisiterStore): boolean {
  if (!node) {
    return false;
  }

  store.callVisiterCount++;

  if (store.callVisiterCount > MAX_VISITER_CALL) {
    store.success = false;
    store.failReason = 'call visiter more then ' + MAX_VISITER_CALL;
    return;
  }

  const currentTokenIndex = scanner.getIndex();

  if (node instanceof ChainNode) {
    resetHeadByVersion(node, store);

    const nextChild = node.childs[node.headIndex];
    if (nextChild) {
      node.headIndex++;
      visiter(nextChild, scanner, store);
    } else {
      callParentNode(node, scanner, store, node.solveAst(node.astResults));
    }
  } else if (node instanceof MatchNode) {
    const matchResult = node.run();
    if (!matchResult.match) {
      tryChances(scanner, store);
    } else {
      callParentNode(node, scanner, store, matchResult.token);
    }
  } else if (node instanceof TreeNode) {
    resetHeadByVersion(node, store);

    const nextChild = node.childs[node.headIndex];
    if (node.headIndex < node.childs.length - 1) {
      store.treeChances.push({
        treeNode: node,
        tokenIndex: currentTokenIndex
      });
    }

    if (nextChild) {
      node.headIndex++;
      visiter(nextChild, scanner, store);
    }
  } else if (node instanceof FunctionNode) {
    const replacedNode = node.run();

    const parentIndex = node.parentNode.childs.findIndex(childNode => childNode === node);
    node.parentNode.childs[parentIndex] = replacedNode;
    visiter(replacedNode, scanner, store);
  } else {
    throw Error('Unexpected node type: ' + node);
  }
}

function resetHeadByVersion(node: ParentNode, store: VisiterStore) {
  if (node.version !== store.callTreeChanceCount) {
    // If version not equal, reset headIndex
    node.version = store.callTreeChanceCount;
    node.headIndex = 0;
  }
}

function callParentNode(node: Node, scanner: Scanner, store: VisiterStore, astValue: any) {
  if (!node.parentNode) {
    // Finish matching!
    if (scanner.isEnd()) {
      store.success = true;
    } else {
      tryChances(scanner, store);
    }
    return;
  }

  if (node.parentNode instanceof ChainNode) {
    // Equal to: const parentIndex = node.parentNode.childs.findIndex(childNode => childNode === node);
    node.parentNode.astResults[node.parentNode.headIndex - 1] = astValue;
    visiter(node.parentNode, scanner, store);
  } else if (node.parentNode instanceof TreeNode) {
    callParentNode(node.parentNode, scanner, store, astValue);
  } else {
    throw Error('Unexpected parent node type: ' + node.parentNode);
  }
}

function tryChances(scanner: Scanner, store: VisiterStore) {
  store.callTreeChanceCount++;

  if (store.callTreeChanceCount > MAX_TREE_CALL) {
    store.success = false;
    store.failReason = 'call tree more then ' + MAX_TREE_CALL;
    return;
  }

  if (store.treeChances.length === 0) {
    store.success = false;
    return;
  }

  const recentChance = store.treeChances.pop();

  // reset scanner index
  scanner.setIndex(recentChance.tokenIndex);

  // reset parent node's index
  recentChance.treeNode.version = store.callTreeChanceCount;
  resetParentAndRestChilds(recentChance.treeNode, store);

  visiter(recentChance.treeNode, scanner, store);
}

function resetParentAndRestChilds(node: Node, store: VisiterStore) {
  if (node.parentNode) {
    if (node.parentNode instanceof TreeNode || node.parentNode instanceof ChainNode) {
      const parentIndex = node.parentNode.childs.findIndex(childNode => childNode === node);
      node.parentNode.headIndex = parentIndex + 1;
      node.parentNode.version = store.callTreeChanceCount;
      resetParentAndRestChilds(node.parentNode, store);
    }
  }
}
