const MagicString = require("magic-string");
const {createFilter} = require("rollup-pluginutils");

const importToGlobals = require("./lib/import-to-globals");

function createPlugin(globals, {include, exclude, dynamicWrapper = "Promise.resolve"} = {}) {
  const filter = createFilter(include, exclude);
  return {
    name: "rollup-plugin-external-globals",
    transform
  };

  function transform(code, id) {
    if (!globals) {
      throw new TypeError("Missing mandatory option 'globals'");
    }
    if ((id[0] !== "\0" && !filter(id))) {
      return;
    }
    let getName;
    const globalsType = typeof globals;
    if (globalsType === "function") {
      getName = globals;
    } else if (globalsType === "object") {
      if (Object.keys(globals).every(id => !code.includes(id))) {
        return;
      }
      getName = function (name) {
        if (globals.hasOwnProperty(name)) {
          return globals[name];
        }
      };
    } else {
      throw new TypeError(`Unexpected type of 'globals', got '${globalsType}'`);
    }
    let getDynamicWrapper;
    const dynamicWrapperType = typeof dynamicWrapper;
    if (dynamicWrapperType === "function") {
      getDynamicWrapper = dynamicWrapper;
    } else if (dynamicWrapperType === "string") {
      getDynamicWrapper = function (name) {
        return `${dynamicWrapper}(${name})`;
      };
    } else {
      throw new TypeError(`Unexpected type of 'dynamicWrapper', got '${dynamicWrapperType}'`);
    }
    const ast = this.parse(code);
    code = new MagicString(code);
    const isTouched = importToGlobals({
      ast,
      code,
      getName,
      getDynamicWrapper
    });
    return isTouched ? {
      code: code.toString(),
      map: code.generateMap()
    } : undefined;
  }
}

module.exports = createPlugin;
