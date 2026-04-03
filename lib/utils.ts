import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseSupabaseDate(value: string | null | undefined): Date {
  if (!value) return new Date(NaN)

  let v = String(value).trim()
  if (v.includes(' ') && !v.includes('T')) {
    v = v.replace(' ', 'T')
  }

  if (v.endsWith('+00')) {
    v = v.slice(0, -3) + 'Z'
  } else if (v.endsWith('+00:00')) {
    v = v.slice(0, -6) + 'Z'
  }

  return new Date(v)
}
