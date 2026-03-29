import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useDNAStore = create(
  persist(
    (set) => ({
      // State
      currentUser: null,
      dnaProfile: null,
      dnaVerified: false,
      pathChoice: null,
      bridgeResults: [],
      blindSpots: [],
      matches: [],

      // Actions
      setUser: (user) => set({ currentUser: user }),

      setDNAProfile: (profile) => set({ dnaProfile: profile }),

      setDNAVerified: (verified) => set({ dnaVerified: verified }),

      setPathChoice: (choice) => set({ pathChoice: choice }),

      setBridgeResults: (results) => set({ bridgeResults: results }),

      setBlindSpots: (spots) => set({ blindSpots: spots }),

      setMatches: (matches) => set({ matches: matches }),

      // Reset clears everything except currentUser
      reset: () =>
        set({
          dnaProfile: null,
          dnaVerified: false,
          pathChoice: null,
          bridgeResults: [],
          blindSpots: [],
          matches: [],
        }),
    }),
    {
      name: 'commonthread-auth',
      // Only persist currentUser; DNA profile stays in memory
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
)

export default useDNAStore
