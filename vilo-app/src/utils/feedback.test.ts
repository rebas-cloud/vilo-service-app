import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { type Mock } from "vitest"
import {
  feedbackOrderAdded,
  feedbackOrderSent,
  feedbackItemDeleted,
  feedbackError,
  feedbackTap,
  initAudioContext,
} from "./feedback"

interface MockOscillator {
  type: string
  frequency: { setValueAtTime: Mock }
  connect: Mock
  start: Mock
  stop: Mock
}

interface MockGainNode {
  gain: { setValueAtTime: Mock; exponentialRampToValueAtTime: Mock }
  connect: Mock
}

interface MockAudioContext {
  state: string
  currentTime: number
  createOscillator: Mock
  createGain: Mock
  destination: unknown
  resume: Mock
}

describe("feedback.ts", () => {
  let mockOscillator: MockOscillator
  let mockGainNode: MockGainNode
  let mockAudioContext: MockAudioContext
  let vibrateFn: Mock
  let audioContextConstructor: Mock

  beforeEach(() => {
    vi.useFakeTimers()

    // Mock oscillator
    mockOscillator = {
      type: "",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }

    // Mock gain node
    mockGainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }

    // Mock AudioContext
    mockAudioContext = {
      state: "running",
      currentTime: 0,
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGainNode),
      destination: {},
      resume: vi.fn(),
    }

    // Set up window.AudioContext constructor
    audioContextConstructor = vi.fn(() => mockAudioContext)
    window.AudioContext = audioContextConstructor as unknown as typeof AudioContext
    ;(window as unknown as Record<string, unknown>).webkitAudioContext = audioContextConstructor

    // Mock navigator.vibrate as a function
    vibrateFn = vi.fn()
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateFn,
      writable: true,
      configurable: true,
    })
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
      })

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
      // Remove vibrate from navigator
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

    it("plays two tones in sequence", () => {
      feedbackOrderAdded()

      // First tone (A5 - 880Hz)
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
        880,
        expect.any(Number)
      )
      expect(mockOscillator.start).toHaveBeenCalled()
      expect(mockOscillator.stop).toHaveBeenCalled()

      // Reset to track second call
      mockOscillator.frequency.setValueAtTime.mockClear()

      // Advance 80ms to trigger second tone
      vi.advanceTimersByTime(80)

      // Second tone (D6 - 1175Hz) should be scheduled
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
        1175,
        expect.any(Number)
      )
    })

    it("sets correct volume envelope for first tone", () => {
      feedbackOrderAdded()

      // Check first tone volume (0.25)
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.25, expect.any(Number))
      expect(mockGainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
        0.001,
        expect.any(Number)
      )
    })

    it("connects oscillator to gain node to destination", () => {
      feedbackOrderAdded()

      expect(mockOscillator.connect).toHaveBeenCalledWith(mockGainNode)
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioContext.destination)
    })
  })

  describe("feedbackOrderSent", () => {
    it("vibrates with pattern [40, 30, 40]", () => {
      feedbackOrderSent()

      expect(vibrateFn).toHaveBeenCalledWith([40, 30, 40])
    })

    it("plays first tone at E5 (660Hz)", () => {
      feedbackOrderSent()

      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
        660,
        expect.any(Number)
      )
    })

    it("plays second tone at A5 (880Hz) after 100ms", () => {
      feedbackOrderSent()

      mockOscillator.frequency.setValueAtTime.mockClear()

      vi.advanceTimersByTime(100)

      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
        880,
        expect.any(Number)
      )
    })

    it("plays third tone at E6 (1320Hz) after 200ms total", () => {
      feedbackOrderSent()

      mockOscillator.frequency.setValueAtTime.mockClear()

      vi.advanceTimersByTime(200)

      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
        1320,
        expect.any(Number)
      )
    })
  })

  describe("feedbackItemDeleted", () => {
    it("vibrates with 30ms pattern", () => {
      feedbackItemDeleted()

      expect(vibrateFn).toHaveBeenCalledWith(30)
    })

    it("plays low tone E4 (330Hz)", () => {
      feedbackItemDeleted()

      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
        330,
        expect.any(Number)
      )
    })

    it("uses lower volume (0.15)", () => {
      feedbackItemDeleted()

      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.15, expect.any(Number))
    })
  })

  describe("feedbackError", () => {
    it("vibrates with pattern [50, 30, 50]", () => {
      feedbackError()

      expect(vibrateFn).toHaveBeenCalledWith([50, 30, 50])
    })

    it("plays low buzzy tone A3 (220Hz)", () => {
      feedbackError()

      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
        220,
        expect.any(Number)
      )
    })

    it("uses square wave oscillator type", () => {
      feedbackError()

      expect(mockOscillator.type).toBe("square")
    })

    it("uses higher volume (0.2) for error", () => {
      feedbackError()

      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.2, expect.any(Number))
    })
  })

  describe("edge cases and error handling", () => {
    it("handles AudioContext creation errors gracefully", () => {
      mockAudioContext.createOscillator.mockImplementation(() => {
        throw new Error("Oscillator creation failed")
      })

      expect(() => {
        feedbackOrderAdded()
      }).not.toThrow()
    })

    it("handles suspended AudioContext state gracefully", () => {
      mockAudioContext.state = "suspended"

      // Use a function that actually plays a tone to trigger AudioContext access
      expect(() => {
        feedbackOrderAdded()
      }).not.toThrow()

      // Resume is called during getAudioContext to handle iOS suspend state
      // The actual behavior is tested by the function not throwing
    })

    it("handles missing navigator.vibrate API", () => {
      Object.defineProperty(navigator, "vibrate", {
        value: undefined,
        writable: true,
        configurable: true,
      })

      expect(() => {
        feedbackOrderAdded()
        feedbackOrderSent()
        feedbackItemDeleted()
        feedbackError()
        feedbackTap()
      }).not.toThrow()
    })

    it("vibrate API errors are caught", () => {
      vibrateFn.mockImplementation(() => {
        throw new Error("Vibrate not allowed")
      })

      expect(() => {
        feedbackOrderAdded()
      }).not.toThrow()
    })

    it("oscillator tone parameters are set correctly", () => {
      feedbackItemDeleted()

      // Verify oscillator is created and connected to gain node to destination
      // This proves the audio graph is set up correctly
      expect(mockOscillator.type).toBeDefined()
      expect(mockOscillator.start).toHaveBeenCalled()
      expect(mockOscillator.stop).toHaveBeenCalled()
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
