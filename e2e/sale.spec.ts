import { expect, type Page, test } from "@playwright/test";
import { DEMO_PASSWORD } from "../scripts/seed-data";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(page).toHaveURL("/");
}

async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test("a rep reserves a unit and drafts its contract; the accountant approves it and records a payment", async ({
  page,
}) => {
  // The rep: reserve the first available unit for one of their clients.
  await login(page, "rep1@ofuq.test");
  await page.goto("/units?status=available");
  const unit = page.locator("tbody tr a").first();
  const unitNumber = (await unit.innerText()).trim();
  await unit.click();
  await page.getByLabel("العميل").selectOption({ index: 1 });
  await page.getByRole("button", { name: "احجز الوحدة" }).click();
  await expect(page.getByText(/تم حجز الوحدة لمدة 72 ساعة/)).toBeVisible();

  // A draft at the unit's list price (the form's default), 100,000 down.
  await page.getByRole("link", { name: "إنشاء مسودة عقد" }).click();
  await page.getByLabel("الدفعة الأولى (ر.س)").fill("100000");
  await page.getByRole("button", { name: "حفظ المسودة" }).click();
  await expect(page.getByText("تم حفظ مسودة العقد")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(unitNumber);
  const contractUrl = new URL(page.url()).pathname;
  await logout(page);

  // The accountant: approve, then record the down payment. Both cannot be
  // undone, so each asks first in a dialog; cancelling sends nothing.
  await login(page, "accountant@ofuq.test");
  await page.goto(contractUrl);
  await page.getByRole("button", { name: "اعتماد العقد" }).click();
  const approval = page.getByRole("dialog", { name: "تأكيد اعتماد العقد" });
  await approval.getByRole("button", { name: "إلغاء" }).click();
  await expect(approval).toBeHidden();
  await expect(page.getByText("مسودة", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "اعتماد العقد" }).click();
  await approval.getByRole("button", { name: "تأكيد الاعتماد" }).click();
  await expect(page.getByText("تم اعتماد العقد، وأصبحت الوحدة مباعة.")).toBeVisible();

  await page.getByLabel("المبلغ المستلم (ر.س)").fill("100000");
  await page.getByRole("button", { name: "تسجيل الدفعة" }).click();
  const payment = page.getByRole("dialog", { name: "تأكيد تسجيل دفعة" });
  await expect(payment).toContainText("100,000.00");
  // A double click sends the form at most twice with one idempotency key.
  await payment.getByRole("button", { name: "تأكيد التسجيل" }).dblclick();
  await expect(page.getByText(/^تم تسجيل الدفعة\.|سُجِّلت من قبل/)).toBeVisible();

  const downPayment = page.getByRole("row", { name: /الدفعة الأولى/ });
  await expect(downPayment.getByText("مدفوع", { exact: true })).toBeVisible();
  // One payment recorded, not two.
  const recorded = page.locator("section", { hasText: "الدفعات المسجّلة" }).getByRole("listitem");
  await expect(recorded).toHaveCount(1);
  await expect(recorded).toContainText("100,000.00");
});
