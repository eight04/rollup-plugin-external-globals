const MagicString = require("magic-string");
const {createFilter} = require("rollup-pluginutils");

const importToGlobals = require("./lib/import-to-globals");

function createPlugin(globals, {include, exclude} = {}) {
  const filter = createFilter(include, exclude);
  return {
    name: "rollup-plugin-external-globals",
    transform
  };
  
  function transform(code, id) {
    if (id[0] !== "\0" && !filter(id)) {
      return;
    }
    if (Object.keys(globals).every(id => !code.includes(id))) {
      return;
    }
    const ast = this.parse(code);
    code = new MagicString(code);
    const isTouched = importToGlobals({
      ast,
      code,
      names: globals
    });
    return isTouched ? {
      code: code.toString(),
      map: code.generateMap()
    } : undefined;
  }
}

module.exports = createPlugin;
