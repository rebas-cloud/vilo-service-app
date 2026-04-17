import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  feedbackOrderAdded,
  feedbackOrderSent,
  feedbackItemDeleted,
  feedbackError,
  feedbackTap,
  initAudioContext,
} from "./feedback"

describe("feedback.ts", () => {
  let vibrateFn: typeof navigator.vibrate

  beforeEach(() => {
    vi.useFakeTimers()

    // Mock navigator.vibrate as a function with implementation
    vibrateFn = vi.fn(() => true)
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateFn,
      writable: true,
      configurable: true,
    })

    // Mock AudioContext to avoid errors
    window.AudioContext = vi.fn(function (this: { [key: string]: unknown }) {
      this.state = "running"
      this.currentTime = 0
      this.destination = {}
      this.createOscillator = vi.fn(() => ({
        type: "sine",
        frequency: { setValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {},
      }))
      this.createGain = vi.fn(() => ({
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => {},
      }))
      this.resume = vi.fn(() => Promise.resolve())
    }) as unknown as typeof AudioContext
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe("initAudioContext", () => {
    it("initializes audio context without throwing", () => {
      expect(() => {
        initAudioContext()
      }).not.toThrow()
    })

    it("handles audio context initialization errors gracefully", () => {
      window.AudioContext = vi.fn(() => {
        throw new Error("Audio context not supported")
      }) as unknown as typeof AudioContext

      expect(() => {
        initAudioContext()
      }).not.toThrow()
    })
  })

  describe("feedbackTap", () => {
    it("vibrates with 15ms pattern", () => {
      feedbackTap()

      expect(vibrateFn).toHaveBeenCalledWith(15)
    })

    it("handles missing vibrate API gracefully", () => {
      Object.defineProperty(navigator, "vibrate", {
        value: undefined,
        writable: true,
        configurable: true,
      })

      expect(() => {
        feedbackTap()
      }).not.toThrow()
    })
  })

  describe("feedbackOrderAdded", () => {
    it("vibrates with 50ms pattern", () => {
      feedbackOrderAdded()

      expect(vibrateFn).toHaveBeenCalledWith(50)
    })

    it("executes without throwing", () => {
      expect(() => {
        feedbackOrderAdded()
      }).not.toThrow()
    })

    it("calls vibrate API", () => {
      vibrateFn.mockClear()
      feedbackOrderAdded()

      expect(vibrateFn).toHaveBeenCalled()
    })
  })

  describe("feedbackOrderSent", () => {
    it("vibrates with pattern [40, 30, 40]", () => {
      feedbackOrderSent()

      expect(vibrateFn).toHaveBeenCalledWith([40, 30, 40])
    })

    it("executes without throwing", () => {
      expect(() => {
        feedbackOrderSent()
      }).not.toThrow()
    })
  })

  describe("feedbackItemDeleted", () => {
    it("vibrates with 30ms pattern", () => {
      feedbackItemDeleted()

      expect(vibrateFn).toHaveBeenCalledWith(30)
    })

    it("executes without throwing", () => {
      expect(() => {
        feedbackItemDeleted()
      }).not.toThrow()
    })
  })

  describe("feedbackError", () => {
    it("vibrates with pattern [50, 30, 50]", () => {
      feedbackError()

      expect(vibrateFn).toHaveBeenCalledWith([50, 30, 50])
    })

    it("executes without throwing", () => {
      expect(() => {
        feedbackError()
      }).not.toThrow()
    })
  })

  describe("integration - all feedback types work together", () => {
    it("all feedback functions handle errors without throwing", () => {
      expect(() => {
        feedbackOrderAdded()
        feedbackOrderSent()
        feedbackItemDeleted()
        feedbackError()
        feedbackTap()
        initAudioContext()
      }).not.toThrow()
    })

    it("vibrate is called with correct patterns across all functions", () => {
      vibrateFn.mockClear()

      feedbackOrderAdded()
      expect(vibrateFn).toHaveBeenCalledWith(50)

      vibrateFn.mockClear()
      feedbackOrderSent()
      expect(vibrateFn).toHaveBeenCalledWith([40, 30, 40])

      vibrateFn.mockClear()
      feedbackItemDeleted()
      expect(vibrateFn).toHaveBeenCalledWith(30)

      vibrateFn.mockClear()
      feedbackError()
      expect(vibrateFn).toHaveBeenCalledWith([50, 30, 50])

      vibrateFn.mockClear()
      feedbackTap()
      expect(vibrateFn).toHaveBeenCalledWith(15)
    })
  })
})
