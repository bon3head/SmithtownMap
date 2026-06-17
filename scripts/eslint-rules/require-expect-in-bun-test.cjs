"use strict";

// Flags test()/it() bodies that contain no expect() call, in files that import
// from "bun:test". A test with no assertion cannot fail meaningfully — it passes
// as long as the body doesn't throw, proving nothing about the code under test.
//
// ESLint 10: rule context exposes `context.sourceCode` (the legacy
// `context.getSourceCode()` accessor was removed). See impl plan §5.3.

module.exports = {
  meta: {
    type: "problem",
    docs: { description: "Require expect() in every bun:test test body" },
    messages: {
      noExpect:
        "Test body has no expect() call — this test cannot fail meaningfully.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    let usesBunTest = false;

    return {
      ImportDeclaration(node) {
        if (node.source.value === "bun:test") usesBunTest = true;
      },

      "CallExpression:exit"(node) {
        if (!usesBunTest) return;
        const fname = node.callee?.name;
        if (fname !== "test" && fname !== "it") return;
        // The test body is the second arg (the arrow / function expression).
        const body = node.arguments?.[1];
        if (
          !body ||
          (body.type !== "ArrowFunctionExpression" &&
            body.type !== "FunctionExpression")
        ) {
          return;
        }
        const bodyText = sourceCode.getText(body);
        if (!/\bexpect\s*\(/.test(bodyText)) {
          context.report({ node, messageId: "noExpect" });
        }
      },
    };
  },
};
