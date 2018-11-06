export function isOkay(obj: any) {
  return obj != null;
}

export function flattenAll(arr: any[]) {
  return arr.filter(part => isOkay(part)).reduce((prev, cur) => prev.concat(cur), []);
}
