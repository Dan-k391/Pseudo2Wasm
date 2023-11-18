export const code3 = {
    name: "record",
    code: `
TYPE test
    DECLARE x: INTEGER
    DECLARE y: INTEGER
    DECLARE str: STRING
ENDTYPE

DECLARE t: test
INPUT t.x
INPUT t.y
INPUT t.str

OUTPUT t.x + t.y
OUTPUT t.str
    `,
    input: [1, 2, "hello"],
    expected: [3, "hello"],
    // cannot be used yet
    error: [],
};
