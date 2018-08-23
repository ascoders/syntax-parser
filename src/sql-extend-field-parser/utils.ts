export function binaryRecursionToArray(ast: any[]) {
  if (ast[1]) {
    return [ast[0]].concat(ast[1][1]);
  } else {
    return [ast[0]];
  }
}

// 操作符是否为同一类型
export function isOneType(op1: any, op2: any) {
  if (!op1 || !op2) {
    return false;
  }
  const addOp = '+-';
  const mulOp = '*/';
  if (addOp.indexOf(op1.value) !== -1 && addOp.indexOf(op2.value) !== -1) {
    return true;
  }
  if (mulOp.indexOf(op1.value) !== -1 && mulOp.indexOf(op2.value) !== -1) {
    return true;
  }
  return false;
}

export function reversalAst(ast: any) {
  if (!ast[1]) {
    return ast[0];
  }
  let curNode = ast[1][1];
  let curParent;
  while (isOneType(curNode.operator, ast[1][0]) && curNode.left) {
    curParent = curNode;
    curNode = curNode.left;
  }
  // 新节点，代替ast[1][1]最左边的叶节点
  const newNode = {
    operator: ast[1][0],
    left: ast[0],
    right: curNode
  };
  if (!curParent) {
    return newNode;
  }
  curParent.left = newNode;
  return ast[1][1];
}

export function getAstFromArray(ast: any) {
  if (!ast[1]) {
    return ast[0];
  }

  return ast[1][0].reduce((left: any, opAndRight: any) => {
    return { type: 'expression', operator: opAndRight[0], left, right: opAndRight[1] };
  }, ast[0]);
}
