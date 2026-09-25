export const code40 = {
    name: "logical_short_circuit",
    code: `DECLARE calls: INTEGER
FUNCTION bump() RETURNS BOOLEAN
    calls <- calls + 1
    RETURN TRUE
ENDFUNCTION
OUTPUT FALSE AND bump(), TRUE OR bump(), calls`,
    input: [], expected: ["FALSE", "TRUE", 0], error: [],
};
