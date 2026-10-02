type QuilltapLogoProps = {
  className?: string
  alt?: string
}

export function QuilltapLogo({ className = '', alt = 'Quilltap' }: QuilltapLogoProps) {
  return (
    <img
      className={`quilltap-logo ${className}`.trim()}
      src="/quilltap-logo.png"
      alt={alt}
      width={2172}
      height={724}
      decoding="async"
      draggable={false}
    />
  )
}
