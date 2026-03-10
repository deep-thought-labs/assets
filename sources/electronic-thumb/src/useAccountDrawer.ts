import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { accountDrawerOpenAtom } from './accountDrawerAtoms'

export function useAccountDrawer() {
  const [isOpen, setOpen] = useAtom(accountDrawerOpenAtom)
  return {
    isOpen,
    open: useCallback(() => setOpen(true), [setOpen]),
    close: useCallback(() => setOpen(false), [setOpen]),
    toggle: useCallback(() => setOpen((o) => !o), [setOpen]),
  }
}
