const MagicString = require("magic-string");
const { createFilter } = require("@rollup/pluginutils");

const importToGlobals = require("./lib/import-to-globals");
const { PROXY_SUFFIX, WRAPPED_SUFFIX, isVirtualModule, normaliseVirtualId } = require("./lib/helpers");
const defaultDynamicWrapper = id => `Promise.resolve(${id})`;

function createPlugin(globals, { include, exclude, dynamicWrapper = defaultDynamicWrapper, transformInCommonJs } = {}) {
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
  const resolvedGlobalIdMap = new Map()
  function getNameInternal(id) {
    const name = getName(id);
    if (name) return name;
    if (id.endsWith(PROXY_SUFFIX) || id.endsWith(WRAPPED_SUFFIX)) {
      return resolvedGlobalIdMap.get(normaliseVirtualId(id));
    }
  }
  async function resolveId(importee, importer, options) {
    if (!transformInCommonJs) return null
    try {
      const globalName = getName(importee)
      if (globalName) {
        const resolvedId = await this.resolve(importee, importer, options)
        if (resolvedId.id && !isVirtualModule(resolvedId.id) && !resolvedId.external) {
          resolvedGlobalIdMap.set(resolvedId.id, globalName)
        }
      }
    } catch {
      // ignore
    }
    return null

  }
  const filter = createFilter(include, exclude);
  return {
    name: "rollup-plugin-external-globals",
    options,
    transform
  };

  async function options(rawOptions) {
    const plugins = Array.isArray(rawOptions.plugins)
      ? [...rawOptions.plugins]
      : rawOptions.plugins
        ? [rawOptions.plugins]
        : [];
    plugins.unshift({
      name: 'rollup-plugin-external-globals--resolver',
      resolveId
    });
    return { ...rawOptions, plugins };
  }
  async function transform(code, id) {
    if ((!isVirtualModule(id) && !filter(id)) || (isGlobalsObj && Object.keys(globals).every(id => !code.includes(id)))) {
      return;
    }
    let ast;
    try {
      ast = this.parse(code);
    } catch (err) {
      this.debug({
        message: `Failed to parse code, skip ${id}`,
        cause: err
      });
      return;
    }
    code = new MagicString(code);
    const isTouched = await importToGlobals({
      ast,
      code,
      getName: getNameInternal,
      getDynamicWrapper: dynamicWrapper
    });
    return isTouched ? {
      code: code.toString(),
      map: code.generateMap()
    } : undefined;
  }
}

module.exports = createPlugin;
