import { RuntimeError } from "./error";


export function unreachable(): never {
    throw new RuntimeError("Unreachable code");
}
