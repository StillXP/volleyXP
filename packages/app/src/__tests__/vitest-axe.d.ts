// vitest-axe 0.1.0 declares its matcher on the global Vi namespace that vitest 1.x no
// longer reads, so declare it on vitest's Assertion directly.
export {};

declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
