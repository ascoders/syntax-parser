import { IMatch, matchAll } from './match';
import { Scanner } from './scanner';

type IMatchFn = () => IMatch;

type Func = IMatchFn | IChain | (() => IChain);

class ChainChild {
  // If type is function, when run it, will expend.
  public type: 'match' | 'chainNode' | 'function';
  public node?: IMatchFn | ChainNode | FunctionNode;
}

export type IChain = (parentNode?: ChainNode) => ChainNode;

export class ChainNode {
  public prev: ChainNode;
  public next: ChainNode;
  public childs: ChainChild[] = [];
  public isFinished = true;

  private currentRunIndex = 0;

  public addChild = (nodeChild: ChainChild) => {
    this.childs.push(nodeChild);
    this.isFinished = false;
  };

  public run = (): { match: boolean; nextNode: ChainNode } => {
    const childNode = this.childs[this.currentRunIndex];

    if (!childNode) {
      this.isFinished = true;
      return { match: false, nextNode: null };
    }

    if (childNode.type === 'function') {
      const functionResult = (childNode.node as FunctionNode).exec();
      // Rewrite current node.
      this.childs[this.currentRunIndex] = createChainChildByFunction(this, functionResult);
      // Rerun.
      return this.run();
    }

    this.isFinished = this.currentRunIndex + 1 > this.childs.length - 1;

    this.currentRunIndex++;

    switch (childNode.type) {
      case 'chainNode':
        return { match: true, nextNode: childNode.node as ChainNode };
      case 'match':
        const matchResult = (childNode.node as IMatchFn)();
        return { match: matchResult, nextNode: null };
      default:
    }
  };
}

export class FunctionNode {
  private func: () => IChain;

  constructor(func: () => IChain) {
    this.func = func;
  }

  public exec = () => {
    return this.func();
  };
}

const linkNode = (prevNode: ChainNode, nextNode: ChainNode) => {
  if (!prevNode || !nextNode) {
    return;
  }

  prevNode.next = nextNode;
  nextNode.prev = prevNode;
};

function createChainChildByFunction(parentChainNode: ChainNode, func: Func) {
  const chainChild = new ChainChild();

  switch (func.prototype.name) {
    case 'match':
      chainChild.type = 'match';
      chainChild.node = func as IMatchFn;
      break;
    case 'chainLineInner':
    case 'chainTreeInner':
    case 'chainTryInner':
      const chainFunc = func as IChain;
      const node = chainFunc();
      node.prev = parentChainNode;

      chainChild.type = 'chainNode';
      chainChild.node = node;
      break;
    default:
      chainChild.type = 'function';
      // To prevent stack overflow, don't run common function immediately.
      const functionNode = new FunctionNode(func as (() => IChain));
      chainChild.node = functionNode;
  }

  return chainChild;
}

export const chainLine = (...funs: Func[]): IChain => {
  function foo(parentNode: ChainNode = null) {
    let firstNode: ChainNode = null;
    let lastNode: ChainNode = null;

    funs.forEach(func => {
      if (!func) {
        return;
      }

      const currentNode = new ChainNode();
      currentNode.addChild(createChainChildByFunction(currentNode, func));
      linkNode(lastNode, currentNode);

      lastNode = currentNode;

      if (!firstNode) {
        firstNode = currentNode;
      }
    });

    if (parentNode) {
      linkNode(parentNode, firstNode);
    }

    return firstNode;
  }
  foo.prototype.name = 'chainLineInner';
  return foo;
};

export const chainTree = (...funs: Func[]): IChain => {
  function foo(parentNode: ChainNode = null) {
    const node = new ChainNode();

    funs.forEach(func => {
      if (!func) {
        return;
      }

      const chainChild = createChainChildByFunction(node, func);
      node.addChild(chainChild);
    });

    if (parentNode) {
      linkNode(parentNode, node);
    }

    return node;
  }
  foo.prototype.name = 'chainLineInner';
  return foo;
};

export const chainLineTry = (...funs: Func[]) => {
  function foo(parentNode: ChainNode = null) {
    return chainTree(chainLine(...funs), matchAll())(parentNode);
  }
  foo.prototype.name = 'chainLineInner';
  return foo;
};

export const chainTreeTry = (...funs: Func[]): any => {
  function foo(parentNode: ChainNode = null) {
    return chainTree(chainTree(...funs), matchAll())(parentNode);
  }
  foo.prototype.name = 'chainTreeInner';
  return foo;
};

interface ITreeChance {
  chainNode: ChainNode;
  tokenIndex: number;
}

function judgeChainResult(result: boolean, scanner: Scanner) {
  if (scanner.isEnd()) {
    return result;
  } else {
    return false;
  }
}

export const execChain = (firstNode: ChainNode, scanner: Scanner) => {
  const treeChances: ITreeChance[] = [];
  let result = judgeChainResult(visiter(firstNode, scanner, treeChances), scanner);

  while (!result && treeChances.length > 0) {
    const newChance = treeChances.pop();
    scanner.setIndex(newChance.tokenIndex);
    result = judgeChainResult(visiter(newChance.chainNode, scanner, treeChances), scanner);
  }

  return result;
};

function visiter(chainNode: ChainNode, scanner: Scanner, treeChances: ITreeChance[]): boolean {
  const currentTokenIndex = scanner.getIndex();

  if (!chainNode) {
    return false;
  }

  const nodeResult = chainNode.run();

  let nestedMatch = nodeResult.match;

  if (nodeResult.match && nodeResult.nextNode) {
    nestedMatch = visiter(nodeResult.nextNode, scanner, treeChances);
  }

  if (nestedMatch) {
    if (!chainNode.isFinished) {
      // It's a new chance, because child match is true, so we can visit next node, but current node is not finished, so if finally falsely, we can go back here.
      treeChances.push({
        chainNode,
        tokenIndex: currentTokenIndex
      });
    }

    if (chainNode.next) {
      return visiter(chainNode.next, scanner, treeChances);
    } else {
      return true;
    }
  } else {
    if (chainNode.isFinished) {
      // Game over, back to root chain.
      return false;
    } else {
      // Try again
      scanner.setIndex(currentTokenIndex);
      return visiter(chainNode, scanner, treeChances);
    }
  }
}
