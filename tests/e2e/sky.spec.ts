import { expect, test } from '@playwright/test'
import { clearTodaySky, devLoginAs, skyFile, todaySkyRow, userId } from './helpers'

const ME = 'me@garden-farmer.test'

test.beforeEach(async () => {
  await clearTodaySky(await userId(ME))
})

test('하늘을 찍어 모든 정원에 심는다', async ({ page }) => {
  await devLoginAs(page, '나')
  await page.getByRole('link', { name: '하늘 담기' }).click()
  await expect(page.getByRole('heading', { name: '지금, 하늘' })).toBeVisible()
  await expect(page.getByText('오늘 안에 언제든')).toBeVisible()
  await expect(page.getByRole('button', { name: '하늘 심기' })).toBeDisabled()

  await page.getByLabel('하늘 찍기').setInputFiles(skyFile([127, 181, 221]))
  await expect(page.getByText(/오늘의 하늘빛 · /)).toBeVisible()
  await expect(page.getByRole('img', { name: '방금 찍은 하늘' })).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(3)
  for (const box of await page.getByRole('checkbox').all()) await expect(box).toBeChecked()

  await page.getByLabel('한 줄 남기기 (선택)').fill('테스트 하늘')
  await page.getByRole('button', { name: '하늘 심기' }).click()
  await page.waitForURL('**/garden')

  const row = await todaySkyRow(await userId(ME))
  expect(row?.note).toBe('테스트 하늘')
  expect(row?.dominant_color).toMatch(/^#[0-9A-F]{6}$/)
  expect(row?.image_path).toMatch(/\.jpg$/)
  expect(row?.plantings).toHaveLength(3)
})
