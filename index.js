const MagicString = require("magic-string");
const {createFilter} = require("@rollup/pluginutils");

const importToGlobals = require("./lib/import-to-globals");
const defaultDynamicWrapper = id => `Promise.resolve(${id})`;

function createPlugin(globals, {include, exclude, dynamicWrapper = defaultDynamicWrapper} = {}) {
  if (!globals) {
    throw new TypeError("Missing mandatory option 'globals'");
  }
  let getName = globals;
  const globalsType = typeof globals;
  const isGlobalsObj = globalsType === "object";
  if (isGlobalsObj) {
    getName = function (name) {
      if (Object.prototype.hasOwnProperty.call(globals, name)) {
        return globals[name];
      }
    };
  } else if (globalsType !== "function") {
    throw new TypeError(`Unexpected type of 'globals', got '${globalsType}'`);
  }
  const dynamicWrapperType = typeof dynamicWrapper;
  if (dynamicWrapperType !== "function") {
    throw new TypeError(`Unexpected type of 'dynamicWrapper', got '${dynamicWrapperType}'`);
  }
  const filter = createFilter(include, exclude);

  let constBindings = false;

  return {
    name: "rollup-plugin-external-globals",
    renderStart,
    transform
  };

  // https://github.com/rollup/rollup/blob/master/CHANGELOG.md#300
  // since rollup@3.0.0 support outputOptions.generatedCode.constBindings
  function renderStart(outputOptions) {
    if (outputOptions.generatedCode) {
      constBindings = outputOptions.generatedCode.constBindings;
    }
  }

  async function transform(code, id) {
    if ((id[0] !== "\0" && !filter(id)) || (isGlobalsObj && Object.keys(globals).every(id => !code.includes(id)))) {
      return;
    }
    const ast = this.parse(code);
    code = new MagicString(code);
    const isTouched = await importToGlobals({
      ast,
      code,
      getName,
      getDynamicWrapper: dynamicWrapper,
      constBindings
    });
    return isTouched ? {
      code: code.toString(),
      map: code.generateMap()
    } : undefined;
  }
}

module.exports = createPlugin;
