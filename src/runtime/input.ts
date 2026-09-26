export type InputKind = "INTEGER" | "REAL" | "CHAR" | "STRING" | "BOOLEAN";

export function validUtf16(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(++index);
            if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
        } else if (code >= 0xdc00 && code <= 0xdfff) return false;
    }
    return true;
}

/** Validate before a JS value can be silently coerced by a Wasm import. */
export function parseInput(kind: InputKind, value: unknown, fail: (message: string) => never): number | string {
    switch (kind) {
        case "INTEGER": {
            const number = typeof value === "number" ? value : typeof value === "string" && /^[+-]?\d+$/.test(value.trim())
                ? Number(value.trim()) : NaN;
            if (!Number.isInteger(number) || number < -2147483648 || number > 2147483647) {
                return fail("INTEGER input must be a whole decimal number in [-2147483648:2147483647]");
            }
            return number;
        }
        case "REAL": {
            const number = typeof value === "number" ? value : typeof value === "string" &&
                /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) ? Number(value.trim()) : NaN;
            if (!Number.isFinite(number)) return fail("REAL input must be a finite decimal number");
            return number;
        }
        case "BOOLEAN": {
            const boolean = typeof value === "string" ? value.trim() : value;
            if (boolean === true || boolean === "TRUE") return 1;
            if (boolean === false || boolean === "FALSE") return 0;
            return fail("BOOLEAN input must be true, false, TRUE, or FALSE");
        }
        case "CHAR":
            if (typeof value !== "string" || value.length !== 1 || !validUtf16(value)) {
                return fail("CHAR input must be exactly one non-surrogate UTF-16 code unit");
            }
            return value.charCodeAt(0);
        case "STRING":
            if (typeof value !== "string" || value.includes("\0") || !validUtf16(value)) {
                return fail("STRING input must be well-formed Unicode text without NUL characters");
            }
            return value;
    }
}
