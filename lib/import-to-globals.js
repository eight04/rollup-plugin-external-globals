const {walk} = require("estree-walker");
const isReference = require("is-reference");
const {attachScopes, makeLegalIdentifier} = require("rollup-pluginutils");

function analyzeImport(node, importBindings, code, names, globals) {
  if (!names.hasOwnProperty(node.source.value)) {
    return false;
  }
  globals.add(names[node.source.value]);
  for (const spec of node.specifiers) {
    importBindings.set(spec.local.name, makeGlobalName(
      spec.imported ? spec.imported.name : "default",
      names[node.source.value]
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
  if (parent.type === "Property" && parent.key === parent.value) {
    code.appendLeft(node.end, `: ${name}`);
  } else {
    code.overwrite(node.start, node.end, name, {contentOnly: true});
  }
  // with object shorthand, the node would be accessed twice (.key and .value)
  node.isOverwritten = true;
}
  
function analyzeExportNamed(node, code, names) {
  if (node.declaration || !node.source) {
    return false;
  }
  for (const spec of node.specifiers) {
    const globalName = makeGlobalName(spec.local.name, names[node.source.value]);
    const legalName = /^[\w$]+$/.test(globalName) ? null : `_global_${makeLegalIdentifier(globalName)}`;
    if (!legalName) {
      writeSpecLocal(code, spec, globalName);
    } else {
      code.appendRight(node.start, `const ${legalName} = ${globalName};\n`);
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

function importToGlobals({ast, code, names}) {
  let scope = attachScopes(ast, "scope");
  const bindings = new Map;
  const globals = new Set;
  let isTouched = false;
  
  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      isTouched = analyzeImport(node, bindings, code, names, globals) || isTouched;
    } else if (node.type === "ExportNamedDeclaration") {
      isTouched = analyzeExportNamed(node, code, names) || isTouched;
    }
  }
  
  walk(ast, {
    enter(node, parent) {
      if (/^(import|export)/i.test(node.type)) {
        this.skip();
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
