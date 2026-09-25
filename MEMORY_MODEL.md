# WebAssembly memory model

This is the contract implemented for Milestone 5. The imported linear memory
has a fixed minimum and maximum of 30 pages (1,966,080 bytes). It does not
grow. This cap is deliberate for now: fixed, disjoint regions make exhaustion
deterministic and keep the host import stable. Larger programs require a future
layout redesign, not an implicit `memory.grow` that would collide with the
current stack and input-string heap.

| Byte interval | Use | Exhaustion |
| --- | --- | --- |
| 0–3 | Reserved null/invalid address | Pointer dereference fails. |
| 4–1,048,575 | Global variables and null-terminated UTF-8 literals | Compilation fails if static data reaches the stack. |
| 1,048,576–1,572,863 | Upward-growing callable stack | Frame reservation fails with the declaration's source location. |
| 1,572,864–1,966,079 | Upward-growing input-string heap | `INPUT` fails with its source location if encoded bytes plus terminator do not fit. |

Each call reserves a four-byte previous-frame pointer and the callable's full
local frame. Frame space is reused on return; input strings are **not** freed
until execution ends. The final byte of each region may be used. Array and
record data are in-place, not separately allocated. Every source basic value
and pointer occupies four bytes except REAL, which occupies eight. Global
strings can leave following values unaligned; loads/stores therefore currently
use conservative one-byte Wasm alignment hints. This is valid but may cost
performance. String literals and input strings are UTF-8, NUL-terminated;
embedded NUL and some Unicode/CHAR operations need a separate language fix.

Index bounds, pointer linear-memory range, and stack-frame limit comparisons
run inside Wasm. The imported `failIndex`, `failPointer`, and `failStack`
functions are called only on failure to render a source-located `RuntimeError`.
The compiler evaluates a checked index/address once using Wasm locals. Pointer
range checks compare unsigned addresses against `MEMORY_END - accessSize`, so
32-bit addition cannot wrap an out-of-bounds address into an apparently valid
one. Pointer-array indexing also checks its whole declared view before adding
the element offset. Normal data reads/writes and successful checks do not call
JavaScript; genuine INPUT/OUTPUT still cross the host boundary.

## Pointer safety boundary

Pointers are *not* memory-safe capabilities. A pointer is a 32-bit linear-memory
address; checks know only the requested access size and total memory range.
They do not know the originating allocation, subobject bounds, type at the
address, or lifetime. A stale alias to a reused stack address can therefore
read or write another live value. An address inside a different object can also
pass the linear-memory check. Pointer arithmetic remains rejected by the
checker, and escaping a current-frame pointer via an ordinary nonlocal pointer
assignment is rejected, but those restrictions do not establish full
provenance safety. Do not use this compiler for untrusted pointer-heavy code.
The regression test `pointer_linear_range_does_not_enforce_object_bounds`
demonstrates the limitation: a pointer view starting at one global INTEGER can
read the next global INTEGER because both addresses are inside linear memory.

The runtime host should be treated as trusted: failure imports throw, and the
memory import is supplied by `Compiler.execute()`. Execution uses browser/Node
WebAssembly JSPI for asynchronous input. The first invalid array index or
pointer access reports its source line and column; a plain Wasm memory trap
from an unchecked internal operation may not have that precision yet.
