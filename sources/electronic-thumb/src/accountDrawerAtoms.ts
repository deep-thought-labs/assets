/**
 * Account drawer state — clone of Uniswap's accountDrawerOpenAtom (Jotai).
 * Web3Status toggles this; drawer opens/closes based on it.
 */
import { atom } from 'jotai'

export const accountDrawerOpenAtom = atom(false)
