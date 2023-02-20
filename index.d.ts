import type {Plugin} from 'rollup'

type VariableName = string
/**
 * globals is a moduleId/variableName map
 * or provide a function that takes the moduleId and returns the variableName
 */
type ModuleNameMap = Record<string, string> | ((id: string) => VariableName)

type ExternalGlobalsOptions = {
  /**
   * [include] is an array of glob patterns. If defined, only matched files would be transformed.
   */
  include?: Array<string>
  /**
   * [exclude] is an array of glob patterns. Matched files would not be transformed.
   */
  exclude?: Array<string>
  /**
   * [dynamicWrapper] is used to specify dynamic imports. It accepts a variable name and returns an expression
   */
  dynamicWrapper?: ((variableName: VariableName) => string)
}

export default function externalGlobals(globals: ModuleNameMap, options?: ExternalGlobalsOptions): Plugin