const PROXY_SUFFIX = '?commonjs-proxy';
const WRAPPED_SUFFIX = '?commonjs-wrapped';
const REQUIREFUNC_ID = "__require"

const isWrappedId = (id, suffix) => id.endsWith(suffix);

function isVirtualModule(id) {
  return id.startsWith("\0");
}

function normaliseVirtualId(id) {
  id = id.replace(/^\0/, '')
  if (id.endsWith(PROXY_SUFFIX)) {
    return id.slice(0, -PROXY_SUFFIX.length);
  }
  if (id.endsWith(WRAPPED_SUFFIX)) {
    return id.slice(0, -WRAPPED_SUFFIX.length);
  }
}

module.exports = {
  PROXY_SUFFIX,
  WRAPPED_SUFFIX,
  REQUIREFUNC_ID,
  isWrappedId,
  isVirtualModule,
  normaliseVirtualId
} 