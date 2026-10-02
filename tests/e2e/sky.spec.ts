import { expect, test } from '@playwright/test'
import { clearTodaySky, devLoginAs, objectExists, skyFile, todaySkyRow, userId } from './helpers'

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

test('오늘 심은 하늘의 정원을 바꾸고, 다시 찍고, 지운다', async ({ page }) => {
  const uid = await userId(ME)
  await devLoginAs(page, '나')
  await page.goto('/sky')
  await page.getByLabel('하늘 찍기').setInputFiles(skyFile([127, 181, 221]))
  await page.getByRole('button', { name: '하늘 심기' }).click()
  await page.waitForURL('**/garden')

  // 오늘 하늘이 있으면 사진·정원 체크 상태를 보여준다
  await page.goto('/sky')
  await expect(page.getByRole('img', { name: '오늘 심은 하늘' })).toBeVisible()
  await expect(page.getByRole('button', { name: '정원 바꾸기 저장' })).toBeDisabled()
  await page.getByRole('checkbox', { name: '우리 둘' }).uncheck()
  await page.getByRole('button', { name: '정원 바꾸기 저장' }).click()
  await expect.poll(async () => (await todaySkyRow(uid))?.plantings.length).toBe(2)

  // 다시 찍으면 현재 정원(2곳)을 유지한 채 사진만 바뀌고 옛 파일은 지워진다
  const before = (await todaySkyRow(uid))!.image_path
  await page.getByLabel('다시 찍기').setInputFiles(skyFile([242, 184, 162]))
  await expect(page.getByRole('img', { name: '방금 찍은 하늘' })).toBeVisible()
  await page.getByRole('button', { name: '하늘 심기' }).click()
  await page.waitForURL('**/garden')
  const after = await todaySkyRow(uid)
  expect(after!.image_path).not.toBe(before)
  expect(after!.plantings).toHaveLength(2)
  await expect.poll(() => objectExists(before)).toBe(false)

  // 지우면 처음 상태로 돌아간다
  await page.goto('/sky')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '하늘 지우기' }).click()
  await expect(page.getByLabel('하늘 찍기')).toBeAttached()
  await expect.poll(() => todaySkyRow(uid)).toBeNull()
  await expect.poll(() => objectExists(after!.image_path)).toBe(false)
})
