type JournalAverageCellProps = {
  value: string
}

export function JournalAverageCell({ value }: JournalAverageCellProps) {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-rose-700">
      {value}
    </div>
  )
}
