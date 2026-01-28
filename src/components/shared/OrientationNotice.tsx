type OrientationNoticeProps = {
  visible: boolean
  onDismiss: () => void
  message?: string
}

export function OrientationNotice({
  visible,
  onDismiss,
  message = 'Для удобства просмотра журнала переверните устройство горизонтально',
}: OrientationNoticeProps) {
  if (!visible) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 px-4 py-4 shadow-md backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
        <div className="text-sm font-semibold text-foreground">{message}</div>
        <button
          type="button"
          onClick={onDismiss}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground"
        >
          Понятно
        </button>
      </div>
    </div>
  )
}
