import { expect, test } from "@playwright/test";
import path from "node:path";
import os from "node:os";
const root = path.join(os.tmpdir(), "ride-archive-fixtures");
async function choose(
  page: import("@playwright/test").Page,
  label: string,
  option: string,
) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function capture(
  page: import("@playwright/test").Page,
  options: Parameters<import("@playwright/test").Page["screenshot"]>[0],
) {
  await expect(
    page.getByRole("link", { name: "Ride Archive home" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await page.screenshot(options);
}

async function importFixture(
  page: import("@playwright/test").Page,
  kind = "valid",
) {
  await page
    .getByRole("button", { name: "Import folder", exact: true })
    .click();
  await page
    .getByLabel("Recording folder", { exact: true })
    .setInputFiles(path.join(root, kind));
  await expect(
    page.getByRole("heading", {
      name: kind !== "invalid" ? "Ready to import" : "Strict import rejected",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: kind !== "invalid" ? "Import trip" : "Recover playable videos",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
test("empty, valid import, playback across days, seek, speed, bookmark, correction and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Watch your ride, start to finish." }),
  ).toBeVisible();
  await importFixture(page);
  await expect(
    page.getByRole("heading", { name: "26 August 2026" }),
  ).toBeVisible();
  await expect(page.getByLabel("Recorded time")).toHaveAttribute("max", "4");
  await choose(page, "Playback speed", "2×");
  await page.getByLabel("Volume", { exact: true }).fill("0.5");
  await page.getByRole("button", { name: "Entire trip", exact: true }).click();
  await expect(page.getByLabel("Recorded time")).toHaveAttribute("max", "6");
  await page.getByLabel("Recorded time").fill("4.4");
  await expect(
    page.getByRole("heading", { name: "27 August 2026" }),
  ).toBeVisible();
  await expect(
    page.locator('video[aria-label="Trip recording"]'),
  ).toHaveJSProperty("playbackRate", 2);
  await expect(
    page.locator('video[aria-label="Trip recording"]'),
  ).toHaveJSProperty("volume", 0.5);
  await page
    .getByRole("button", { name: "Bookmark current moment", exact: true })
    .click();
  await page.getByRole("textbox", { name: /Note for/ }).fill("A saved moment");
  await page.getByRole("button", { name: "Close details" }).click();
  await page
    .getByLabel("Search recordings", { exact: true })
    .fill("saved moment");
  await expect(
    page.getByRole("list", { name: "Matching recordings" }),
  ).toContainText("A saved moment");
  await page.getByRole("button", { name: "Clear filter" }).click();
  await page.getByRole("button", { name: "Toggle recording details" }).click();
  await page.getByLabel("Session start").fill("2026-08-28T00:00:00");
  await page.getByRole("button", { name: "Apply correction" }).click();
  await expect(
    page.getByRole("heading", { name: "28 August 2026" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "27 August 2026" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByLabel("Recorded time").fill("0");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "27 August 2026" }),
  ).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(
    page.getByText("Reconnect your footage.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /August 2026/ }),
  ).toBeVisible();
  await page
    .getByLabel("Reconnect recording folder", { exact: true })
    .setInputFiles(path.join(root, "valid"));
  await expect(
    page.getByText("Reconnect your footage.", { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Recorded time").fill("5.2");
  await page.reload();
  await page
    .getByLabel("Reconnect recording folder", { exact: true })
    .setInputFiles(path.join(root, "valid"));
  await expect(
    page.locator('video[aria-label="Trip recording"]'),
  ).toHaveJSProperty("playbackRate", 2);
  await expect(
    page.locator('video[aria-label="Trip recording"]'),
  ).toHaveJSProperty("volume", 0.5);
  await expect
    .poll(async () =>
      page
        .locator('video[aria-label="Trip recording"]')
        .evaluate((v: HTMLVideoElement) => Math.abs(v.currentTime - 1.2)),
    )
    .toBeLessThan(0.2);
  expect(errors).toEqual([]);
});
test("strict rejection, explicit recovery, health report and no network upload", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") requests.push(r.method() + " " + r.url());
  });
  await page.goto("/");
  await importFixture(page, "invalid");
  await page.getByRole("button", { name: /Import health/ }).click();
  await expect(page.getByRole("dialog")).toContainText("3 playable recordings");
  await expect(page.getByRole("dialog")).toContainText("No matching thumbnail");
  await expect(page.getByRole("dialog")).toContainText(
    "unsupported container or codec",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  expect((await download).suggestedFilename()).toContain("import-report");
  expect(requests).toEqual([]);
});
test("responsive screenshots and no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await capture(page, {
    path: "test-results/screenshots/empty-desktop.png",
    fullPage: true,
  });
  await importFixture(page);
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await capture(page, {
    path: "test-results/screenshots/desktop-fixture.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Toggle trip timeline" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await capture(page, {
    path: "test-results/screenshots/mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Bookmark current moment", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Note for/ })
    .fill("Mobile saved moment");
  await capture(page, {
    path: "test-results/screenshots/mobile-bookmarks.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close details" }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.getByRole("button", { name: "Bookmark current moment", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Bookmark current moment", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Note for/ })
    .last()
    .fill("Small-screen saved moment");
  await page.getByRole("button", { name: "Close details" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle trip timeline" }).click();
  await page.getByRole("button", { name: /27 Aug/ }).click();
  await expect(
    page.getByRole("heading", { name: "27 August 2026" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle recording details" }).click();
  await capture(page, {
    path: "test-results/screenshots/mobile-details.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("reference folder recovery indexes the real archive", async ({ page }) => {
  test.skip(
    !process.env.REFERENCE_FOLDER,
    "Set REFERENCE_FOLDER for a read-only full-folder test.",
  );
  test.setTimeout(240000);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import folder", exact: true })
    .click();
  await page
    .getByLabel("Recording folder", { exact: true })
    .setInputFiles(process.env.REFERENCE_FOLDER!);
  await expect(
    page.getByRole("heading", { name: "Strict import rejected" }),
  ).toBeVisible({ timeout: 180000 });
  await expect(page.getByRole("dialog")).toContainText(
    "1,116 of 1,133 videos readable",
  );
  await page.getByRole("button", { name: "Recover playable videos" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  // Select a readable daytime road clip for visual verification, rather than a black camera frame.
  await page
    .getByLabel("Search recordings", { exact: true })
    .fill("20250101_082759");
  await page.getByRole("button", { name: /08:27:59.*20250101_082759/ }).click();
  await expect(
    page.locator('video[aria-label="Trip recording"]'),
  ).toHaveJSProperty("readyState", 4);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect
    .poll(async () =>
      page.locator(".film-cell img").evaluateAll((images) =>
        images
          .filter((image) => {
            const r = image.getBoundingClientRect();
            return r.right > 240 && r.left < innerWidth;
          })
          .every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
      ),
    )
    .toBe(true);
  const stage = await page.locator(".video-stage").boundingBox();
  expect(stage!.width).toBeGreaterThan(1000);
  const strip = await page.locator(".filmstrip-scroll").boundingBox();
  expect(strip!.y + strip!.height).toBeLessThanOrEqual(1058);
  const controls = await page.locator(".player-controls").boundingBox();
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(1058);
  await capture(page, {
    path: "test-results/screenshots/desktop.png",
    fullPage: true,
  });
  expect(await page.locator(".film-cell").count()).toBeLessThan(15);
  expect(await page.locator("video").count()).toBe(2);
  await page.getByRole("button", { name: "Toggle recording details" }).click();
  const detailsStrip = await page.locator(".filmstrip-scroll").boundingBox();
  expect(detailsStrip!.y + detailsStrip!.height).toBeLessThanOrEqual(1058);
  await capture(page, {
    path: "test-results/screenshots/desktop-details.png",
    fullPage: true,
  });
});

test("fullscreen fills the screen and restores the normal player on exit", async ({
  page,
}) => {
  await page.goto("/");
  await importFixture(page);
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  const normalHeight = await page
    .locator(".video-stage")
    .evaluate((el) => el.getBoundingClientRect().height);
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.className))
    .toBe("player");
  const fullscreen = await page.locator(".video-stage").evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    width: el.getBoundingClientRect().width,
    viewportHeight: innerHeight,
    viewportWidth: innerWidth,
    maxHeight: getComputedStyle(el).maxHeight,
  }));
  expect(fullscreen.maxHeight).toBe("none");
  expect(fullscreen.height).toBeGreaterThan(fullscreen.viewportHeight * 0.8);
  expect(fullscreen.width).toBeCloseTo(fullscreen.viewportWidth, 0);
  await capture(page, { path: "test-results/screenshots/fullscreen.png" });
  await page
    .getByRole("button", { name: "Bookmark current moment", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Recording details" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: /Note for/ })
    .fill("Saved in fullscreen");
  await page.getByRole("button", { name: "Close details" }).click();
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator(".video-stage")
        .evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBeCloseTo(normalHeight, 0);
});

test("generic camera folders, separate views and seek thumbnail previews", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import folder", exact: true })
    .click();
  await page
    .getByLabel("Recording folder", { exact: true })
    .setInputFiles(path.join(root, "generic"));
  await expect(
    page.getByRole("heading", { name: "Ready to import" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "3 of 3 videos readable",
  );
  await page.getByRole("button", { name: "Import trip", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(page.getByLabel("Camera view", { exact: true })).toHaveText(
    "Front",
  );
  await expect(page.locator(".recording-count")).toHaveText("1 / 2");
  const duration = Number(
    await page.getByLabel("Recorded time", { exact: true }).getAttribute("max"),
  );
  expect(duration).toBeGreaterThan(5);
  expect(duration).toBeLessThan(6);
  const range = page.getByLabel("Recorded time", { exact: true });
  const rect = (await range.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.75, rect.y + rect.height / 2);
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText("Recording thumbnail");
  await expect
    .poll(() =>
      page
        .getByRole("tooltip")
        .locator("img")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(page.getByRole("tooltip")).toContainText("11:02:");
  await capture(page, {
    path: "test-results/screenshots/seek-preview-desktop.png",
    fullPage: true,
  });
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).not.toBeVisible();
  await choose(page, "Camera view", "Rear");
  await expect(page.locator(".recording-count")).toHaveText("1 / 1");
  await expect(range).toHaveAttribute("max", "2");
  await choose(page, "Camera view", "Front");
  await page.setViewportSize({ width: 390, height: 844 });
  await range.focus();
  await range.press("ArrowRight");
  await expect(page.getByRole("tooltip")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await capture(page, {
    path: "test-results/screenshots/seek-preview-mobile.png",
    fullPage: true,
  });
});

test("unknown camera names and missing thumbnails warn without rejecting import", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import folder", exact: true })
    .click();
  await page
    .getByLabel("Recording folder", { exact: true })
    .setInputFiles(path.join(root, "unknown-camera"));
  await expect(
    page.getByRole("heading", { name: "Ready to import" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "No recording timestamp found",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "No matching thumbnail found",
  );
  await page.getByRole("button", { name: "Import trip", exact: true }).click();
  await page.getByRole("button", { name: "Toggle recording details" }).click();
  await expect(
    page.getByRole("complementary", { name: "Recording details" }),
  ).toContainText("File date · estimated");
});

test("simplified workspace and accessible mobile drawers", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Import folder", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByLabel("Search recordings", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Recording days" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Import folder", exact: true })
    .click();
  await expect(
    page.getByText("Folder access options", { exact: true }),
  ).toBeVisible();
  await page.getByText("Folder access options", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Use compatibility folder picker" }),
  ).toBeVisible();
  await capture(page, {
    path: "test-results/screenshots/clean-import.png",
    fullPage: true,
  });
  await page
    .getByLabel("Recording folder", { exact: true })
    .setInputFiles(path.join(root, "valid"));
  await expect(
    page.getByRole("heading", { name: "Ready to import" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import trip", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(
    page.getByRole("button", { name: "Scroll recordings left" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Scroll recordings right" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Toggle recording details" }),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  const open = page.getByRole("button", { name: "Toggle trip timeline" });
  await open.click();
  const rail = page.getByRole("dialog", { name: "Trip timeline", exact: true });
  await expect(rail).toBeVisible();
  await rail.getByRole("button", { name: "Close trip timeline" }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await rail.evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(rail).toHaveCount(0);
  await expect(open).toBeFocused();
  const details = page.getByRole("button", {
    name: "Toggle recording details",
  });
  await details.click();
  const drawer = page.getByRole("dialog", { name: "Recording details" });
  await expect(drawer).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await drawer.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(details).toBeFocused();
  await open.click();
  await page.mouse.click(340, 200);
  await expect(rail).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await capture(page, {
    path: "test-results/screenshots/clean-mobile-360.png",
    fullPage: true,
  });
});

test("themed selectors, keyboard navigation and aligned skip controls", async ({
  page,
}) => {
  await page.goto("/");
  await importFixture(page);
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(
    page.getByRole("combobox", { name: "Trip library" }),
  ).toHaveCount(0);
  await expect(page.locator(".trip-name")).toHaveText("valid");
  const speed = page.getByRole("combobox", {
    name: "Playback speed",
    exact: true,
  });
  await speed.focus();
  await speed.press("Enter");
  await expect(
    page.getByRole("listbox", { name: "Playback speed" }),
  ).toBeVisible();
  await speed.press("End");
  await speed.press("Enter");
  await expect(speed).toHaveText("4×");
  await expect(
    page.locator('video[aria-label="Trip recording"]'),
  ).toHaveJSProperty("playbackRate", 4);
  await speed.press("Enter");
  await speed.press("ArrowUp");
  await speed.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(speed).toBeFocused();
  await expect(speed).toHaveText("4×");
  await speed.click();
  await page.getByRole("option", { name: "1.5×", exact: true }).click();
  await expect(speed).toHaveText("1.5×");
  await speed.click();
  const menu = page.getByRole("listbox", { name: "Playback speed" });
  const box = (await menu.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(1058);
  expect(
    await menu.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(28, 32, 29)");
  await capture(page, {
    path: "test-results/screenshots/fixed-speed-menu.png",
    fullPage: true,
  });
  await page.mouse.click(20, 100);
  await expect(menu).toHaveCount(0);
  await page
    .locator(".transport")
    .screenshot({ path: "test-results/screenshots/fixed-transport.png" });
  const centered = await page
    .locator(".seek-button svg")
    .evaluateAll((elements) =>
      elements.every((svg) => {
        const a = svg.getBoundingClientRect(),
          b = svg.querySelector("text")!.getBoundingClientRect();
        return (
          Math.abs(b.x + b.width / 2 - a.x - a.width / 2) < 2 &&
          Math.abs(b.y + b.height / 2 - a.y - a.height / 2) < 3
        );
      }),
    );
  expect(centered).toBe(true);
  await page.getByRole("button", { name: "Entire trip", exact: true }).click();
  await page.getByRole("button", { name: "Forward 10 seconds" }).click();
  await expect(
    page.getByRole("heading", { name: "27 August 2026" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back 10 seconds" }).click();
  await expect(
    page.getByRole("heading", { name: "26 August 2026" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await speed.click();
  expect(
    await menu.evaluate((el) => !!document.fullscreenElement?.contains(el)),
  ).toBe(true);
  await speed.press("Escape");
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await importFixture(page, "generic");
  const library = page.getByRole("combobox", {
    name: "Trip library",
    exact: true,
  });
  await expect(library).toHaveText("generic");
  await library.click();
  await capture(page, {
    path: "test-results/screenshots/fixed-trip-menu.png",
    fullPage: true,
  });
  await page.getByRole("option", { name: "valid", exact: true }).click();
  await expect(library).toHaveText("valid");
  await page
    .getByLabel("Reconnect recording folder", { exact: true })
    .setInputFiles(path.join(root, "valid"));
  await expect(
    page.locator('video[aria-label="Trip recording"]'),
  ).toHaveJSProperty("readyState", 4);
  const notice = page.getByRole("button", { name: "Dismiss notification" });
  if (await notice.isVisible()) await notice.click();
  await page.setViewportSize({ width: 360, height: 800 });
  await speed.click();
  const mobile = (await menu.boundingBox())!;
  expect(mobile.x).toBeGreaterThanOrEqual(0);
  expect(mobile.x + mobile.width).toBeLessThanOrEqual(360);
  expect(mobile.y + mobile.height).toBeLessThanOrEqual(800);
  await capture(page, {
    path: "test-results/screenshots/fixed-speed-mobile.png",
    fullPage: true,
  });
  await speed.press("Tab");
  await expect(menu).toHaveCount(0);
});

test("bookmarks switch camera views and close the mobile drawer", async ({
  page,
}) => {
  await page.goto("/");
  await importFixture(page, "generic");
  await choose(page, "Camera view", "Rear");
  await page
    .getByRole("button", { name: "Bookmark current moment", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Note for/ })
    .fill("Rear camera bookmark");
  await page.getByRole("button", { name: "Close details" }).click();
  await choose(page, "Camera view", "Front");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle recording details" }).click();
  await page.getByRole("button", { name: /Bookmarks 1/ }).click();
  await page.locator(".bookmark-item .text-button").click();
  await expect(
    page.getByRole("combobox", { name: "Camera view", exact: true }),
  ).toHaveText("Rear");
  await expect(
    page.getByRole("dialog", { name: "Recording details" }),
  ).toHaveCount(0);
  await expect(page.locator(".recording-count")).toHaveText("1 / 1");
});

test("retry retains position and paused settings persist immediately", async ({
  page,
}) => {
  await page.goto("/");
  await importFixture(page);
  const video = page.locator('video[aria-label="Trip recording"]');
  await expect(video).toHaveJSProperty("readyState", 4);
  await page.getByLabel("Recorded time", { exact: true }).fill("1.1");
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeCloseTo(1.1, 1);
  await video.evaluate((v) => v.dispatchEvent(new Event("error")));
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(video).toHaveJSProperty("readyState", 4);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeCloseTo(1.1, 1);
  await choose(page, "Playback speed", "3×");
  await page.getByLabel("Volume", { exact: true }).fill("0.25");
  await page.reload();
  await page
    .getByLabel("Reconnect recording folder", { exact: true })
    .setInputFiles(path.join(root, "valid"));
  await expect(video).toHaveJSProperty("playbackRate", 3);
  await expect(video).toHaveJSProperty("volume", 0.25);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeCloseTo(1.1, 1);
});

test("cancelled and denied native folder pickers allow a compatibility import", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => {
        if (++calls === 1)
          throw new DOMException("Selection cancelled", "AbortError");
        throw new DOMException("Folder access denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import folder", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose folder", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Choose folder", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose folder", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Folder access denied");
  await page
    .getByLabel("Recording folder", { exact: true })
    .setInputFiles(path.join(root, "valid"));
  await expect(
    page.getByRole("heading", { name: "Ready to import" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import trip", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "26 August 2026" }),
  ).toBeVisible();
});
