/* global describe it */
const assert = require("assert");

const rollup = require("rollup");
const { withDir } = require("tempdir-yaml");
const { default: endent } = require("endent");
const commonjs = require("@rollup/plugin-commonjs");

const createPlugin = require("..");

async function bundle(file, globals, { plugins = [] } = {}, options = {}) {
  const warns = [];
  const bundle = await rollup.rollup({
    input: [file],
    plugins: [
      ...plugins,
      createPlugin(globals, options)
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
    sourcemap: false
  });
  // named output
  for (const file of result.output) {
    result.output[file.fileName] = file;
  }
  result.warns = warns;
  result.modules = modules;
  return result;
}

describe("main", () => {
  it("no globals", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          console.log(foo);
    `, async resolve => {
      await assert.rejects(bundle(resolve("entry.js"), null), {
        name: "TypeError",
        message: /Missing/
      });
    })
  );

  it("invalid globals", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          console.log(foo);
    `, async resolve => {
      await assert.rejects(bundle(resolve("entry.js"), 1), {
        name: "TypeError",
        message: /Unexpected type/
      });
    })
  );

  it("globals function", () =>
    withDir(`
      - entry.js: |
          import bar from "foo";
          console.log(bar);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), id => id.toUpperCase());
      assert.equal(code.trim(), endent`
        console.log(FOO);
      `);
    })
  );

  it("default", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          console.log(foo);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), {
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
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), {
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
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
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
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
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
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), {
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
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
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
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), endent`
        const _local_FOO = 123;
        console.log(FOO, _local_FOO);
      `);
    })
  );

  it("conflict exported", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          export const FOO = 123;
          console.log(foo, FOO);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), endent`
        const _local_FOO = 123;
        console.log(FOO, _local_FOO);
        
        export { _local_FOO as FOO };
      `);
    })
  );

  it("conflict exported 2", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          const FOO = 123;
          export {FOO};
          console.log(foo, FOO);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), endent`
        const _local_FOO = 123;
        console.log(FOO, _local_FOO);

        export { _local_FOO as FOO };
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
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), endent`
        import bar from 'bar';
        
        console.log(FOO, bar);
      `);
    })
  );

  it("dynamic import", () =>
    withDir(`
      - entry.js: |
          import("foo")
            .then(console.log);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), endent`
        Promise.resolve(FOO)
          .then(console.log);
      `);
    })
  );

  it("custom dynamic import", () =>
    withDir(`
      - entry.js: |
          import("foo")
            .then(console.log);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" }, void 0, { dynamicWrapper: (name) => `Promise.all([${name}, BAR])` });
      assert.equal(code.trim(), endent`
        Promise.all([FOO, BAR])
          .then(console.log);
      `);
    })
  );

  it("falsy dynamic import", () =>
    withDir(`
      - entry.js: |
          import bar from "foo";
          console.log(bar);
          import("foo")
            .then(console.log);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" }, void 0, { dynamicWrapper: () => false });
      assert.equal(code.trim(), endent`
        console.log(FOO);
        import('foo')
          .then(console.log);
      `);
    })
  );

  it("invalid dynamic import", () =>
    withDir(`
      - entry.js: |
          import("foo")
            .then(console.log);
    `, async resolve => {
      await assert.rejects(bundle(resolve("entry.js"), { foo: "FOO" }, void 0, { dynamicWrapper: null }), {
        name: "TypeError",
        message: /Unexpected type/
      });
    })
  );

  it("export from name", () =>
    withDir(`
      - entry.js: |
          export {foo as bar} from "foo";
          export {mud} from "mud";
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), {
        foo: "FOO",
        mud: "MUD"
      });
      assert.equal(code.trim(), endent`
        const _global_FOO_foo = FOO.foo;
        const _global_MUD_mud = MUD.mud;
        
        export { _global_FOO_foo as bar, _global_MUD_mud as mud };
      `);
    })
  );

  it("export from name duplicated", () =>
    withDir(`
      - entry.js: |
          export {foo as bar} from "foo";
          export {foo as baz} from "foo";
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), {
        foo: "FOO"
      });
      assert.equal(code.trim(), endent`
        const _global_FOO_foo = FOO.foo;
        
        export { _global_FOO_foo as bar, _global_FOO_foo as baz };
      `);
    })
  );

  // https://github.com/acornjs/acorn/issues/806
  it("export from default", () =>
    withDir(`
      - entry.js: |
          export {default as baz} from "bak";
          export {default as BOO} from "boo";
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), {
        bak: "BAK",
        boo: "BOO",
      });
      assert.equal(code.trim(), endent`
        const _global_BAK = BAK;
        const _global_BOO = BOO;
      
        export { _global_BOO as BOO, _global_BAK as baz };
      `);
    })
  );

  it("export from empty", () =>
    withDir(`
      - entry.js: |
          export {} from "foo";
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), "");
    })
  );

  // https://github.com/eight04/rollup-plugin-external-globals/issues/11
  it("export from others", () =>
    withDir(`
      - entry.js: |
          export {foo} from "bar";
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), "export { foo } from 'bar';");
    })
  );

  it("need an extra assignment when exporting globals", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          
          export {foo};
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), endent`
        const _global_FOO = FOO;
      
        export { _global_FOO as foo };
      `);
    })
  );

  it("no duplicated assignment", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          
          export {foo};
          export {foo as bar};
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), endent`
        const _global_FOO = FOO;
      
        export { _global_FOO as bar, _global_FOO as foo };
      `);
    })
  );

  it("don't affect normal references", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          console.log(foo);
          export {foo};
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { foo: "FOO" });
      assert.equal(code.trim(), endent`
        console.log(FOO);
        const _global_FOO = FOO;
      
        export { _global_FOO as foo };
      `);
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
      const { output: { "entry.js": { code } } } = await bundle(resolve("entry.js"), { promise: "Promise" });
      assert.equal(code.trim(), endent`
        function entry () {
          return Promise;
        }
        
        export { entry as default };
      `);
    })
  );

  it("transform virtual modules", () =>
    withDir(`
      - entry.js: |
          import foo from "foo";
          console.log(foo);
    `, async resolve => {
      let entryCode = "";
      const { output: { "entry.js": { code } } } = await bundle(
        resolve("entry.js"),
        {
          foo: "BAR"
        },
        {
          plugins: [{
            name: "test",
            transform(code, id) {
              if (id.endsWith("entry.js")) {
                entryCode = code;
                return "import '\0virtual';";
              }
            },
            load(id) {
              if (id === "\0virtual") {
                return entryCode;
              }
            },
            resolveId(importee) {
              if (importee === "\0virtual") {
                return importee;
              }
            }
          }]
        }
      );
      assert.equal(code.trim(), endent`
        console.log(BAR);
      `);
    })
  );

  it("transform cjs with default exports", () =>
    withDir(`
      - node_modules:
        - bar:
          - index.js: | 
              module.exports = "BAR";
        - foo:
          - index.js: | 
              const bar = require("bar");
              console.log('foo');
              module.exports = (val) => console.log(val || bar);
      - entry.js: |
          import log from "foo";
          import bar from "bar"
          log(bar);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(
        resolve("entry.js"),
        {
          bar: "BAR"
        },
        {
          plugins: [
            commonjs({
              defaultIsModuleExports: true
            }),
            {
              name: "test",
              resolveId(importee) {
                if (["foo", "bar"].includes(importee)) {
                  return resolve(`node_modules/${importee}/index.js`)
                }
              }
            }]
        },
        {
          transformInCommonJs: true
        }
      );
      assert.equal(code.trim(), endent`
        const bar = BAR;
        console.log('foo');
        var foo = (val) => console.log(val || bar);

        foo(BAR);
      `);
    })
  );

  it("transform cjs with named exports", () =>
    withDir(`
      - bar.js: |
          module.a = "A";
      - entry.js: |
          const { a } = require("bar");
          console.log(a);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(
        resolve("entry.js"),
        {
          bar: "BAR"
        },
        {
          plugins: [
            commonjs({
              defaultIsModuleExports: true
            }),
            {
              name: "test",
              resolveId(importee) {
                if (["bar"].includes(importee)) {
                  return resolve(`${importee}.js`)
                }
              }
            }]
        },
        {
          transformInCommonJs: true
        }
      );
      assert.equal(code.trim(), endent`
      var entry = {};
      
      const { a } = BAR;
      console.log(a);
      
      export { entry as default };
      `);
    })
  );

  it("transform cjs require in function", () =>
    withDir(`
      - bar.js: |
          module.a = "A";
      - foo.js: |
          const a = "A"
          module.exports = (val) => {
            const { a } = require("bar");
            console.log(a);
          }
      - entry.js: |
          import log from "foo";
          import { a } from "bar";
          log(a);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(
        resolve("entry.js"),
        {
          bar: "BAR"
        },
        {
          plugins: [
            commonjs({
              defaultIsModuleExports: true
            }),
            {
              name: "test",
              resolveId(importee) {
                if (["foo", "bar"].includes(importee)) {
                  return resolve(`${importee}.js`)
                }
              }
            }]
        },
        {
          transformInCommonJs: true
        }
      );
      assert.equal(code.trim(), endent`
      var foo = (val) => {
        const { a } = BAR;
        console.log(a);
      };
      
      foo(BAR.a);
      `);
    })
  );

  it("untransform cjs require without transformInCommonJs", () =>
    withDir(`
      - bar.js: |
          module.a = "A";
      - entry.js: |
          const { a } = require("bar");
          console.log(a);
    `, async resolve => {
      const { output: { "entry.js": { code } } } = await bundle(
        resolve("entry.js"),
        {
          bar: "BAR"
        },
        {
          plugins: [
            commonjs({
              defaultIsModuleExports: true
            }),
            {
              name: "test",
              resolveId(importee) {
                if (["bar"].includes(importee)) {
                  return resolve(`${importee}.js`)
                }
              }
            }]
        },
      );
      assert.notEqual(code.trim(), endent`
      var entry = {};
      
      const { a } = BAR;
      console.log(a);
      
      export { entry as default };
      `);
    })
  );
});
