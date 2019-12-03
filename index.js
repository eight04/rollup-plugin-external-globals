const MagicString = require("magic-string");
const {createFilter} = require("rollup-pluginutils");

const importToGlobals = require("./lib/import-to-globals");

function createPlugin(globals, {include, exclude, dynamicWrapper = "Promise.resolve"} = {}) {
  if (!globals) {
    throw new TypeError("Missing mandatory option 'globals'");
  }
  let getName;
  const globalsType = typeof globals;
  const isGlobalsObj = globalsType === "object";
  if (isGlobalsObj) {
    getName = function (name) {
      if (globals.hasOwnProperty(name)) {
        return globals[name];
      }
    };
  } else if (globalsType === "function") {
    getName = globals;
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
  const filter = createFilter(include, exclude);
  return {
    name: "rollup-plugin-external-globals",
    transform
  };

  function transform(code, id) {
    if ((id[0] !== "\0" && !filter(id)) || (isGlobalsObj && Object.keys(globals).every(id => !code.includes(id)))) {
      return;
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
