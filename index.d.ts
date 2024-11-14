import type { Plugin } from 'rollup';
import type { FilterPattern } from '@rollup/pluginutils';

export type VariableName = string;
/**
 * globals is a moduleId/variableName map
 * or provide a function that takes the moduleId and returns the variableName
 */
export type ModuleNameMap =
  | Record<string, string>
  | ((id: string) => VariableName);

export type ExternalGlobalsOptions = {
  /**
   * [include] is a valid `picomatch` glob pattern, or array of patterns. If defined, only matched files would be transformed.
   */
  include?: FilterPattern;
  /**
   * [exclude] is a valid `picomatch` glob pattern, or array of patterns. Matched files would not be transformed.
   */
  exclude?: FilterPattern;
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
