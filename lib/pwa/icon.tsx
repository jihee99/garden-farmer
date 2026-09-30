const PETALS = ['#9CC3E4', '#F2B8A2', '#8494C6', '#F2CE8C', '#E9A9BD']

/** 5장 꽃잎 + 금빛 가운데. next/og ImageResponse 안에서만 쓴다. */
export function FlowerIcon({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, display: 'flex', background: '#F7F2E9' }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {PETALS.map((color, i) => (
          <ellipse
            key={color}
            cx="50"
            cy="31"
            rx="13"
            ry="19"
            fill={color}
            fillOpacity="0.85"
            transform={`rotate(${i * 72} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="8" fill="#E0A73E" />
      </svg>
    </div>
  )
}
