export interface IToken {
  // System type
  systemType: string;
  // User custom type
  type: string;
  value: string;
  position?: [number, number];
}
