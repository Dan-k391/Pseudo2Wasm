export const code24 = {
    name: "input_string_heap_limit",
    code: `DECLARE s: STRING
INPUT s`,
    input: ["x".repeat(6 * 65536)],
    expected: [],
    error: ["Input string exceeds heap memory limit", "line 2:1"],
};
