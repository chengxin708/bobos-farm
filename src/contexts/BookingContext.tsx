"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"

export interface SelectedYurt {
  id: string
  name: string
  capacity: number
  imageUrl?: string | null
}

export interface BookingState {
  selectedDate: string | null // ISO date string "2026-03-15"
  selectedYurtId: string | null
  selectedYurt: SelectedYurt | null
  guestCount: number
  contactName: string
  contactEmail: string
  contactPhone: string
  specialRequests: string
  reservationId: string | null // set after POST /api/reservations
  paymentDeadline: string | null // ISO datetime from API response
}

interface BookingContextValue extends BookingState {
  /** Whether sessionStorage state has been loaded (prevents false redirects on refresh) */
  hydrated: boolean
  setSelectedDate: (date: string | null) => void
  setSelectedYurt: (yurt: SelectedYurt | null) => void
  setGuestCount: (count: number) => void
  setDetails: (details: {
    contactName: string
    contactEmail: string
    contactPhone: string
    specialRequests: string
    guestCount: number
  }) => void
  setReservation: (id: string, deadline: string) => void
  resetBooking: () => void
}

const STORAGE_KEY = "bobo-booking-state"

const defaultState: BookingState = {
  selectedDate: null,
  selectedYurtId: null,
  selectedYurt: null,
  guestCount: 1,
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  specialRequests: "",
  reservationId: null,
  paymentDeadline: null,
}

const BookingContext = createContext<BookingContextValue | null>(null)

function loadState(): BookingState {
  if (typeof window === "undefined") return defaultState
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    return { ...defaultState, ...JSON.parse(raw) }
  } catch {
    return defaultState
  }
}

function saveState(state: BookingState) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage quota exceeded or unavailable -- ignore
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(defaultState)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    setState(loadState())
    setHydrated(true)
  }, [])

  // Persist to sessionStorage on every change (after hydration)
  useEffect(() => {
    if (hydrated) saveState(state)
  }, [state, hydrated])

  const setSelectedDate = useCallback((date: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedDate: date,
    }))
  }, [])

  const setSelectedYurt = useCallback((yurt: SelectedYurt | null) => {
    setState((prev) => ({
      ...prev,
      selectedYurtId: yurt?.id ?? null,
      selectedYurt: yurt,
    }))
  }, [])

  const setGuestCount = useCallback((count: number) => {
    setState((prev) => ({ ...prev, guestCount: count }))
  }, [])

  const setDetails = useCallback(
    (details: {
      contactName: string
      contactEmail: string
      contactPhone: string
      specialRequests: string
      guestCount: number
    }) => {
      setState((prev) => ({ ...prev, ...details }))
    },
    []
  )

  const setReservation = useCallback((id: string, deadline: string) => {
    setState((prev) => ({
      ...prev,
      reservationId: id,
      paymentDeadline: deadline,
    }))
  }, [])

  const resetBooking = useCallback(() => {
    setState(defaultState)
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  return (
    <BookingContext.Provider
      value={{
        ...state,
        hydrated,
        setSelectedDate,
        setSelectedYurt,
        setGuestCount,
        setDetails,
        setReservation,
        resetBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  )
}

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext)
  if (!ctx) {
    throw new Error("useBooking must be used within a BookingProvider")
  }
  return ctx
}
