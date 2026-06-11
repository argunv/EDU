/**
 * Проверка, что ошибка — ответ axios с HTTP 403 (Forbidden).
 * Подходит для ошибок из useQuery/useMutation (React Query v5 передаёт error как unknown).
 */
export function isForbidden(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  const response = (error as { response?: { status?: number } }).response
  return response?.status === 403
}

/** Ответ 404 — например, архивный класс или снятый сущностный ресурс. */
export function isNotFound(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  const response = (error as { response?: { status?: number } }).response
  return response?.status === 404
}
