import { describe, it, expect } from "vitest"

describe("test infrastructure", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2)
  })

  it("has jsdom localStorage", () => {
    localStorage.setItem("x", "y")
    expect(localStorage.getItem("x")).toBe("y")
  })
})
