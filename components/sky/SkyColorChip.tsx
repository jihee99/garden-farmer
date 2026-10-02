import { colorName } from '@/lib/image/color-name'

export function SkyColorChip({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[18px] border border-line bg-card px-3.5 py-3">
      <div
        aria-hidden
        className="h-10 w-10 shrink-0 rounded-full shadow-[inset_0_-6px_10px_rgba(255,255,255,.45)]"
        style={{ background: color }}
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-[15px]">오늘의 하늘빛 · {colorName(color)}</p>
        <p className="text-[13px] text-muted">이 색으로 꽃잎이 칠해져요</p>
      </div>
    </div>
  )
}
