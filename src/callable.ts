import { Environment } from "./environment";

export interface Callable {
    arity(): number;
    call(env: Environment, args: Array<unknown>): unknown;
}