const MagicString = require("magic-string");
const {walk} = require("estree-walker");
const {attachScopes, createFilter} = require("rollup-pluginutils");
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

function createPlugin(globals, {include, exclude} = {}) {
  const filter = createFilter(include, exclude);
  return {
    name: "rollup-plugin-external-globals",
    transform
  };
  
  function transform(code, id) {
    if (!filter(id)) {
      return;
    }
    if (Object.keys(globals).every(id => !code.includes(id))) {
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
          const skip = this.skip;
          this.skip = () => {
            skip.call(this);
            leaveScope(node);
          };
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
      leave: leaveScope
    });
    return bindings.size ? {
      code: code.toString(),
      map: code.generateMap()
    } : undefined;
    
    function leaveScope(node) {
      if (node.scope) {
        scope = node.scope.parent;
      }
    }
  }
}

module.exports = createPlugin;
