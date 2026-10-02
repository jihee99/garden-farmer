'use client'

import { useEffect, useState } from 'react'
import { alertChip } from '@/lib/domain/alert-chip'

export function AlertChip({ alertAt }: { alertAt: string | null }) {
  // 서버·클라이언트 시각 차이로 인한 hydration 불일치를 피하려고 마운트 후에 그린다.
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div className="h-[30px] w-24" aria-hidden />
  const { label, counting } = alertChip(now, alertAt ? new Date(alertAt) : null)
  return (
    <div
      className={`rounded-[14px] px-3 py-1.5 text-[13px] ${counting ? 'bg-[#F2DCD2] text-[#7A3E2C]' : 'bg-card text-muted'}`}
    >
      {label}
    </div>
  )
}
