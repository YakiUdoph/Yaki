import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { chromium, type Page } from "playwright-core";
import { createYakiServer } from "./app-server.ts";

const forbiddenMarkers = ["gata: gpt to earn", "monetize your ai chat data", "connect wallet"];
const browserCandidates = [
  process.env.YAKI_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.YAKI_EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter((value): value is string => Boolean(value));

async function findBrowser(): Promise<{ path: string; name: string }> {
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      return { path: candidate, name: candidate.toLowerCase().includes("chrome") ? "Google Chrome" : "Microsoft Edge" };
    } catch {
      // Continue through known install locations.
    }
  }
  throw new Error("Chrome or Edge was not found. Set YAKI_BROWSER_PATH to run the security audit.");
}

const pageAuditExpression = String.raw`(() => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
  };
  const clipped = [...document.querySelectorAll('body *')].filter((element) => {
    if (!visible(element) || element.classList.contains('skip-link')) return false;
    const rect = element.getBoundingClientRect();
    return rect.left < -1 || rect.right > innerWidth + 1;
  }).map((element) => ({ tag: element.tagName, id: element.id, className: String(element.className).slice(0, 100) }));
  const parseColor = (value) => {
    const parts = value.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    return parts.slice(0, 3).map(Number);
  };
  const luminance = (rgb) => {
    const values = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const background = (element) => {
    let current = element;
    while (current) {
      const parsed = parseColor(getComputedStyle(current).backgroundColor);
      const alpha = getComputedStyle(current).backgroundColor.match(/[\d.]+/g)?.[3];
      if (parsed && (alpha === undefined || Number(alpha) > 0.98)) return parsed;
      current = current.parentElement;
    }
    return [255, 255, 255];
  };
  const contrastFailures = [...document.querySelectorAll('body *')].flatMap((element) => {
    if (!visible(element) || element.matches(':disabled')) return [];
    const directText = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent.trim()).join(' ');
    if (!directText) return [];
    const style = getComputedStyle(element);
    const foreground = parseColor(style.color);
    if (!foreground) return [];
    const light = luminance(foreground);
    const dark = luminance(background(element));
    const ratio = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
    const size = Number.parseFloat(style.fontSize);
    const weight = Number.parseInt(style.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const threshold = large ? 3 : 4.5;
    return ratio + 0.01 < threshold ? [{
      tag: element.tagName,
      id: element.id,
      className: String(element.className).slice(0, 100),
      text: directText.slice(0, 100),
      ratio: Number(ratio.toFixed(2)),
      threshold,
    }] : [];
  });
  const footer = document.querySelector('footer');
  const followingVisible = [];
  let sibling = footer?.nextElementSibling;
  while (sibling) {
    if (visible(sibling)) followingVisible.push({ tag: sibling.tagName, id: sibling.id });
    sibling = sibling.nextElementSibling;
  }
  const text = document.documentElement.textContent.toLowerCase();
  return {
    title: document.title,
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clipped,
    contrastFailures,
    scripts: [...document.scripts].map((script) => script.src || 'inline'),
    iframes: [...document.querySelectorAll('iframe')].map((frame) => frame.src),
    walletGlobalPresent: Boolean(globalThis.ethereum),
    forbiddenMarkers: ${JSON.stringify(forbiddenMarkers)}.filter((marker) => text.includes(marker)),
    bodyChildren: [...document.body.children].map((element) => ({
      tag: element.tagName,
      id: element.id,
      visible: visible(element),
    })),
    followingVisible,
    footerBottom: footer?.getBoundingClientRect().bottom,
  };
})()`;

async function captureScreenshot(page: Page, path: string): Promise<void> {
  await page.screenshot({ path, fullPage: true });
}

async function main(): Promise<void> {
  const browser = await findBrowser();
  const deployedUrl = process.env.YAKI_AUDIT_BASE_URL?.trim().replace(/\/+$/u, "");
  const app = deployedUrl ? undefined : createYakiServer({
    check: async ({ address, countryCode }) => ({
      status: "no_match",
      originalAddress: address,
      countryCode,
      candidates: [],
      policy: {
        version: "1.0.0",
        status: "no_match",
        readyForDispatch: false,
        reasons: ["no_candidates", "human_confirmation_required"],
      },
    }),
  });
  if (app) await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  const address = app?.address() as AddressInfo | undefined;
  const appUrl = deployedUrl || `http://127.0.0.1:${address?.port}`;
  const browserProcess = await chromium.launch({
    executablePath: browser.path,
    headless: true,
    args: ["--disable-extensions", "--no-first-run", "--no-default-browser-check"],
  });

  try {
    const context = await browserProcess.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const requests: Array<{ url: string; type: string }> = [];
    const webSockets: string[] = [];
    const consoleErrors: string[] = [];
    page.on("request", (request) => requests.push({ url: request.url(), type: request.resourceType() }));
    page.on("websocket", (socket) => webSockets.push(socket.url()));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    console.log("Audit: loading the server-delivered Yaki page in a clean, isolated browser context.");
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    console.log("Audit: collecting desktop DOM, network, focus, and screenshot evidence.");
    const desktop = await page.evaluate(pageAuditExpression);
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(`({
      target: document.activeElement?.className,
      outlineWidth: getComputedStyle(document.activeElement).outlineWidth,
      outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
    })`);

    await mkdir("artifacts/screenshots", { recursive: true });
    await captureScreenshot(page, "artifacts/screenshots/yaki-security-desktop.png");

    console.log("Audit: collecting 390px mobile evidence.");
    await page.setViewportSize({ width: 390, height: 844 });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const mobile = await page.evaluate(pageAuditExpression);
    await captureScreenshot(page, "artifacts/screenshots/yaki-security-mobile-390.png");

    const source = await fetch(appUrl);
    const html = await source.text();
    const headers = {
      contentSecurityPolicy: source.headers.get("content-security-policy"),
      permissionsPolicy: source.headers.get("permissions-policy"),
      referrerPolicy: source.headers.get("referrer-policy"),
      xContentTypeOptions: source.headers.get("x-content-type-options"),
      xFrameOptions: source.headers.get("x-frame-options"),
    };
    const externalRequests = requests.filter(({ url }) => {
      try {
        return new URL(url).origin !== new URL(appUrl).origin;
      } catch {
        return true;
      }
    });

    assert.deepEqual(desktop.forbiddenMarkers, []);
    assert.deepEqual(mobile.forbiddenMarkers, []);
    assert.deepEqual(desktop.iframes, []);
    assert.deepEqual(mobile.iframes, []);
    assert.equal(desktop.walletGlobalPresent, false);
    assert.equal(mobile.walletGlobalPresent, false);
    assert.deepEqual(desktop.followingVisible, []);
    assert.deepEqual(mobile.followingVisible, []);
    assert.equal(desktop.scrollWidth, desktop.viewportWidth);
    assert.equal(mobile.scrollWidth, mobile.viewportWidth);
    assert.deepEqual(desktop.clipped, []);
    assert.deepEqual(mobile.clipped, []);
    assert.deepEqual(desktop.contrastFailures, []);
    assert.deepEqual(mobile.contrastFailures, []);
    assert.equal(focus.target, "skip-link");
    assert.notEqual(focus.outlineStyle, "none");
    assert.ok(Number.parseFloat(focus.outlineWidth) >= 2);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(webSockets, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(desktop.scripts, [`${appUrl}/app.js`]);
    assert.ok(headers.contentSecurityPolicy?.includes("default-src 'self'"));
    assert.equal(headers.xFrameOptions, "DENY");

    const evidence = {
      runAt: new Date().toISOString(),
      browser: `${browser.name} headless via Playwright, fresh isolated context, extensions disabled`,
      provider: deployedUrl
        ? "deployed page-load audit; no address check and no Geoapify quota consumed"
        : "explicit mock; no Geoapify quota consumed",
      source: {
        status: source.status,
        sha256: createHash("sha256").update(html).digest("hex"),
        forbiddenMarkers: forbiddenMarkers.filter((marker) => html.toLowerCase().includes(marker)),
      },
      network: { requests, externalRequests, webSockets, consoleErrors },
      securityHeaders: headers,
      desktop,
      mobile,
      focus,
      result: "PASS",
    };
    await writeFile("artifacts/visual-security-audit.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(`Visual and security browser audit passed in a clean, extension-disabled ${browser.name} profile.`);
  } finally {
    await browserProcess.close();
    if (app) {
      await new Promise<void>((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Visual security audit failed.");
  process.exitCode = 1;
});
