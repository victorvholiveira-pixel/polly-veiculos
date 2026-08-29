import { expect, test } from '@playwright/test'

// Smoke tests for Onda 1 (foundation): routing, auth guarding, mobile nav
// shell. No backend is deployed yet, so these prove the
// client-side wiring only — not that a real sign-in succeeds end to end.

test('unauthenticated user hitting / is redirected to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Polly Veículos' })).toBeVisible()
})

test('login form shows a visible error on rejected credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Seu nome').fill('Vendedor Teste')
  await page.getByLabel('Senha').fill('senha-incorreta')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 })
})

test('protected routes redirect to login, never leaking the app shell', async ({ page }) => {
  for (const path of ['/', '/estoque', '/vender', '/historico', '/mais']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
  }
})

test('viewport renders at mobile width without horizontal overflow', async ({ page }) => {
  await page.goto('/login')
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasOverflow).toBe(false)
})
