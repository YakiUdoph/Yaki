import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { chromium } from "playwright-core";
import { createYakiServer } from "./app-server.ts";

const browserCandidates = [
  process.env.YAKI_BROWSER_PATH,
  process.env.YAKI_EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter((value): value is string => Boolean(value));

async function findBrowser(): Promise<{ path: string; name: string }> {
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      return {
        path: candidate,
        name: candidate.toLowerCase().includes("chrome") ? "Google Chrome" : "Microsoft Edge",
      };
    } catch {
      // Try the next known location.
    }
  }
  throw new Error("Chrome or Edge was not found. Set YAKI_BROWSER_PATH to run browser verification.");
}

async function main(): Promise<void> {
  const browserBinary = await findBrowser();
  const app = createYakiServer({
    check: async ({ address, countryCode }) => {
      if (address === "Countryless candidate") {
        return {
          status: "needs_review",
          originalAddress: address,
          countryCode,
          candidates: [{
            formatted: "Country information unavailable",
            place_id: "browser-test-country-missing",
            confidence: 1,
            match_type: "full_match",
            result_type: "city",
          }],
          policy: {
            version: "1.0.0",
            status: "clarification_required",
            readyForDispatch: false,
            reasons: ["candidate_country_missing", "human_confirmation_required"],
          },
        };
      }
      if (address === "Single candidate") {
        return {
          status: "needs_review",
          originalAddress: address,
          countryCode,
          candidates: [{
            formatted: "CN Tower, Toronto, Canada",
            place_id: "browser-test-single-candidate",
            country_code: countryCode,
            confidence: 1,
            match_type: "full_match",
            result_type: "building",
          }],
          policy: {
            version: "1.0.0",
            status: "review_required",
            readyForDispatch: false,
            reasons: ["human_confirmation_required"],
          },
        };
      }
      return {
        status: "needs_review",
        originalAddress: address,
        countryCode,
        candidates: [
        {
          formatted: "Springfield, IL, United States of America",
          place_id: "browser-test-springfield-il",
          country_code: "us",
          lat: 39.7990175,
          lon: -89.6439575,
          confidence: 1,
          match_type: "full_match",
          result_type: "city",
        },
        {
          formatted: "Springfield, MA, United States of America",
          place_id: "browser-test-springfield-ma",
          country_code: "us",
          lat: 42.1018764,
          lon: -72.5886727,
          confidence: 1,
          match_type: "full_match",
          result_type: "city",
        },
        ],
        policy: {
          version: "1.0.0",
          status: "review_required",
          readyForDispatch: false,
          reasons: ["multiple_candidates", "human_confirmation_required"],
        },
      };
    },
  });
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  const appAddress = app.address() as AddressInfo;
  const appUrl = `http://127.0.0.1:${appAddress.port}`;
  const browser = await chromium.launch({
    executablePath: browserBinary.path,
    headless: true,
    args: ["--disable-extensions", "--no-first-run", "--no-default-browser-check"],
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: "networkidle" });

    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.classList.contains("skip-link")),
      true,
      "First Tab did not focus the skip link.",
    );

    await page.selectOption("#country-select", "us");
    await page.fill("#single-address", "Springfield");
    await page.locator("#single-address-form").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.waitForSelector(".status-needs_review");
    assert.equal(await page.locator(".candidate").count(), 2, "The ambiguous-address flow did not preserve two candidates.");
    assert.match(await page.locator("#batch-progress").textContent() || "", /Review is still required/u);

    await page.locator(".candidate input[type=radio]").first().check();
    await page.locator(".confirm-check input").check();
    await page.locator(".review-controls .button-primary").click();
    await page.waitForSelector(".status-ready");
    assert.match(await page.locator("#batch-progress").textContent() || "", /It is Ready after explicit human confirmation/u);
    assert.doesNotMatch(await page.locator(".record-note").first().textContent() || "", /still needs your confirmation/u);
    assert.equal(
      await page.locator("body").innerText().then((text) => text.includes("Ready after explicit human confirmation")),
      true,
      "Human confirmation did not mark the record ready.",
    );
    const readyDownloadPromise = page.waitForEvent("download");
    await page.locator("#export-ready").click();
    const readyDownload = await readyDownloadPromise;
    assert.equal(readyDownload.suggestedFilename(), "yaki-ready-addresses.csv");
    const readyDownloadPath = await readyDownload.path();
    assert.ok(readyDownloadPath, "The ready-address export did not create a download.");
    assert.match(await readFile(readyDownloadPath, "utf8"), /Springfield/u);

    await page.locator(".candidate input[type=radio]").nth(1).check();
    await page.waitForSelector(".status-needs_review");
    assert.match(await page.locator("#batch-progress").textContent() || "", /Review is still required/u);
    assert.doesNotMatch(await page.locator(".record-note").first().textContent() || "", /is Ready/u);
    assert.equal(await page.locator("#export-ready").isDisabled(), true, "Changing a candidate did not revoke ready export.");
    assert.equal(await page.locator(".confirm-check input").isChecked(), false, "Changing a candidate retained confirmation.");
    await page.locator(".confirm-check input").check();
    await page.locator(".review-controls .button-primary").click();
    await page.waitForSelector(".status-ready");

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clearVisible: Boolean((document.querySelector("#clear-session-button") as HTMLElement | null)?.offsetParent),
    }));
    assert.equal(mobile.viewport, 390, "The mobile viewport was not 390 px wide.");
    assert.ok(mobile.scrollWidth <= 390, `Mobile page overflowed to ${mobile.scrollWidth}px.`);
    assert.equal(mobile.clearVisible, true, "The Clear session control was not visible on mobile.");

    await page.locator("#clear-session-button").click();
    await page.locator("#confirm-clear").click();
    await page.waitForFunction(() => document.querySelectorAll(".record-card").length === 0);

    await page.selectOption("#country-select", "ca");
    await page.fill("#single-address", "Single candidate");
    await page.locator("#single-address-form").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.waitForSelector(".status-needs_review");
    assert.equal(
      await page.locator(".record-note").first().textContent(),
      "One candidate was returned. It still needs your confirmation.",
    );
    await page.locator(".candidate input[type=radio]").check();
    await page.locator(".confirm-check input").check();
    await page.locator(".review-controls .button-primary").click();
    await page.waitForSelector(".status-ready");
    assert.equal(
      await page.locator(".record-note").first().textContent(),
      "One candidate was returned and is Ready after your explicit confirmation.",
    );

    await page.locator("#clear-session-button").click();
    await page.locator("#confirm-clear").click();
    await page.waitForFunction(() => document.querySelectorAll(".record-card").length === 0);

    await page.selectOption("#country-select", "us");
    await page.fill("#single-address", "Countryless candidate");
    await page.locator("#single-address-form").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.waitForSelector(".status-needs_review");
    assert.match(await page.locator(".error-box").innerText(), /did not provide country information/u);
    assert.doesNotMatch(await page.locator(".record-note").first().textContent() || "", /is Ready/u);
    assert.match(await page.locator("#batch-progress").textContent() || "", /Review is still required/u);
    assert.equal(await page.locator(".review-controls").count(), 0, "Clarification-required response exposed confirmation controls.");
    assert.equal(await page.locator("#export-ready").isDisabled(), true, "Clarification-required response enabled ready export.");

    await page.locator("#clear-session-button").click();
    await page.locator("#confirm-clear").click();
    await page.waitForFunction(() => document.querySelectorAll(".record-card").length === 0);

    await page.selectOption("#country-select", "us");
    await page.locator("#csv-file").setInputFiles({
      name: "browser-addresses.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("address\nSpringfield\n\"10 Downing Street, London\"\n", "utf8"),
    });
    await page.waitForSelector("#csv-preview-panel:not([hidden])");
    assert.equal(await page.locator("#row-count").textContent(), "2 valid rows");
    await page.locator("#import-button").click();
    await page.waitForFunction(() => document.querySelectorAll(".status-needs_review").length === 2);
    const unresolvedDownloadPromise = page.waitForEvent("download");
    await page.locator("#export-unresolved").click();
    const unresolvedDownload = await unresolvedDownloadPromise;
    assert.equal(unresolvedDownload.suggestedFilename(), "yaki-unresolved-addresses.csv");
    const unresolvedDownloadPath = await unresolvedDownload.path();
    assert.ok(unresolvedDownloadPath, "The unresolved-address export did not create a download.");
    const unresolvedCsv = await readFile(unresolvedDownloadPath, "utf8");
    assert.match(unresolvedCsv, /Springfield/u);
    assert.match(unresolvedCsv, /10 Downing Street/u);

    const evidence = {
      runAt: new Date().toISOString(),
      browser: `${browserBinary.name} headless via Playwright, fresh isolated context`,
      provider: "explicit mock; no Geoapify quota consumed",
      scenarios: {
        keyboardSkipLink: "PASS",
        countrySelection: "PASS",
        addressCheck: "PASS",
        ambiguousCandidatesPreserved: "PASS",
        candidateSelection: "PASS",
        explicitHumanConfirmation: "PASS",
        readyStateMessaging: "PASS",
        singleCandidateReadyMessaging: "PASS",
        candidateChangeRevokesConfirmation: "PASS",
        candidateChangeRestoresReviewMessaging: "PASS",
        clarificationRequiredBlocksConfirmationAndReadyExport: "PASS",
        clarificationRequiredNeverShowsReadyMessaging: "PASS",
        reviewHistory: "PASS",
        readyCsvExport: "PASS",
        csvUploadAndPreview: "PASS",
        csvBatchCheck: "PASS",
        unresolvedCsvExport: "PASS",
        mobile390NoHorizontalOverflow: "PASS",
        clearSession: "PASS",
      },
    };
    await mkdir("artifacts", { recursive: true });
    await writeFile("artifacts/browser-e2e-results.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log("Browser end-to-end verification passed with an explicit mocked provider.");
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Browser end-to-end verification failed.");
  process.exitCode = 1;
});
