'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { userMessageOf } from '@/lib/data/errors'
import type { GardenOption } from '@/lib/data/gardens'
import {
  deleteSky,
  plantSky,
  removeSkyImage,
  setPlantings,
  skyImagePath,
  uploadSkyImage,
  type TodaySky,
} from '@/lib/data/sky'
import { seoulDate } from '@/lib/domain/date'
import { useOnline } from '@/lib/hooks/use-online'
import { prepareSkyImage } from '@/lib/image/compress'
import { dominantColor } from '@/lib/image/dominant-color'
import { createClient } from '@/lib/supabase/client'
import { AlertChip } from './AlertChip'
import { CaptureInputs, RetakeInput } from './CaptureInputs'
import { GardenChecklist } from './GardenChecklist'
import { SkyColorChip } from './SkyColorChip'

type Props = {
  userId: string
  gardens: GardenOption[]
  alertAt: string | null
  todaySky: TodaySky | null
  todayImageUrl: string | null
}

type Captured = { blob: Blob; previewUrl: string; color: string; uploadedPath: string | null }
type Busy = 'reading' | 'planting' | 'saving' | 'deleting' | null

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x))
}

export function SkyCapture({ userId, gardens, alertAt, todaySky, todayImageUrl }: Props) {
  const router = useRouter()
  const online = useOnline()
  const [captured, setCaptured] = useState<Captured | null>(null)
  const [selected, setSelected] = useState<string[]>(() => todaySky?.gardenIds ?? gardens.map((g) => g.id))
  const [note, setNote] = useState(todaySky?.note ?? '')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  // URL 값에 맞춰 해제한다. captured 객체 전체에 걸면 uploadedPath만 바뀌어도 화면에 쓰는 URL이 해제된다.
  const previewUrl = captured?.previewUrl
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  async function run(kind: Exclude<Busy, null>, task: () => Promise<void>) {
    setError(null)
    setBusy(kind)
    try {
      await task()
    } catch (e) {
      setError(userMessageOf(e))
      setBusy(null)
    }
  }

  function onFile(file: File) {
    if (busy !== null) return
    void run('reading', async () => {
      const { blob, colorPixels } = await prepareSkyImage(file)
      setCaptured({ blob, previewUrl: URL.createObjectURL(blob), color: dominantColor(colorPixels), uploadedPath: null })
      setBusy(null)
    })
  }

  function plant() {
    if (!captured) return
    void run('planting', async () => {
      const db = createClient()
      // 업로드는 됐는데 심기에 실패한 경우, 다시 시도할 때 같은 파일을 재사용한다.
      let path = captured.uploadedPath
      if (!path) {
        path = skyImagePath(userId, seoulDate())
        await uploadSkyImage(db, path, captured.blob)
        // 그 사이 다시 찍은 사진을 덮어쓰지 않도록, 같은 사진일 때만 기록한다.
        setCaptured((c) => (c && c.blob === captured.blob ? { ...c, uploadedPath: path } : c))
      }
      const { oldImagePath } = await plantSky(db, {
        imagePath: path,
        color: captured.color,
        note: note.trim() || null,
        gardenIds: selected,
      })
      await removeSkyImage(db, oldImagePath)
      router.push('/garden')
      router.refresh()
    })
  }

  function saveGardens() {
    if (!todaySky) return
    void run('saving', async () => {
      await setPlantings(createClient(), todaySky.id, selected)
      router.refresh()
      setBusy(null)
    })
  }

  function removeToday() {
    if (!todaySky || !window.confirm('오늘 하늘을 지울까요? 모든 정원에서 내 꽃잎이 비어요.')) return
    void run('deleting', async () => {
      const db = createClient()
      const path = await deleteSky(db, todaySky.id)
      await removeSkyImage(db, path)
      router.refresh()
    })
  }

  const viewingToday = todaySky !== null && captured === null
  const shownColor = captured?.color ?? todaySky?.color ?? null
  const canPlant = captured !== null && busy === null && online && selected.length > 0
  const canSave =
    viewingToday && busy === null && online && selected.length > 0 && !sameSet(selected, todaySky.gardenIds)

  return (
    <main className="flex min-h-dvh flex-col gap-[18px] px-5 pb-7 pt-13">
      <header className="flex items-center justify-between">
        <Link href="/garden" className="flex min-h-11 items-center gap-1 text-[15px] text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          정원
        </Link>
        <h1 className="font-serif text-lg font-bold">지금, 하늘</h1>
        <AlertChip alertAt={alertAt} />
      </header>

      <section aria-label="하늘 사진" className="relative h-[330px] shrink-0 overflow-hidden rounded-[28px] bg-[#C7DDEF]">
        {captured ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL 미리보기 */}
            <img src={captured.previewUrl} alt="방금 찍은 하늘" className="h-full w-full object-cover" />
            <RetakeInput onFile={onFile} disabled={busy !== null} />
          </>
        ) : viewingToday ? (
          <>
            {todayImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- 1시간짜리 signed URL
              <img src={todayImageUrl} alt="오늘 심은 하늘" className="h-full w-full object-cover" />
            )}
            <RetakeInput onFile={onFile} disabled={busy !== null} />
          </>
        ) : (
          <CaptureInputs onFile={onFile} busy={busy === 'reading'} />
        )}
      </section>

      {shownColor && <SkyColorChip color={shownColor} />}

      {(captured || viewingToday) && (
        <>
          <GardenChecklist gardens={gardens} selected={selected} onChange={setSelected} />
          {captured ? (
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              한 줄 남기기 (선택)
              <input
                type="text"
                maxLength={60}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="점심 먹고 올려다본 하늘"
                className="h-[46px] rounded-[14px] border border-[#DCD2C1] bg-[#FFFDF8] px-3.5 text-[15px] text-ink"
              />
            </label>
          ) : (
            todaySky?.note && <p className="text-[15px] text-ink">“{todaySky.note}”</p>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-[#7A3E2C]">
          {error}
        </p>
      )}
      {!online && (
        <p role="status" className="text-sm text-muted">
          오프라인이에요. 연결되면 하늘을 심을 수 있어요.
        </p>
      )}

      {viewingToday ? (
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={saveGardens}
            disabled={!canSave}
            className="h-[54px] rounded-full bg-sky-deep text-[17px] text-white shadow-[0_6px_18px_rgba(79,114,153,.3)] disabled:opacity-50"
          >
            {busy === 'saving' ? '저장 중…' : '정원 바꾸기 저장'}
          </button>
          <button
            type="button"
            onClick={removeToday}
            disabled={busy !== null || !online}
            className="h-11 text-sm text-muted underline disabled:opacity-50"
          >
            {busy === 'deleting' ? '지우는 중…' : '하늘 지우기'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={plant}
          disabled={!canPlant}
          className="mt-auto h-[54px] shrink-0 rounded-full bg-sky-deep text-[17px] text-white shadow-[0_6px_18px_rgba(79,114,153,.3)] disabled:opacity-50"
        >
          {busy === 'planting' ? '심는 중…' : '하늘 심기'}
        </button>
      )}
    </main>
  )
}
