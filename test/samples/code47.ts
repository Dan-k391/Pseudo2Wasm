export const code47 = {
    name: "stack_frame_accounts_for_saved_base_slot",
    code: `FUNCTION overflow() RETURNS INTEGER
    DECLARE a: ARRAY[0:131071] OF INTEGER
    RETURN 0
ENDFUNCTION
OUTPUT overflow()`,
    input: [], expected: [], error: ["Stack memory limit exceeded", "line 1:10"],
};
