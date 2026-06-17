"use strict";

// Flags trivially-true assertions where expect()'s subject and the matcher
// argument are *identical literals* — e.g. expect(true).toBe(true) — so the
// assertion always passes and proves nothing about the code under test.
//
// Only equality matchers are considered. toMatch/toContain etc. are NOT here:
// expect("foobar").toMatch("foo") compares unequal literals and is a real
// substring/regex assertion. Per impl plan §5.2.

const EQUALITY_MATCHERS = new Set(["toBe", "toEqual", "toStrictEqual"]);

// Sentinel so two non-literal operands never compare equal.
const NOT_A_LITERAL = Symbol("not-a-literal");

function literalValue(node) {
  if (!node) return NOT_A_LITERAL;
  if (node.type === "Literal") return node.value;
  // Template literal with no interpolation, e.g. `foo`
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return NOT_A_LITERAL;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "disallow trivially-passing assertions comparing identical literals (e.g. expect(true).toBe(true))",
    },
    messages: {
      trivialLiteral:
        "Trivial assertion: both sides are identical literals, so this always passes and proves nothing about the code under test.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        if (callee.property.type !== "Identifier") return;
        if (!EQUALITY_MATCHERS.has(callee.property.name)) return;

        const expectCall = callee.object;
        if (
          expectCall.type !== "CallExpression" ||
          expectCall.callee.type !== "Identifier" ||
          expectCall.callee.name !== "expect" ||
          expectCall.arguments.length !== 1
        ) {
          return;
        }

        const subject = literalValue(expectCall.arguments[0]);
        const expected = literalValue(node.arguments[0]);
        // Flag only when both operands are literals of equal value.
        if (subject === NOT_A_LITERAL || expected === NOT_A_LITERAL) return;
        if (subject === expected) {
          context.report({ node, messageId: "trivialLiteral" });
        }
      },
    };
  },
};
