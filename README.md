rollup-plugin-external-globals
==============================

[![Build Status](https://travis-ci.org/eight04/rollup-plugin-external-globals.svg?branch=master)](https://travis-ci.org/eight04/rollup-plugin-external-globals)
[![codecov](https://codecov.io/gh/eight04/rollup-plugin-external-globals/branch/master/graph/badge.svg)](https://codecov.io/gh/eight04/rollup-plugin-external-globals)
[![install size](https://packagephobia.now.sh/badge?p=rollup-plugin-external-globals)](https://packagephobia.now.sh/result?p=rollup-plugin-external-globals)

Transform external imports into global variables like Rollup's `output.globals` option. See [rollup/rollup#2374](https://github.com/rollup/rollup/issues/2374)

Installation
------------

```
npm install -D rollup-plugin-external-globals
```

Usage
-----

```js
import externalGlobals from "rollup-plugin-external-globals";

export default {
  input: ["entry.js"],
  output: {
    dir: "dist",
    format: "es"
  },
  plugins: [
    externalGlobals({
      jquery: "$"
    })
  ]
};
```

The above config transforms

```js
import jq from "jquery";

console.log(jq(".test"));
```

into

```js
console.log($(".test"));
```

API
----

This module exports a single function.

### createPlugin

```js
const plugin = createPlugin(
  globals: Object,
  {
    include?: Array,
    exclude?: Array
  } = {}
);
```

`globals` is a `moduleId`/`variableName` map. For example, to map `jquery` module to `$`:

```js
{
  jquery: "$"
}
```

`include` is an array of glob patterns. If defined, only matched files would be transformed.

`exclude` is an array of glob patterns. Matched files would not be transformed.

Changelog
---------

* 0.2.0 (Sep 12, 2018)

  - Change: use `transform` hook.
  - Add: rewrite conflicted variable names.
  - Add: handle export from.

* 0.1.0 (Aug 5, 2018)

  - Initial release.
