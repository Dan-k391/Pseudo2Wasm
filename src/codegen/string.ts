import binaryen from "binaryen";

type ExpressionRef = binaryen.ExpressionRef;

export interface String {
    ptr: ExpressionRef;
    value: string;
};
