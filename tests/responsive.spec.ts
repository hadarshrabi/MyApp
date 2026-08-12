import { expect, test, type Page } from "@playwright/test";

const viewports = [320, 360, 375, 390, 393, 414, 430, 768, 1024, 1440] as const;
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
  await page.waitForLoadState("networkidle");
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByPlaceholder("name@example.com").fill("owner@linoy-designs.example");
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
