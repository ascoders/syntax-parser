import {
  IMatch,
  match,
  matchFalse,
  matchTrue,
} from './match';
import { Scanner } from './scanner';

type IMatchFn = () => IMatch;

class ChainChild {
  // If type is function, when run it, will expend.
  public type: 'match' | 'chainNode' | 'function';
  public node?: IMatchFn | ChainNode | ChainFunctionNode;
}

export class ChainNode {
  public prev: ChainNode;
  public next: ChainNode;
  public childs: ChainChild[] = [];
  public isFinished = true;
  public scanner: Scanner;

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
      const functionResult = (childNode.node as ChainFunctionNode).exec();
      // Rewrite current node.
      this.childs[this.currentRunIndex] = createChainChildByElement(this, this.scanner, functionResult);
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

export class ChainFunctionNode {
  private chainFunction: IChain;
  private scanner: Scanner;
  private parentNode: ChainNode;

  constructor(func: IChain, scanner: Scanner, parentNode: ChainNode) {
    this.chainFunction = func;
    this.scanner = scanner;
    this.parentNode = parentNode;
  }

  public exec = () => {
    return this.chainFunction(createChainNodeFactory(this.scanner, this.parentNode));
  };
}

const linkNode = (prevNode: ChainNode, nextNode: ChainNode) => {
  if (!prevNode || !nextNode) {
    return;
  }

  prevNode.next = nextNode;
  nextNode.prev = prevNode;
};

// export const chainLineTry = (...funs: Func[]) => {
//   function foo(parentNode: ChainNode = null) {
//     return chainTree(chainLine(...funs), matchAll())(parentNode);
//   }
//   foo.prototype.name = 'chainLineInner';
//   return foo;
// };

export type IChain = (...elements: any[]) => ChainNode;

function createChainChildByElement(parentNode: ChainNode, scanner: Scanner, element: any) {
  const chainChild = new ChainChild();

  if (typeof element === 'string') {
    chainChild.type = 'match';
    chainChild.node = match(element)(scanner);
  } else if (typeof element === 'boolean') {
    chainChild.type = 'match';
    if (element) {
      chainChild.node = matchTrue;
    } else {
      chainChild.node = matchFalse;
    }
  } else if (element instanceof ChainNode) {
    chainChild.type = 'chainNode';
    chainChild.node = element;
  } else if (typeof element === 'function') {
    if (element.prototype.name === 'match') {
      element();
      chainChild.type = 'match';
      chainChild.node = element(scanner);
    } else {
      chainChild.type = 'function';
      // To prevent stack overflow, don't run common function immediately.
      const functionNode = new ChainFunctionNode(element as IChain, scanner, parentNode);
      chainChild.node = functionNode;
    }
  } else {
    throw Error(`unknow element in chain ${element}`);
  }

  return chainChild;
}

export const createChainNodeFactory = (scanner: Scanner, parentNode?: ChainNode) => (...elements: any[]): ChainNode => {
  let firstNode: ChainNode = null;

  elements.reduce((prevNode: ChainNode, element) => {
    const node = new ChainNode();
    node.scanner = scanner;

    if (!firstNode) {
      firstNode = node;
    }

    // Set first、lastNode, and link it
    if (prevNode === parentNode) {
      node.prev = prevNode;
    } else {
      linkNode(prevNode, node);
    }

    if (element instanceof Array) {
      element.forEach(eachElement => {
        node.addChild(createChainChildByElement(node, scanner, eachElement));
      });
    } else {
      node.addChild(createChainChildByElement(node, scanner, element));
    }

    return node;
  }, parentNode);

  return firstNode;
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
