rollup-plugin-external-globals
==============================

[![Build Status](https://travis-ci.org/eight04/rollup-plugin-external-globals.svg?branch=master)](https://travis-ci.org/eight04/rollup-plugin-external-globals)
[![Coverage Status](https://coveralls.io/repos/github/eight04/rollup-plugin-external-globals/badge.svg?branch=master)](https://coveralls.io/github/eight04/rollup-plugin-external-globals?branch=master)
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

Changelog
---------

* 0.1.0 (Aug 5, 2018)

  - Initial release.
