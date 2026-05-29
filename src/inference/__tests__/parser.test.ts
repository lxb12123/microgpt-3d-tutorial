import { describe, expect, it } from 'vitest';
import { parse, type AstNode } from '../parser';

describe('parser', () => {
  it('parses (a + b) * c', () => {
    const ast = parse('(a + b) * c');
    expect(ast).toEqual<AstNode>({
      type: 'binop',
      op: '*',
      left: {
        type: 'binop',
        op: '+',
        left: { type: 'var', name: 'a' },
        right: { type: 'var', name: 'b' },
      },
      right: { type: 'var', name: 'c' },
    });
  });

  it('parses relu(x * w + b)', () => {
    const ast = parse('relu(x * w + b)');
    expect(ast).toEqual<AstNode>({
      type: 'call',
      fn: 'relu',
      arg: {
        type: 'binop',
        op: '+',
        left: {
          type: 'binop',
          op: '*',
          left: { type: 'var', name: 'x' },
          right: { type: 'var', name: 'w' },
        },
        right: { type: 'var', name: 'b' },
      },
    });
  });

  it('parses x ** 3', () => {
    const ast = parse('x ** 3');
    expect(ast).toEqual<AstNode>({
      type: 'binop',
      op: '**',
      left: { type: 'var', name: 'x' },
      right: { type: 'num', value: 3 },
    });
  });

  it('throws on garbage', () => {
    expect(() => parse('a + + b')).toThrow();
    expect(() => parse('(a + b')).toThrow(/paren/i);
    expect(() => parse('frobnicate(x)')).toThrow(/unknown function/i);
  });

  it('collects variable names', () => {
    const ast = parse('(a + b) * c + a');
    const names = new Set<string>();
    const walk = (n: AstNode) => {
      if (n.type === 'var') names.add(n.name);
      else if (n.type === 'binop') { walk(n.left); walk(n.right); }
      else if (n.type === 'call') walk(n.arg);
      else if (n.type === 'unary') walk(n.arg);
    };
    walk(ast);
    expect([...names].sort()).toEqual(['a', 'b', 'c']);
  });
});
