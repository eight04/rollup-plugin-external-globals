import type { Plugin } from "rollup";

export type VariableName = string;

export type ModuleConfig = {
  /**
   * [name] is the global name of the module
   */
  name:string;
  /**
   * [esmUrl] is the CDN URL for the ESM version of the module
   */
  esmUrl?:string;
};
/**
 * globals is a moduleId/variableName or moduleId/variableName and (ESM)CDN URL map
 * or provide a function that takes the moduleId and returns the variableName
 */
export type ModuleNameMap =
  | Record<string, string|ModuleConfig>
  | ((id: string) => VariableName);

export type ExternalGlobalsOptions = {
  /**
   * [include] is an array of glob patterns. If defined, only matched files would be transformed.
   */
  include?: Array<string>;
  /**
   * [exclude] is an array of glob patterns. Matched files would not be transformed.
   */
  exclude?: Array<string>;
  /**
   * [dynamicWrapper] is used to specify dynamic imports. It accepts a variable name and returns an expression
   */
  dynamicWrapper?: (variableName: VariableName) => string;

  /**
   * [constBindings] is used to decide whether to use `const` to declare variables. Default is `false`
   */
  constBindings?: boolean;
};

export declare function externalGlobals(
  globals: ModuleNameMap,
  options?: ExternalGlobalsOptions
): Plugin;

export = externalGlobals;
