import { FuncDefNode, ProcDefNode, ProgramNode, nodeKind } from "../syntax/ast";
import { passType } from "../syntax/param";
import { walkStatements } from "../syntax/walk";
import { Symbol } from "../type/symbol";
import { typeKind } from "../type/type";

export type CallableNode = FuncDefNode | ProcDefNode;
export type ParameterReads = ReadonlyMap<Symbol, number>;

/**
 * Identify immutable BYVAL scalar parameters whose reads can use Wasm params.
 * This is not general escape/definite-assignment analysis. Until those exist,
 * any address-taking, pointer use, or BYREF parameter disables this optimization
 * for the whole program: raw pointer aliases may cross object/frame boundaries.
 */
export function analyzeParameterReads(program: ProgramNode): ReadonlyMap<CallableNode, ParameterReads> {
    const callables: CallableNode[] = [];
    let hasAliases = false;
    walkStatements(program.body, {
        statement(node) {
            if (node.kind === nodeKind.FuncDefNode || node.kind === nodeKind.ProcDefNode) {
                callables.push(node);
                hasAliases ||= node.params.some(param => param.passType === passType.BYREF ||
                    param.type.kind === typeKind.POINTER);
            }
        },
        expression(node) {
            hasAliases ||= node.kind === nodeKind.AddrExprNode || node.kind === nodeKind.DerefExprNode ||
                node.type.kind === typeKind.POINTER;
        },
    });

    const plans = new Map<CallableNode, ParameterReads>();
    if (hasAliases) return plans;
    for (const callable of callables) {
        const written = new Set<string>();
        walkStatements(callable.body, {
            statement(node) {
                if (node.kind === nodeKind.ForNode) written.add(node.ident.lexeme);
                if (node.kind === nodeKind.InputNode && node.expr.kind === nodeKind.VarExprNode) {
                    written.add(node.expr.ident.lexeme);
                }
            },
            expression(node) {
                if (node.kind === nodeKind.AssignNode && node.left.kind === nodeKind.VarExprNode) {
                    written.add(node.left.ident.lexeme);
                }
            },
        });
        const reads = new Map<Symbol, number>();
        callable.params.forEach((param, index) => {
            if (param.passType === passType.BYVAL && param.type.kind === typeKind.BASIC &&
                !written.has(param.ident.lexeme)) {
                reads.set(callable.local.lookUp(param.ident.lexeme), index);
            }
        });
        plans.set(callable, reads);
    }
    return plans;
}
