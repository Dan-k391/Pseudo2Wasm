export const code5 = {
    name: "bool_output",
    code: `DECLARE i: INTEGER
DECLARE j: INTEGER

INPUT i
INPUT j
OUTPUT i < j
    `,
    input: [1, 2],
    expected: ["TRUE"],
    // cannot be used yet
    error: [],
};

