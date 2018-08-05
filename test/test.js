/* eslint-env mocha */
const assert = require("assert");

const rollup = require("rollup");
const {withDir} = require("tempdir-yaml");
const endent = require("endent");

const createPlugin = require("..");

async function bundle(file, globals) {
  const warns = [];
  const bundle = await rollup.rollup({
    input: [file],
    plugins: [
      createPlugin(globals)
    ],
    experimentalCodeSplitting: true,
    onwarn(warn) {
      // https://github.com/rollup/rollup/issues/2308
      warns.push(warn);
    }
  });
  const modules = bundle.cache.modules.slice();
  const result = await bundle.generate({
    format: "es",
    legacy: true,
    freeze: false,
    sourcemap: true
  });
  result.warns = warns;
  result.modules = modules;
  return result;
}

describe("main", () => {
  it("default", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          console.log(foo);
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {foo: "FOO"});
      assert.equal(code.trim(), endent`
        console.log(FOO);
      `);
    })
  );
  
  it("named", () =>
    withDir(`
      - entry.js: |
          import {bar} from "foo";
          console.log(bar);
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {foo: "FOO"});
      assert.equal(code.trim(), endent`
        console.log(FOO.bar);
      `);
    })
  );
  
  it("named rename", () =>
    withDir(`
      - entry.js: |
          import {bar as baz} from "foo";
          console.log(baz);
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {foo: "FOO"});
      assert.equal(code.trim(), endent`
        console.log(FOO.bar);
      `);
    })
  );
});
