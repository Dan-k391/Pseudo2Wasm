export const code43 = {
    name: "input_string_exact_heap_fit",
    code: `DECLARE s: STRING
INPUT s
OUTPUT LENGTH(s)`,
    input: ["x".repeat(6 * 65536 - 1)], expected: [6 * 65536 - 1], error: [],
};
