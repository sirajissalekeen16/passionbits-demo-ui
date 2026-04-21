import { useState, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)

  const show = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const Toast = toast ? (
    <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
  ) : null

  return { show, Toast }
}
