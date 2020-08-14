const {walk} = require("estree-walker");
const isReference = require("is-reference");
const {attachScopes, makeLegalIdentifier} = require("@rollup/pluginutils");

function analyzeImport(node, importBindings, code, getName, globals) {
  const name = node.source.value && getName(node.source.value);
  if (!name) {
    return false;
  }
  globals.add(name);
  for (const spec of node.specifiers) {
    importBindings.set(spec.local.name, makeGlobalName(
      spec.imported ? spec.imported.name : "default",
      name
    ));
  }
  code.remove(node.start, node.end);
  return true;
}

function makeGlobalName(prop, name) {
  if (prop === "default") {
    return name;
  }
  return `${name}.${prop}`;
}

function writeSpecLocal(code, spec, name) {
  if (spec.local.name === name) {
    return;
  }
  if (spec.local === spec.exported) {
    code.appendRight(spec.local.start, `${name} as `);
  } else {
    code.overwrite(spec.local.start, spec.local.end, name);
  }
}

function writeIdentifier(code, node, parent, name) {
  if (node.name === name || node.isOverwritten) {
    return;
  }
  // 2020/8/14, parent.key and parent.value is no longer the same object. However, the shape is the same.
  if (parent.type === "Property" && parent.key.start === parent.value.start) {
    code.appendLeft(node.end, `: ${name}`);
    parent.key.isOverwritten = true;
    parent.value.isOverwritten = true;
  } else {
    code.overwrite(node.start, node.end, name, {contentOnly: true});
    // FIXME: do we need this?
    node.isOverwritten = true;
  }
}

function analyzeExportNamed(node, code, getName, tempNames) {
  if (node.declaration || !node.source || !node.source.value) {
    return false;
  }
  const name = getName(node.source.value);
  if (!name) {
    return false;
  }
  for (const spec of node.specifiers) {
    const globalName = makeGlobalName(spec.local.name, name);
    const legalName = /^[\w$]+$/.test(globalName) ? null : `_global_${makeLegalIdentifier(globalName)}`;
    if (!legalName) {
      writeSpecLocal(code, spec, globalName);
    } else {
      if (!tempNames.has(legalName)) {
        code.appendRight(node.start, `const ${legalName} = ${globalName};\n`);
        tempNames.add(legalName);
      }
      writeSpecLocal(code, spec, legalName);
    }
  }
  if (node.specifiers.length) {
    code.overwrite(node.specifiers[node.specifiers.length - 1].end, node.source.end, "}");
  } else {
    code.remove(node.start, node.end);
  }
  return true;
}

function writeDynamicImport(code, node, content) {
  code.overwrite(node.start, node.end, content);
}

function getDynamicImportSource(node) {
  if (node.type === "ImportExpression") {
    return node.source.value;
  }
  if (node.type === "CallExpression" && node.callee.type === "Import") {
    return node.arguments[0].value;
  }
}

function importToGlobals({ast, code, getName, getDynamicWrapper}) {
  let scope = attachScopes(ast, "scope");
  const bindings = new Map;
  const globals = new Set;
  let isTouched = false;
  const tempNames = new Set;

  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      isTouched = analyzeImport(node, bindings, code, getName, globals) || isTouched;
    } else if (node.type === "ExportNamedDeclaration") {
      isTouched = analyzeExportNamed(node, code, getName, tempNames) || isTouched;
    }
  }

  walk(ast, {
    enter(node, parent) {
      if (/^importdec/i.test(node.type)) {
        this.skip();
        return;
      }
      if (node.scope) {
        scope = node.scope;
      }
      if (isReference(node, parent)) {
        if (bindings.has(node.name) && !scope.contains(node.name)) {
          writeIdentifier(code, node, parent, bindings.get(node.name));
        } else if (globals.has(node.name) && scope.contains(node.name)) {
          writeIdentifier(code, node, parent, `_local_${node.name}`);
        }
      }
      const source = getDynamicImportSource(node);
      const name = source && getName(source);
      const dynamicName = name && getDynamicWrapper(name);
      if (dynamicName) {
        writeDynamicImport(code, node, dynamicName);
        isTouched = true;
        this.skip();
      }
    },
    leave(node) {
      if (node.scope) {
        scope = node.scope.parent;
      }
    }
  });

  return isTouched;
}

module.exports = importToGlobals;
