'use client'

import type { GardenOption } from '@/lib/data/gardens'

const SHOW_COUNT_FROM = 3

export function GardenChecklist({
  gardens,
  selected,
  onChange,
}: {
  gardens: GardenOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selected, id] : selected.filter((x) => x !== id))
  }

  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="pb-2 text-sm text-muted">어느 정원에 심을까요?</legend>
      {gardens.map((g) => (
        <label
          key={g.id}
          className="flex min-h-11 items-center justify-between rounded-[14px] bg-[rgb(255_253_248/0.6)] px-3.5 text-[15px]"
        >
          {g.memberCount >= SHOW_COUNT_FROM ? `${g.name} · ${g.memberCount}명` : g.name}
          <input
            type="checkbox"
            className="h-5 w-5 accent-sky-deep"
            checked={selected.includes(g.id)}
            onChange={(e) => toggle(g.id, e.target.checked)}
          />
        </label>
      ))}
    </fieldset>
  )
}
