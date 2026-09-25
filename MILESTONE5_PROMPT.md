# Milestone 5 implementation prompt

Improve the compiler's generated WebAssembly memory safety and hot-path
efficiency without claiming more pointer safety than it provides.

1. Audit the actual global/stack/string-heap layout, allocation limits,
   alignment, Wasm memory import, and pointer representation. Specify the
   contract in a memory-model document before changing it. Keep compatibility
   unless a measured or demonstrated correctness issue justifies a change.
2. Keep the current deliberately unsafe typed-pointer model unless full
   allocation identity, bounds, and lifetime tracking can be implemented and
   tested. Describe stale aliases and intra-memory forged addresses precisely.
3. Generate successful array-index, pointer-range, and stack-frame checks in
   Wasm. Call the host only on a failing path to obtain the existing structured
   source-located diagnostic. Evaluate each checked expression once, prevent
   unsigned address overflow, and avoid signed/unsigned comparison mistakes.
4. Test lower/upper multidimensional indexes, null/out-of-memory pointers,
   recursion at stack limits, input-string heap boundaries, and invalid pointer
   reads and writes. Inspect emitted Wasm imports/calls as well as runtime
   behavior so the hot path has no checking callback.
5. Run `npm test` including the headless browser and packed-package checks.
   Mark roadmap boxes complete only for demonstrated behavior. Document any
   known unsafe cases and remaining architectural limits.

Acceptance: valid memory-heavy code stays within Wasm except for genuine I/O;
invalid accesses fail deterministically with useful source locations; emitted
Wasm validates; the public documentation exactly matches the implementation.
