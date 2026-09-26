import { test } from "node:test";
import assert from "node:assert/strict";
import { loadI18n } from "./harness.mjs";

test("t() returns the loaded string", async () => {
  const { t, loadLanguage } = loadI18n({ "app.title": "Map Projektor" });
  await loadLanguage("en");
  assert.equal(t("app.title"), "Map Projektor");
});

test("t() fills {var} placeholders and leaves unknown ones visible", async () => {
  const { t, loadLanguage } = loadI18n({ "compare.removeCountry": "Remove {name} from {list}" });
  await loadLanguage("en");
  assert.equal(t("compare.removeCountry", { name: "France" }), "Remove France from {list}");
});

test("t() returns the key and warns when it is missing", async () => {
  // loadLanguage translates the document title, so that key must exist
  const { t, loadLanguage, warnings } = loadI18n({ "app.title": "Map Projektor" });
  await loadLanguage("en");
  assert.equal(t("nope.key"), "nope.key");
  assert.deepEqual(warnings, ["[i18n] missing key: nope.key"]);
});
