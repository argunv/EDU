import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/mediaUrl'
import { getInitials } from '@/lib/userDisplay'

type UserAvatarProps = {
  name?: string | null
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-2xl',
} as const

export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  const src = resolveMediaUrl(avatarUrl)
  const initials = getInitials(name)

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `Аватар: ${name}` : 'Аватар'}
        className={cn(
          'shrink-0 rounded-full object-cover',
          sizeClasses[size],
          className,
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground',
        sizeClasses[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  )
}
