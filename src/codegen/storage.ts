import binaryen from "binaryen";

/** Backend-owned locations; constructing an address always creates fresh IR. */
export type MemoryLocation =
    | {kind: "global"; address: number}
    | {kind: "frame"; offset: number}
    | {kind: "indirect"; parameter: number}
    // Compatibility for Generator.setPointer callers, never assigned to Symbols.
    | {kind: "explicit"; expression: binaryen.ExpressionRef};

export type StorageLocation = MemoryLocation |
    {kind: "local"; index: number; shadow?: MemoryLocation};
