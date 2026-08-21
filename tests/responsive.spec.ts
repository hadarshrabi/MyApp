import { expect, test, type Page } from "@playwright/test";

const viewports = [320, 360, 375, 390, 393, 414, 430, 768, 1024, 1280, 1366, 1440, 1536, 1920, 2560] as const;
const routes = ["/", "/employees", "/attendance", "/payroll", "/exceptions", "/stations", "/products", "/map", "/users", "/audit", "/settings"] as const;

async function assertResponsiveViewport(page: Page, context: string) {
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const scrollableAncestor = (element: Element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (["auto", "scroll"].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    const important = Array.from(document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [role='button']"));
    const escapedControls = important.flatMap(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || rect.width < 1 || rect.height < 1 || scrollableAncestor(element)) return [];
      if (rect.left < -1 || rect.right > viewportWidth + 1) {
        return [{ tag: element.tagName, label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 60) ?? "", left: Math.round(rect.left), right: Math.round(rect.right) }];
      }
      return [];
    });
    return {
      clientWidth: viewportWidth,
      scrollWidth: root.scrollWidth,
      escapedControls,
    };
  });

  expect(result.scrollWidth, `${context}: document overflowed horizontally`).toBeLessThanOrEqual(result.clientWidth);
  expect(result.escapedControls, `${context}: important controls escaped the viewport`).toEqual([]);
}

async function navigateWithinApp(page: Page, route: string) {
  await page.evaluate(path => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
  await page.waitForFunction(path => window.location.pathname === path, route);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function createAttendanceShiftFixture(page: Page) {
  const email = process.env.SEED_ADMIN_EMAIL ?? "owner@linoy-designs.example";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  const loginResponse = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(loginResponse.ok(), "responsive fixture admin login failed").toBe(true);
  const { accessToken } = await loginResponse.json() as { accessToken: string };
  const headers = { authorization: `Bearer ${accessToken}` };
  const bootstrapResponse = await page.request.get("/api/bootstrap", { headers });
  expect(bootstrapResponse.ok(), "responsive fixture bootstrap failed").toBe(true);
  const bootstrap = await bootstrapResponse.json() as {
    employees: Array<{ id: string; assignedStationId: number | null }>;
    stations: Array<{ id: number }>;
  };
  const employee = bootstrap.employees.find(candidate => candidate.assignedStationId != null) ?? bootstrap.employees[0];
  const stationId = employee?.assignedStationId ?? bootstrap.stations[0]?.id;
  expect(employee, "responsive fixture requires a seeded employee").toBeTruthy();
  expect(stationId, "responsive fixture requires a seeded station").toBeTruthy();

  const clockOut = new Date(Date.now() - 60 * 60 * 1000);
  const clockIn = new Date(clockOut.getTime() - 60 * 60 * 1000);
  const base = {
    employeeId: employee!.id,
    stationId: stationId!,
    latitude: 32.0743,
    longitude: 34.7925,
    distanceMeters: 0,
    reason: "נתוני בדיקת רספונסיביות",
  };
  for (const [action, timestamp] of [["CLOCK_IN", clockIn], ["CLOCK_OUT", clockOut]] as const) {
    const response = await page.request.post("/api/attendance/manual", {
      headers,
      data: { ...base, action, timestamp: timestamp.toISOString() },
    });
    expect(response.ok(), `responsive fixture ${action} failed`).toBe(true);
  }
}

test("login is usable without iOS auto-zoom at every target width", async ({ page }) => {
  for (const width of viewports) {
    await page.setViewportSize({ width, height: width <= 430 ? 700 : 900 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "כניסה למערכת" })).toBeVisible();
    await assertResponsiveViewport(page, `login ${width}px`);
    if (width <= 900) {
      const sizes = await page.locator(".login-card input").evaluateAll(elements => elements.map(element => Number.parseFloat(getComputedStyle(element).fontSize)));
      expect(sizes.every(size => size >= 16), `login ${width}px: input font must prevent Safari auto-zoom`).toBe(true);
    }
  }

  await page.setViewportSize({ width: 390, height: 390 });
  await page.goto("/login");
  await page.getByPlaceholder("name@example.com").focus();
  await expect(page.getByRole("button", { name: "היכנס למערכת" })).toBeVisible();
  await assertResponsiveViewport(page, "login 390x390 keyboard-sized viewport");
});

test("authenticated routes do not overflow on mobile, tablet, or desktop", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByPlaceholder("name@example.com").fill(process.env.SEED_ADMIN_EMAIL ?? "owner@linoy-designs.example");
  await page.getByPlaceholder("הקלדת סיסמה").fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "היכנס למערכת", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  for (const width of viewports) {
    await page.setViewportSize({ width, height: width <= 430 ? 800 : 900 });
    for (const route of routes) {
      await navigateWithinApp(page, route);
      await assertResponsiveViewport(page, `${route} ${width}px`);
    }

    await navigateWithinApp(page, "/users");
    const usersLayout = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const box = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing responsive regression target: ${selector}`);
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
      };
      const toolbar = box(".users-toolbar");
      const search = box(".users-search");
      const filters = Array.from(document.querySelectorAll<HTMLElement>(".users-filter-chips button")).map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
      });
      const searchInput = document.querySelector<HTMLInputElement>(".users-search input");
      const filterGroup = document.querySelector<HTMLElement>(".users-filter-chips");
      if (!searchInput || !filterGroup) throw new Error("Missing users search/filter controls");
      return {
        viewportWidth,
        documentWidth: document.documentElement.scrollWidth,
        toolbar,
        search,
        filters,
        inputFontSize: Number.parseFloat(getComputedStyle(searchInput).fontSize),
        inputDirection: getComputedStyle(searchInput).direction,
        filterOverflowX: getComputedStyle(filterGroup).overflowX,
        filterColumns: getComputedStyle(filterGroup).gridTemplateColumns.split(" ").length,
      };
    });
    expect(usersLayout.documentWidth, `/users ${width}px: document overflow`).toBeLessThanOrEqual(usersLayout.viewportWidth);
    for (const [name, rect] of [["toolbar", usersLayout.toolbar], ["search", usersLayout.search]] as const) {
      expect(rect.left, `/users ${width}px: ${name} escaped left`).toBeGreaterThanOrEqual(-1);
      expect(rect.right, `/users ${width}px: ${name} escaped right`).toBeLessThanOrEqual(usersLayout.viewportWidth + 1);
    }
    expect(usersLayout.filters).toHaveLength(4);
    for (const [index, rect] of usersLayout.filters.entries()) {
      expect(rect.left, `/users ${width}px: filter ${index} escaped left`).toBeGreaterThanOrEqual(-1);
      expect(rect.right, `/users ${width}px: filter ${index} escaped right`).toBeLessThanOrEqual(usersLayout.viewportWidth + 1);
      expect(rect.width, `/users ${width}px: filter ${index} collapsed`).toBeGreaterThan(0);
    }
    const filtersOverlap = usersLayout.filters.some((current, index) => usersLayout.filters.slice(index + 1).some(other =>
      current.left < other.right - 1 && current.right > other.left + 1 && current.top < other.bottom - 1 && current.bottom > other.top + 1));
    expect(filtersOverlap, `/users ${width}px: filters overlap`).toBe(false);
    expect(usersLayout.filterOverflowX, `/users ${width}px: filters should not scroll horizontally`).not.toMatch(/auto|scroll/);
    if (width <= 430) expect(usersLayout.filterColumns, `/users ${width}px: filters must use a clean 2x2 grid`).toBe(2);
    if (width >= 768 && width <= 900) expect(usersLayout.filterColumns, `/users ${width}px: filters should use four roomy columns`).toBe(4);
    expect(usersLayout.inputDirection, `/users ${width}px: search input must remain RTL`).toBe("rtl");
    if (width <= 900) expect(usersLayout.inputFontSize, `/users ${width}px: search input must prevent Safari auto-zoom`).toBeGreaterThanOrEqual(16);

    const usersSearchInput = page.locator(".users-search input");
    await usersSearchInput.fill("בדיקת חיפוש ארוכה שמוודאת שכפתור הניקוי אינו מכסה את הטקסט");
    const clearButtonLayout = await page.evaluate(() => {
      const search = document.querySelector<HTMLElement>(".users-search");
      const input = document.querySelector<HTMLInputElement>(".users-search input");
      const button = document.querySelector<HTMLButtonElement>(".users-search button");
      if (!search || !input || !button) throw new Error("Search clear button was not rendered");
      const searchRect = search.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      return {
        search: { left: searchRect.left, right: searchRect.right },
        button: { left: buttonRect.left, right: buttonRect.right },
        inputPaddingLeft: Number.parseFloat(getComputedStyle(input).paddingLeft),
      };
    });
    expect(clearButtonLayout.button.left, `/users ${width}px: clear button escaped search`).toBeGreaterThanOrEqual(clearButtonLayout.search.left);
    expect(clearButtonLayout.button.right, `/users ${width}px: clear button escaped search`).toBeLessThanOrEqual(clearButtonLayout.search.right);
    expect(clearButtonLayout.inputPaddingLeft, `/users ${width}px: text is not protected from clear button`).toBeGreaterThanOrEqual(38);
    await page.getByRole("button", { name: "ניקוי החיפוש" }).click();

    await navigateWithinApp(page, "/audit");
    await page.locator(".activity-page").waitFor();
    const activityLayout = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const selectors = [".activity-page", ".activity-toolbar", ".activity-search", ".activity-filters", ".activity-timeline"];
      return {
        viewportWidth,
        documentWidth: document.documentElement.scrollWidth,
        boxes: selectors.map(selector => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) throw new Error(`Missing activity responsive target: ${selector}`);
          const rect = element.getBoundingClientRect();
          return { selector, left: rect.left, right: rect.right, width: rect.width };
        }),
        rawJsonVisible: document.body.innerText.includes("{\"") || document.body.innerText.includes("passwordHash"),
      };
    });
    expect(activityLayout.documentWidth, `/audit ${width}px: document overflow`).toBeLessThanOrEqual(activityLayout.viewportWidth);
    for (const rect of activityLayout.boxes) {
      expect(rect.left, `/audit ${width}px: ${rect.selector} escaped left`).toBeGreaterThanOrEqual(-1);
      expect(rect.right, `/audit ${width}px: ${rect.selector} escaped right`).toBeLessThanOrEqual(activityLayout.viewportWidth + 1);
      expect(rect.width, `/audit ${width}px: ${rect.selector} collapsed`).toBeGreaterThan(0);
    }
    expect(activityLayout.rawJsonVisible, `/audit ${width}px: raw technical data leaked into normal UI`).toBe(false);

    if (width <= 430) {
      await navigateWithinApp(page, "/");
      const mobileNav = page.locator(".admin-mobile-nav");
      await expect(mobileNav).toBeVisible();
      const bounds = await mobileNav.locator("a, button").evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }));
      expect(bounds.every(rect => rect.left >= -1 && rect.right <= width + 1), `bottom navigation ${width}px`).toBe(true);
    }
  }
});

test("attendance edit sheet stays inside every mobile and tablet viewport", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await createAttendanceShiftFixture(page);
  await page.goto("/login");
  await page.getByPlaceholder("name@example.com").fill(process.env.SEED_ADMIN_EMAIL ?? "owner@linoy-designs.example");
  await page.getByPlaceholder("הקלדת סיסמה").fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "היכנס למערכת", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  for (const width of [320, 360, 375, 390, 393, 414, 430, 480, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await navigateWithinApp(page, "/attendance");
    await page.getByRole("button", { name: "עריכת שעות", exact: true }).first().click();
    const modal = page.locator(".attendance-shift-modal.edit");
    await expect(modal).toBeVisible();

    if (width === 390) {
      const nativeDate = modal.locator(".attendance-date-input").first();
      const nativeTime = modal.locator(".attendance-time-input").first();
      await nativeDate.fill("2026-08-21");
      await nativeTime.fill("07:30");
      await expect(modal.locator(".attendance-picker-value").nth(0)).toHaveText("21.08.2026");
      await expect(modal.locator(".attendance-picker-value").nth(1)).toHaveText("07:30");
      await expect(nativeDate).toHaveCSS("opacity", "0");
      await expect(nativeTime).toHaveCSS("opacity", "0");
    }

    const layout = await modal.evaluate(element => {
      const container = element.querySelector<HTMLElement>(".attendance-shift-fields");
      const groups = element.querySelectorAll<HTMLElement>(".attendance-date-time-group");
      const entry = groups[0];
      const exit = groups[1];
      const dateInputs = element.querySelectorAll<HTMLInputElement>(".attendance-date-input");
      const timeInputs = element.querySelectorAll<HTMLInputElement>(".attendance-time-input");
      if (!container || !entry || !exit || dateInputs.length !== 2 || timeInputs.length !== 2) throw new Error("Missing attendance edit fields");
      const inputs = [...Array.from(dateInputs), ...Array.from(timeInputs)];
      const modalBox = element.getBoundingClientRect();
      const entryBox = entry.getBoundingClientRect();
      const exitBox = exit.getBoundingClientRect();
      const style = getComputedStyle(container);
      const footer = element.querySelector<HTMLElement>(".attendance-shift-actions");
      if (!footer) throw new Error("Missing attendance edit footer");
      const footerBox = footer.getBoundingClientRect();
      const controls = Array.from(element.querySelectorAll<HTMLElement>("input, select, textarea, button"));
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        display: style.display,
        columns: style.gridTemplateColumns,
        modal: { left: modalBox.left, right: modalBox.right },
        entry: { left: entryBox.left, right: entryBox.right, y: entryBox.y, height: entryBox.height },
        exit: { left: exitBox.left, right: exitBox.right, y: exitBox.y, height: exitBox.height },
        inputTypes: inputs.map(input => input.type),
        inputDirections: inputs.map(input => input.getAttribute("dir")),
        inputFontSizes: inputs.map(input => Number.parseFloat(getComputedStyle(input).fontSize)),
        footer: { left: footerBox.left, right: footerBox.right, bottom: footerBox.bottom },
        dateWidths: Array.from(dateInputs).map(input => input.getBoundingClientRect().width),
        timeWidths: Array.from(timeInputs).map(input => input.getBoundingClientRect().width),
        escapedControls: controls.filter(control => {
          const rect = control.getBoundingClientRect();
          if (getComputedStyle(control).display === "none") return false;
          return rect.left < modalBox.left - 1 || rect.right > modalBox.right + 1;
        }).map(control => ({ tag: control.tagName, className: control.className, left: control.getBoundingClientRect().left, right: control.getBoundingClientRect().right })),
      };
    });

    expect(layout.display, `${width}px: fields container must be grid`).toBe("grid");
    expect(layout.columns.trim().split(/\s+/), `${width}px: fields container must have one column`).toHaveLength(1);
    expect(layout.exit.y, `${width}px: exit field must start below entry field`).toBeGreaterThanOrEqual(layout.entry.y + layout.entry.height);
    expect(layout.entry.left, `${width}px: entry escaped modal`).toBeGreaterThanOrEqual(layout.modal.left - 1);
    expect(layout.entry.right, `${width}px: entry escaped modal`).toBeLessThanOrEqual(layout.modal.right + 1);
    expect(layout.exit.left, `${width}px: exit escaped modal`).toBeGreaterThanOrEqual(layout.modal.left - 1);
    expect(layout.exit.right, `${width}px: exit escaped modal`).toBeLessThanOrEqual(layout.modal.right + 1);
    expect(layout.inputTypes, `${width}px: native controls must be split into stable date/time fields`).toEqual(["date", "date", "time", "time"]);
    expect(layout.inputDirections.every(direction => direction === "ltr"), `${width}px: date/time controls must explicitly opt out of the RTL container`).toBe(true);
    expect(layout.inputFontSizes.every(size => size >= 16), `${width}px: date/time fields must prevent Safari auto-zoom`).toBe(true);
    expect(layout.escapedControls, `${width}px: a control escaped the modal`).toEqual([]);
    expect(layout.footer.left, `${width}px: footer escaped left`).toBeGreaterThanOrEqual(layout.modal.left - 1);
    expect(layout.footer.right, `${width}px: footer escaped right`).toBeLessThanOrEqual(layout.modal.right + 1);
    expect(layout.footer.bottom, `${width}px: sticky footer escaped viewport`).toBeLessThanOrEqual(845);
    expect(layout.documentWidth, `${width}px: modal caused document overflow`).toBeLessThanOrEqual(layout.viewportWidth);

    if ([320, 390, 430].includes(width)) {
      console.log(`attendance-layout-${width}`, JSON.stringify({ dateWidths: layout.dateWidths, timeWidths: layout.timeWidths, documentWidth: layout.documentWidth, viewportWidth: layout.viewportWidth }));
      await page.screenshot({ path: `test-results/attendance-reference-${width}.png`, fullPage: false });
    }
    if (width === 414) await page.screenshot({ path: "test-results/attendance-reference-android-414.png", fullPage: false });
    await page.getByRole("button", { name: "ביטול", exact: true }).click();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await navigateWithinApp(page, "/attendance");
  await page.getByRole("button", { name: "עריכת שעות", exact: true }).first().click();
  const handle = page.getByRole("button", { name: "גרירה מטה לסגירה" });
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Missing mobile drag handle bounds");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 120, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".attendance-shift-modal.edit")).toHaveCount(0);

  await page.getByRole("button", { name: "עריכת שעות", exact: true }).first().click();
  const mobileModal = page.locator(".attendance-shift-modal.edit");
  await mobileModal.hover();
  await page.mouse.wheel(0, 300);
  await expect(mobileModal).toBeVisible();
  await page.getByRole("button", { name: "ביטול", exact: true }).click();

  await page.setViewportSize({ width: 1366, height: 900 });
  await navigateWithinApp(page, "/attendance");
  await page.getByRole("button", { name: "עריכת שעות", exact: true }).first().click();
  const desktopPresentation = await page.locator(".attendance-shift-modal.edit").evaluate(element => ({
    handle: getComputedStyle(element.querySelector<HTMLElement>(".attendance-shift-drag-handle")!).display,
    close: getComputedStyle(element.querySelector<HTMLElement>(".modal-close")!).display,
    inlineStyle: element.getAttribute("style"),
  }));
  expect(desktopPresentation).toEqual({ handle: "none", close: "block", inlineStyle: null });
});
