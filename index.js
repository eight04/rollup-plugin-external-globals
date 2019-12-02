const MagicString = require("magic-string");
const {createFilter} = require("rollup-pluginutils");

const importToGlobals = require("./lib/import-to-globals");

function createPlugin(globals, {include, exclude, dynamicWrapper} = {}) {
  const filter = createFilter(include, exclude);
  return {
    name: "rollup-plugin-external-globals",
    transform
  };

  function transform(code, id) {
    if (!globals || (id[0] !== "\0" && !filter(id))) {
      return;
    }
    let getName;
    if (typeof globals === "object") {
      if (Object.keys(globals).every(id => !code.includes(id))) {
        return;
      }
      getName = function (name) {
        if (globals.hasOwnProperty(name)) {
          return globals[name];
        }
      };
    } else if (globals instanceof Function) {
      getName = globals;
    } else {
      return false;
    }
    const ast = this.parse(code);
    code = new MagicString(code);
    const isTouched = importToGlobals({
      ast,
      code,
      getName,
      dynamicWrapper
    });
    return isTouched ? {
      code: code.toString(),
      map: code.generateMap()
    } : undefined;
  }
}

module.exports = createPlugin;
