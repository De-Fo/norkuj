export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: '15px', md: '19px', lg: '28px' }
  return (
    <span style={{ fontSize: sizes[size], fontWeight: 600, letterSpacing: '-0.04em', userSelect: 'none' }}>
      <span style={{ color: 'var(--c-text)' }}>no</span>
      <span style={{ color: 'var(--c-rk)' }}>rk</span>
      <span style={{ color: 'var(--c-text)' }}>uj</span>
    </span>
  )
}