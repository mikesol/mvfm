import { eq, mvfm, num, semiring, str } from "../../../src/index";

export function buildMathApp() {
  return mvfm(num, semiring);
}

export function buildTextEqApp() {
  return mvfm(str, eq);
}
