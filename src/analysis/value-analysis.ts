import { FuncDefNode, ProcDefNode, ProgramNode, nodeKind } from "../syntax/ast";
import { passType } from "../syntax/param";
import { walkStatements } from "../syntax/walk";
import { Symbol } from "../type/symbol";
import { typeKind } from "../type/type";
import { uninitializedReads } from "./definite-assignment";
export type CallableNode = FuncDefNode | ProcDefNode;

export interface CallableEffects {
    /** Raw accesses may alias ANY linear-memory object, not just their argument. */
    rawMemory: boolean;
    readonly calls: Set<string>;
    readonly addressed: Set<Symbol>;
}

export interface ValuePlan {
    readonly promoted: ReadonlySet<Symbol>;
    readonly uninitialized: ReadonlySet<Symbol>;
    readonly effects: CallableEffects;
    readonly shadowWrites: boolean;
    readonly frameless: boolean;
}

/** No expression references or mutation of semantic metadata in this analysis. */
export function analyzeValues(program: ProgramNode): ReadonlyMap<CallableNode, ValuePlan> {
    const callables: CallableNode[] = [];
    walkStatements(program.body, {
        statement(node) {
            if (node.kind === nodeKind.FuncDefNode || node.kind === nodeKind.ProcDefNode) callables.push(node);
        }
    });
    const effects = new Map<CallableNode, CallableEffects>();
    const uninitialized = new Map<CallableNode, ReadonlySet<Symbol>>();
    let preserveMemory = false;
    // Raw addresses anywhere may observe previous frame contents, even after a
    // pure callee returns. This is a layout/spill constraint, not a read barrier.
    walkStatements(program.body, {
        expression(node) {
            preserveMemory ||= node.kind === nodeKind.AddrExprNode || node.kind === nodeKind.DerefExprNode ||
                node.type.kind === typeKind.POINTER;
        }
    });
    const rawProgram = preserveMemory || callables.some(node =>
        node.params.some(param => param.type.kind === typeKind.POINTER));
    preserveMemory ||= rawProgram;
    for (const node of callables) {
        // A BYREF argument made from an unsafe pointer may designate even this
        // callee's future frame slots. Without provenance, treat it as raw too.
        const effect: CallableEffects = {
            rawMemory: rawProgram && node.params.some(param =>
                param.passType === passType.BYREF), calls: new Set(), addressed: new Set()
        };
        for (const param of node.params) {
            if (param.passType === passType.BYREF) effect.addressed.add(node.local.lookUp(param.ident.lexeme));
            if (param.type.kind === typeKind.POINTER) effect.rawMemory = preserveMemory = true;
        }
        walkStatements(node.body, {
            expression(expr) {
                if (expr.kind === nodeKind.AddrExprNode || expr.kind === nodeKind.DerefExprNode ||
                    expr.type.kind === typeKind.POINTER) effect.rawMemory = true;
                if (expr.kind === nodeKind.AddrExprNode && expr.lVal.kind === nodeKind.VarExprNode) {
                    effect.addressed.add(node.local.lookUp(expr.lVal.ident.lexeme));
                }
                if (expr.kind === nodeKind.CallFuncExprNode || expr.kind === nodeKind.CallProcExprNode) {
                    if (expr.callee.kind !== nodeKind.VarExprNode) { effect.rawMemory = true; return; }
                    effect.calls.add(expr.callee.ident.lexeme);
                    if (expr.kind === nodeKind.CallProcExprNode) {
                        const modes = [...node.local.lookUpProc(expr.callee.ident.lexeme).paramModes.values()];
                        expr.args.forEach((arg, index) => {
                            if (modes[index] === passType.BYREF && arg.kind === nodeKind.VarExprNode) {
                                effect.addressed.add(node.local.lookUp(arg.ident.lexeme));
                            }
                        });
                    }
                }
            }
        });
        effects.set(node, effect);
        const unsafe = uninitializedReads(node.body, node.local,
            node.params.map(param => node.local.lookUp(param.ident.lexeme)));
        uninitialized.set(node, unsafe);
        preserveMemory ||= unsafe.size > 0 || [...node.local.elems.values()].some(symbol =>
            symbol.type.kind === typeKind.ARRAY || symbol.type.kind === typeKind.RECORD);
    }
    // Monotone fixed point also handles recursive and mutually recursive calls.
    const byName = new Map(callables.map(node => [node.ident.lexeme, node]));
    let changed: boolean;
    do {
        changed = false;
        for (const effect of effects.values()) {
            if (!effect.rawMemory && [...effect.calls].some(name => {
                const callee = byName.get(name);
                return callee !== undefined && effects.get(callee)!.rawMemory;
            })) { effect.rawMemory = true; changed = true; }
        }
    } while (changed);

    const plans = new Map<CallableNode, ValuePlan>();
    for (const node of callables) {
        const effect = effects.get(node)!;
        const unsafe = uninitialized.get(node)!;
        const promoted = new Set([...node.local.elems.values()].filter(symbol =>
            symbol.type.kind === typeKind.BASIC && !unsafe.has(symbol) &&
            !effect.addressed.has(symbol) && !effect.rawMemory));
        plans.set(node, {
            promoted, effects: effect, uninitialized: unsafe, shadowWrites: preserveMemory,
            frameless: !preserveMemory && promoted.size === node.local.elems.size
        });
    }
    return plans;
}
