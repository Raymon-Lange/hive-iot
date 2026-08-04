const RANGES = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: 'Full Week' },
]

export default function ReportingRangeToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          className={value === r.value ? 'active' : ''}
          onClick={() => onChange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
