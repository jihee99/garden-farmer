'use client'

import type { ChangeEvent } from 'react'

type OnFile = (file: File) => void

function pick(onFile: OnFile) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // 같은 파일을 다시 골라도 change가 나도록
    if (file) onFile(file)
  }
}

/** 사진이 없을 때 사진 영역 가운데: 카메라 촬영 + 앨범 선택(카메라를 못 쓸 때). */
export function CaptureInputs({ onFile, busy }: { onFile: OnFile; busy: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <label className="flex h-[54px] min-w-44 cursor-pointer items-center justify-center rounded-full bg-sky-deep px-6 text-[17px] text-white shadow-[0_6px_18px_rgba(79,114,153,.3)]">
        {busy ? '하늘을 읽는 중…' : '하늘 찍기'}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick(onFile)} disabled={busy} />
      </label>
      <label className="flex min-h-11 cursor-pointer items-center px-3 text-sm text-ink underline">
        앨범에서 고르기
        <input type="file" accept="image/*" className="sr-only" onChange={pick(onFile)} disabled={busy} />
      </label>
    </div>
  )
}

/** 사진 위 오른쪽 아래 "다시 찍기". */
export function RetakeInput({ onFile, label = '다시 찍기' }: { onFile: OnFile; label?: string }) {
  return (
    <label className="absolute bottom-3.5 right-4 flex min-h-11 cursor-pointer items-center rounded-xl bg-[rgb(255_253_248/0.78)] px-3 text-[13px] text-ink">
      {label}
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick(onFile)} />
    </label>
  )
}
