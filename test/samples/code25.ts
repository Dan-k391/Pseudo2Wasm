export const code25 = {
    name: "input_strings_do_not_overlap",
    code: `DECLARE a: STRING
DECLARE b: STRING
INPUT a
INPUT b
OUTPUT a
OUTPUT b`,
    input: ["first", "second"],
    expected: ["first", "second"],
    error: [],
};
