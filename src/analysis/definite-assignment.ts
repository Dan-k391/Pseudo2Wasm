import { Expr, Stmt, nodeKind } from "../syntax/ast";
import { Scope } from "../type/scope";
import { Symbol, symbolKind } from "../type/symbol";
import { typeKind } from "../type/type";

/** Structured forward must-analysis. null is an unreachable continuation. */
type State = Set<Symbol> | null;

export function uninitializedReads(body: ReadonlyArray<Stmt>, scope: Scope,
    initialized: Iterable<Symbol>): ReadonlySet<Symbol> {
    const unsafe = new Set<Symbol>();
    const read = (name: string, state: Set<Symbol>) => {
        const symbol = scope.lookUp(name);
        if (symbol.kind === symbolKind.LOCAL && !state.has(symbol)) unsafe.add(symbol);
    };
    const expression = (node: Expr, state: Set<Symbol>): void => {
        switch (node.kind) {
            case nodeKind.VarExprNode: read(node.ident.lexeme, state); return;
            case nodeKind.AssignNode:
                // Backend evaluates the destination address before the RHS.
                address(node.left, state);
                expression(node.right, state);
                if (node.left.kind === nodeKind.VarExprNode) state.add(scope.lookUp(node.left.ident.lexeme));
                return;
            case nodeKind.AddrExprNode: address(node.lVal, state); return;
            case nodeKind.DerefExprNode: expression(node.lVal, state); return;
            case nodeKind.BinaryExprNode:
                expression(node.left, state);
                // Assignments are not value expressions in checked syntax.
                expression(node.right, new Set(state)); return;
            case nodeKind.CastExprNode:
            case nodeKind.UnaryExprNode:
            case nodeKind.SelectExprNode: expression(node.expr, state); return;
            case nodeKind.IndexExprNode:
                expression(node.expr, state);
                node.indexes.forEach(index => expression(index, state)); return;
            case nodeKind.CallFuncExprNode:
            case nodeKind.CallProcExprNode:
                // Conservatively count BYREF arguments as reads, not definite writes.
                node.args.forEach(arg => expression(arg, state)); return;
            case nodeKind.IntegerExprNode:
            case nodeKind.RealExprNode:
            case nodeKind.CharExprNode:
            case nodeKind.StringExprNode:
            case nodeKind.BoolExprNode: return;
            default: return exhaustive(node);
        }
    };
    const address = (node: Expr, state: Set<Symbol>): void => {
        if (node.kind === nodeKind.VarExprNode) return;
        if (node.kind === nodeKind.SelectExprNode) return address(node.expr, state);
        if (node.kind === nodeKind.IndexExprNode) {
            // Array values are storage; pointer views read their base pointer.
            if (node.expr.type.kind === typeKind.POINTER) expression(node.expr, state);
            else address(node.expr, state);
            node.indexes.forEach(index => expression(index, state));
            return;
        }
        if (node.kind === nodeKind.DerefExprNode) return expression(node.lVal, state);
        expression(node, state);
    };
    const join = (states: State[]): State => {
        const live = states.filter((state): state is Set<Symbol> => state !== null);
        return live.length ? new Set([...live[0]].filter(symbol => live.every(state => state.has(symbol)))) : null;
    };
    const statements = (nodes: ReadonlyArray<Stmt>, incoming: Set<Symbol>): State => {
        let state: State = new Set(incoming);
        for (const node of nodes) {
            if (state === null) break;
            switch (node.kind) {
                case nodeKind.ReturnNode: expression(node.expr, state); state = null; break;
                case nodeKind.ExprStmtNode: expression(node.expr, state); break;
                case nodeKind.OutputNode: node.exprs.forEach(expr => expression(expr, state!)); break;
                case nodeKind.InputNode:
                    address(node.expr, state);
                    if (node.expr.kind === nodeKind.VarExprNode) state.add(scope.lookUp(node.expr.ident.lexeme));
                    break;
                case nodeKind.IfNode:
                    expression(node.condition, state);
                    state = join([statements(node.body, state), statements(node.elseBody ?? [], state)]);
                    break;
                case nodeKind.CaseNode:
                    read(node.ident.lexeme, state);
                    state = join([...node.bodies.map(body => statements(body, state!)),
                    statements(node.otherwiseBody ?? [], state)]);
                    break;
                case nodeKind.WhileNode:
                    expression(node.condition, state);
                    statements(node.body, state); // possibly zero iterations
                    break;
                case nodeKind.RepeatNode:
                    state = statements(node.body, state); // at least one iteration
                    if (state) expression(node.condition, state);
                    break;
                case nodeKind.ForNode:
                    expression(node.start, state);
                    state.add(scope.lookUp(node.ident.lexeme));
                    expression(node.end, state);
                    expression(node.step, state);
                    statements(node.body, state); // induction assigned even on a zero-trip loop
                    break;
                case nodeKind.DeclNode:
                case nodeKind.TypeDeclNode:
                case nodeKind.PtrDeclNode:
                case nodeKind.FuncDefNode:
                case nodeKind.ProcDefNode: break;
                case nodeKind.ProgramNode: state = statements(node.body, state); break;
                default: exhaustive(node);
            }
        }
        return state;
    };
    statements(body, new Set(initialized));
    return unsafe;
}

function exhaustive(node: never): never {
    throw new Error(`Internal compiler error: missing definite-assignment case ${node}`);
}
