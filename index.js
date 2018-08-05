const MagicString = require("magic-string");
const {walk} = require("estree-walker");
const {attachScopes} = require("rollup-pluginutils");
const isReference = require("is-reference");

function extractBindings(code, bindings, node) {
  const source = node.source.value;
  for (const spec of node.specifiers) {
    if (spec.type === "ImportDefaultSpecifier") {
      bindings.set(spec.local.name, [source, "default"]);
    } else {
      bindings.set(spec.local.name, [source, spec.imported.name]);
    }
  }
  code.remove(node.start, node.end);
}

function writeBinding(code, node, [bindingSource, bindingName], globals) {
  if (bindingName === "default") {
    code.overwrite(node.start, node.end, globals[bindingSource]);
  } else {
    code.overwrite(node.start, node.end, `${globals[bindingSource]}.${bindingName}`);
  }
}

function createPlugin(globals) {
  return {
    name: "rollup-plugin-cjs-es",
    options,
    transformChunk
  };
  
  function options(options) {
    options.external.push(...Object.keys(globals));
    return options;
  }
  
  function transformChunk(code, options, chunk) {
    if (chunk.dependencies.every(m => !globals.hasOwnProperty(m.id))) {
      return;
    }
    const ast = this.parse(code);
    let scope = attachScopes(ast, "scope");
    const bindings = new Map;
    code = new MagicString(code);
    walk(ast, {
      enter(node, parent) {
        if (node.scope) {
          scope = node.scope;
        }
        if (node.type === "ImportDeclaration" && globals.hasOwnProperty(node.source.value)) {
          extractBindings(code, bindings, node);
          this.skip();
        } else if (
          node.type === "Identifier" &&
          isReference(node, parent) &&
          !scope.contains(node.name) &&
          bindings.has(node.name)
        ) {
          writeBinding(code, node, bindings.get(node.name), globals);
        }
      },
      leave(node) {
        if (node.scope) {
          // FIXME: this would break if someone called this.skip during enter().
          scope = node.scope.parent;
        }
      }
    });
    if (bindings.size) {
      return {
        code: code.toString(),
        map: code.generateMap()
      };
    }
  }
}

module.exports = createPlugin;
