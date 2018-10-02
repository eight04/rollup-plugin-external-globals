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
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {
        foo: "FOO"
      });
      assert.equal(code.trim(), endent`
        console.log(FOO);
      `);
    })
  );
  
  it("default no rewrite", () =>
    withDir(`
      - entry.js: |
          import FOO from "foo";
          console.log(FOO);
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {
        foo: "FOO"
      });
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
  
  it("object shorthand", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          console.log({foo});
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {
        foo: "FOO"
      });
      assert.equal(code.trim(), endent`
        console.log({foo: FOO});
      `);
    })
  );
  
  it("scoped variable", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          {
            console.log(foo);
          }
          {
            const foo = "foo";
            console.log(foo);
          }
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {foo: "FOO"});
      assert.equal(code.trim(), endent`
        {
          console.log(FOO);
        }
        {
          const foo = "foo";
          console.log(foo);
        }
      `);
    })
  );
  
  it("conflict", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          const FOO = 123;
          console.log(foo, FOO);
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {foo: "FOO"});
      assert.equal(code.trim(), endent`
        const _local_FOO = 123;
        console.log(FOO, _local_FOO);
      `);
    })
  );
  
  it("don't touch unused", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          import bar from "bar";
          console.log(foo, bar);
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {foo: "FOO"});
      assert.equal(code.trim(), endent`
        import bar from 'bar';
        
        console.log(FOO, bar);
      `);
    })
  );
  
  it("export from", () =>
    withDir(`
      - entry.js: |
          export {foo as bar} from "foo";
          export {default as baz} from "bak";
          export {default as BOO} from "boo";
          export {mud} from "mud";
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {
        foo: "FOO",
        bak: "BAK",
        boo: "BOO",
        mud: "MUD"
      });
      assert.equal(code.trim(), endent`
        const _global_FOO_foo = FOO.foo;
        const _global_MUD_mud = MUD.mud;
        
        export { _global_FOO_foo as bar, BAK as baz, BOO, _global_MUD_mud as mud };
      `);
    })
  );
  
  it("export from empty", () =>
    withDir(`
      - entry.js: |
          export {} from "foo";
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {foo: "FOO"});
      assert.equal(code.trim(), "");
    })
  );
  
  it("work in exported function", () =>
    withDir(`
      - entry.js: |
          import * as _require_promise_ from "promise";
          export default function () {
            return _require_promise_;
          }
    `, async resolve => {
      const {output: {"entry.js": {code}}} = await bundle(resolve("entry.js"), {promise: "Promise"});
      assert.equal(code.trim(), endent`
        function entry () {
          return Promise;
        }
        
        export default entry;
      `);
    })
  );
});
