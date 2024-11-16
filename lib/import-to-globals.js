const {attachScopes, makeLegalIdentifier} = require("@rollup/pluginutils");

let walk, isReference;

async function prepare() {
  [{walk}, {default: isReference}] = await Promise.all([
    import("estree-walker"),
    import("is-reference")
  ]);
}

function analyzeImport(node, importBindings, code, getName, globals) {
  const name = node.source.value && getName(node.source.value);
  if (!name) {
    return false;
  }
  let globalName;
  if(typeof name === "string"){
    globalName=name;
  }
  else if((name instanceof Object)&&Object.prototype.hasOwnProperty.call(name, "name")){
    globalName=name.name;
  }
  globals.add(globalName);
  for (const spec of node.specifiers) {
    importBindings.set(spec.local.name, makeGlobalName(
      spec.imported ? spec.imported.name : "default",
      globalName
    ));
  }
  if(typeof name === "string"||!Object.prototype.hasOwnProperty.call(name, 'esmUrl')){
      code.remove(node.start, node.end);
  }
  else if(Object.prototype.hasOwnProperty.call(name, 'esmUrl')){
    code.overwrite(node.start,node.end, `import ${globalName} from "${name.esmUrl}"`, { contentOnly: true });
  }
  return true;
}

function makeGlobalName(prop, name) {
  if (prop === "default") {
    return name;
  }
  return `${name}.${prop}`;
}

function writeSpecLocal(code, root, spec, name, tempNames, constBindings,globalValue) {
  if (spec.isOverwritten) return;
  // we always need an extra assignment for named export statement
  // https://github.com/eight04/rollup-plugin-external-globals/issues/19
  const localName = `_global_${makeLegalIdentifier(name)}`;
  if (!tempNames.has(localName)) {
    code.appendRight(root.start, `${constBindings ? "const" : "var"} ${localName} = ${name};\n`);
    if(globalValue instanceof Object&&Object.prototype.hasOwnProperty.call(globalValue, "esmUrl")){
      code.appendRight(0, `import ${globalValue.name} from "${globalValue.esmUrl}";`)
    }
    tempNames.add(localName);
  }
  if (spec.local.name === localName) {
    return;
  }
  if (spec.local.start === spec.exported.start && spec.local.end === spec.exported.end) {
    code.appendRight(spec.local.start, `${localName} as `);
  } else {
    code.overwrite(spec.local.start, spec.local.end, localName);
  }
  spec.isOverwritten = true;
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
  } else if (parent.type === "ExportSpecifier" && parent.local.start === parent.exported.start) {
    code.appendLeft(node.start, `${name} as `);
    parent.local.isOverwritten = true;
    parent.exported.isOverwritten = true;
  } else {
    code.overwrite(node.start, node.end, name, {contentOnly: true});
    // FIXME: do we need this?
    node.isOverwritten = true;
  }
}

function analyzeExportNamed(node, code, getName, tempNames, constBindings) {
  if (node.declaration || !node.source || !node.source.value) {
    return false;
  }
  const name = getName(node.source.value);
  if (!name) {
    return false;
  }
  for (const spec of node.specifiers) {
    let globalName;
    if(typeof name === "string"){
      globalName=makeGlobalName(spec.local.name, name);
    }
    else if((name instanceof Object)&&Object.prototype.hasOwnProperty.call(name, "name")){
      globalName=makeGlobalName(spec.local.name, name.name);
    }
    writeSpecLocal(code, node, spec, globalName, tempNames, constBindings,name);
  }
  if (node.specifiers.length) {
    code.overwrite(node.specifiers[node.specifiers.length - 1].end, node.source.end, "}");
  } else {
    code.remove(node.start, node.end);
  }
  return true;
}

function analyzeExportAll(node, code, getName) {
  const name = getName(node.source.value);
  if (!name) {
    return;
  }
  throw new Error("Cannot export all properties from an external variable");
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

// export left hand analyzer
class ExportLeftHand {
  constructor() {
    this.inDeclaration = false;
    this.inLeftHand = false;
  }
  enter(node, parent) {
    if (parent && parent.type === "Program") {
      this.inDeclaration = node.type === "ExportNamedDeclaration";
    }
    if (this.inDeclaration && parent.type === "VariableDeclarator" && parent.id === node) {
      this.inLeftHand = true;
    }
  }
  leave(node, parent) {
    if (this.inLeftHand && parent.type === "VariableDeclarator") {
      this.inLeftHand = false;
    }
  }
}

async function importToGlobals({ast, code, getName, getDynamicWrapper, constBindings}) {
  await prepare();
  let scope = attachScopes(ast, "scope");
  const bindings = new Map;
  const globals = new Set;
  let isTouched = false;
  const tempNames = new Set;
  const exportLeftHand = new ExportLeftHand;

  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      isTouched = analyzeImport(node, bindings, code, getName, globals) || isTouched;
    } else if (node.type === "ExportNamedDeclaration") {
      isTouched = analyzeExportNamed(node, code, getName, tempNames, constBindings) || isTouched;
    } else if (node.type === "ExportAllDeclaration") {
      analyzeExportAll(node, code, getName, tempNames, constBindings);
    }
  }
  
  let topStatement;
  walk(ast, {
    enter(node, parent) {
      exportLeftHand.enter(node, parent);
      if (parent && parent.type === "Program") {
        topStatement = node;
      }
      if (/^importdec/i.test(node.type)) {
        this.skip();
        return;
      }
      if (node.scope) {
        scope = node.scope;
      }
      const source = getDynamicImportSource(node);
      let name= source && getName(source);
      if (isReference(node, parent)) {
        if (bindings.has(node.name) && !scope.contains(node.name)) {
          if (parent.type === "ExportSpecifier") {
            writeSpecLocal(code, topStatement, parent, bindings.get(node.name), tempNames, constBindings,name);
          } else {
            writeIdentifier(code, node, parent, bindings.get(node.name));
          }
        } else if (globals.has(node.name) && scope.contains(node.name)) {
          // conflict with local variable
          writeIdentifier(code, node, parent, `_local_${node.name}`);
          if (exportLeftHand.inLeftHand) {
            code.appendLeft(topStatement.end, `export {_local_${node.name} as ${node.name}};\n`);
            code.remove(topStatement.start, topStatement.declaration.start);
          }
        }
      }
      let dynamicName; 
      if(source &&(getName(source) instanceof Object)&&Object.prototype.hasOwnProperty.call(getName(source), "name")){
        name = source && getName(source).name;
      }
      if(source &&(getName(source) instanceof Object)&&Object.prototype.hasOwnProperty.call(getName(source), "esmUrl")){
        dynamicName = name && getDynamicWrapper(`"${getName(source).esmUrl}"`);
        if(typeof dynamicName==='string'&&/^Promise.resolve/i.test(dynamicName.replace(/\s+/g,''))){
          dynamicName =`import("${getName(source).esmUrl}")`;
        }
      }
      else{
        dynamicName = name && getDynamicWrapper(name);
      }
      if (dynamicName) {
        writeDynamicImport(code, node, dynamicName);
        isTouched = true;
        this.skip();
      }
    },
    leave(node, parent) {
      exportLeftHand.leave(node, parent);
      if (node.scope) {
        scope = node.scope.parent;
      }
    }
  });
  
  return isTouched;
}

module.exports = importToGlobals;
