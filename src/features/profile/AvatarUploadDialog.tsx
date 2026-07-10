import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { Camera, ClipboardPaste, ImagePlus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { validateAvatarFile } from '../../lib/mediaUrl'
import { cropImageToBlob, readClipboardImage, readFileAsDataUrl } from './cropImage'

type AvatarUploadDialogProps = {
  open: boolean
  onClose: () => void
  onUpload: (file: File) => Promise<void>
  onDelete?: () => Promise<void>
  hasAvatar: boolean
  isBusy?: boolean
}

type Step = 'pick' | 'crop'

export function AvatarUploadDialog({
  open,
  onClose,
  onUpload,
  onDelete,
  hasAvatar,
  isBusy = false,
}: AvatarUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('avatar.jpg')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [localBusy, setLocalBusy] = useState(false)

  const reset = useCallback(() => {
    setStep('pick')
    setImageSrc(null)
    setSourceName('avatar.jpg')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setLocalBusy(false)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const handlePickFile = async (file: File) => {
    const error = validateAvatarFile(file)
    if (error) {
      toast.error(error)
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setImageSrc(dataUrl)
      setSourceName(file.name || 'avatar.jpg')
      setStep('crop')
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    } catch {
      toast.error('Не удалось открыть изображение')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void handlePickFile(file)
  }

  const handlePasteFromClipboard = async () => {
    setLocalBusy(true)
    try {
      const file = await readClipboardImage()
      if (!file) {
        toast.error('В буфере обмена нет изображения')
        return
      }
      await handlePickFile(file)
    } finally {
      setLocalBusy(false)
    }
  }

  const handleSaveCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setLocalBusy(true)
    try {
      const blob = await cropImageToBlob(imageSrc, croppedAreaPixels)
      if (blob.size > 5 * 1024 * 1024) {
        toast.error('После обрезки файл всё ещё слишком большой')
        return
      }
      const file = new File([blob], sourceName.replace(/\.\w+$/, '') + '.jpg', {
        type: 'image/jpeg',
      })
      await onUpload(file)
      onClose()
    } catch {
      toast.error('Не удалось сохранить фото')
    } finally {
      setLocalBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setLocalBusy(true)
    try {
      await onDelete()
      onClose()
    } catch {
      toast.error('Не удалось удалить фото')
    } finally {
      setLocalBusy(false)
    }
  }

  if (!open) return null

  const busy = isBusy || localBusy

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="avatar-dialog-title" className="text-lg font-semibold text-foreground">
              {step === 'pick' ? 'Фото профиля' : 'Обрезка фото'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 'pick'
                ? 'JPEG, PNG или WebP, до 5 МБ'
                : 'Перетащите и масштабируйте изображение'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {step === 'pick' ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              Выбрать из файлов
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment')
                  fileInputRef.current.click()
                  fileInputRef.current.removeAttribute('capture')
                }
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
            >
              <Camera className="h-4 w-4" aria-hidden />
              Сделать фото
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handlePasteFromClipboard()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden />
              Вставить из буфера
            </button>
            {hasAvatar && onDelete ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Удалить текущее фото
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative h-64 overflow-hidden rounded-xl bg-muted">
              {imageSrc ? (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, area) => setCroppedAreaPixels(area)}
                />
              ) : null}
            </div>
            <label className="block text-sm font-medium text-foreground">
              Масштаб
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-2 w-full"
                disabled={busy}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep('pick')}
                className="h-11 flex-1 rounded-lg border border-border bg-background text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={busy || !croppedAreaPixels}
                onClick={() => void handleSaveCrop()}
                className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
