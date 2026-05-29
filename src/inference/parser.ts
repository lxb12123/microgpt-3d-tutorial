/**
 * Tiny recursive-descent parser for expressions used in the 02 autograd
 * sandbox. Grammar:
 *
 *   expr   := term (('+' | '-') term)*
 *   term   := pow  (('*' | '/') pow)*
 *   pow    := unary ('**' unary)?
 *   unary  := '-' unary | call | atom
 *   call   := IDENT '(' expr ')'             (IDENT in { relu, exp, log })
 *   atom   := NUM | IDENT | '(' expr ')'
 *
 * Identifiers are single letters; function names are recognized exact strings.
 */
export type AstNode =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'binop'; op: '+' | '-' | '*' | '/' | '**'; left: AstNode; right: AstNode }
  | { type: 'unary'; op: '-'; arg: AstNode }
  | { type: 'call'; fn: 'relu' | 'exp' | 'log'; arg: AstNode };

const FN_NAMES = new Set(['relu', 'exp', 'log']);

interface Lexer {
  src: string;
  pos: number;
}

function skip(l: Lexer) {
  while (l.pos < l.src.length && /\s/.test(l.src[l.pos])) l.pos++;
}

function parseAtom(l: Lexer): AstNode {
  skip(l);
  const ch = l.src[l.pos];
  if (ch === '(') {
    l.pos++;
    const e = parseExpr(l);
    skip(l);
    if (l.src[l.pos] !== ')') throw new Error(`expected closing paren at ${l.pos}`);
    l.pos++;
    return e;
  }
  // number
  const numMatch = /^[0-9]+(\.[0-9]+)?/.exec(l.src.slice(l.pos));
  if (numMatch) {
    l.pos += numMatch[0].length;
    return { type: 'num', value: Number(numMatch[0]) };
  }
  // identifier (possibly function call)
  const identMatch = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(l.src.slice(l.pos));
  if (identMatch) {
    const name = identMatch[0];
    l.pos += name.length;
    skip(l);
    if (l.src[l.pos] === '(') {
      // function call
      if (!FN_NAMES.has(name)) throw new Error(`unknown function: ${name}`);
      l.pos++;
      const arg = parseExpr(l);
      skip(l);
      if (l.src[l.pos] !== ')') throw new Error(`expected closing paren at ${l.pos}`);
      l.pos++;
      return { type: 'call', fn: name as 'relu' | 'exp' | 'log', arg };
    }
    if (name.length !== 1) throw new Error(`variable names must be single letters: '${name}'`);
    return { type: 'var', name };
  }
  throw new Error(`unexpected token at ${l.pos}: '${ch}'`);
}

function parseUnary(l: Lexer): AstNode {
  skip(l);
  if (l.src[l.pos] === '-') {
    l.pos++;
    return { type: 'unary', op: '-', arg: parseUnary(l) };
  }
  return parseAtom(l);
}

function parsePow(l: Lexer): AstNode {
  const left = parseUnary(l);
  skip(l);
  if (l.src[l.pos] === '*' && l.src[l.pos + 1] === '*') {
    l.pos += 2;
    const right = parseUnary(l);
    return { type: 'binop', op: '**', left, right };
  }
  return left;
}

function parseTerm(l: Lexer): AstNode {
  let left = parsePow(l);
  for (;;) {
    skip(l);
    // Match '*' but NOT '**' (which is handled by parsePow)
    if (l.src[l.pos] === '*' && l.src[l.pos + 1] !== '*') {
      l.pos++;
      const right = parsePow(l);
      left = { type: 'binop', op: '*', left, right };
    } else if (l.src[l.pos] === '/') {
      l.pos++;
      const right = parsePow(l);
      left = { type: 'binop', op: '/', left, right };
    } else {
      return left;
    }
  }
}

function parseExpr(l: Lexer): AstNode {
  let left = parseTerm(l);
  for (;;) {
    skip(l);
    if (l.src[l.pos] === '+') {
      l.pos++;
      const right = parseTerm(l);
      left = { type: 'binop', op: '+', left, right };
    } else if (l.src[l.pos] === '-') {
      l.pos++;
      const right = parseTerm(l);
      left = { type: 'binop', op: '-', left, right };
    } else {
      return left;
    }
  }
}

export function parse(src: string): AstNode {
  const l: Lexer = { src, pos: 0 };
  const ast = parseExpr(l);
  skip(l);
  if (l.pos < l.src.length) throw new Error(`unexpected trailing input at ${l.pos}: '${l.src.slice(l.pos)}'`);
  return ast;
}
