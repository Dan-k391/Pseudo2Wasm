/** Fixed linear-memory layout shared by code generation and the host runtime. */
export const PAGE_SIZE = 65536;
export const MEMORY_PAGES = 30;
export const GLOBAL_DATA_START = 4; // Address zero is reserved for null pointers.
export const STACK_START = 16 * PAGE_SIZE;
export const HEAP_START = 24 * PAGE_SIZE;
export const MEMORY_END = MEMORY_PAGES * PAGE_SIZE;
