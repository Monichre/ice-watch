'use client'

import Link from 'next/link'

type NavLinkProps = {
  href: string
  label: string
}

export function NavLink({href, label}: NavLinkProps) {
  const handleMouseEnter = () => {
    if (href === '/' && typeof window !== 'undefined') {
      void import('@/components/leaflet-map')
    }
  }

  return (
    <Link
      href={href}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
    >
      {label}
    </Link>
  )
}
