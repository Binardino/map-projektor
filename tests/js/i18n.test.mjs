import { test } from "node:test";
import assert from "node:assert/strict";
import { t, loadLanguage } from "../../static/js/i18n.js";

// Just enough of the browser for loadLanguage: it fetches the JSON, then
// applies the static translations (no marked-up elements here).
function serve(messages) {
  globalThis.fetch = async () => ({ json: async () => messages });
  globalThis.document = { querySelectorAll: () => [], documentElement: {}, title: "" };
  return loadLanguage("en");
}

test("t() returns the loaded string", async () => {
  await serve({ "app.title": "Map Projektor" });
  assert.equal(t("app.title"), "Map Projektor");
});

test("t() fills {var} placeholders and leaves unknown ones visible", async () => {
  await serve({ "app.title": "Map Projektor", "compare.removeCountry": "Remove {name} from {list}" });
  assert.equal(t("compare.removeCountry", { name: "France" }), "Remove France from {list}");
});

test("t() returns the key and warns when it is missing", async (context) => {
  // loadLanguage translates the document title, so that key must exist
  await serve({ "app.title": "Map Projektor" });
  const warn = context.mock.method(console, "warn", () => {});
  assert.equal(t("nope.key"), "nope.key");
  assert.deepEqual(warn.mock.calls.map((call) => call.arguments[0]), ["[i18n] missing key: nope.key"]);
});
