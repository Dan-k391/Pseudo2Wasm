import binaryen from "binaryen";

type ExpressionRef = binaryen.ExpressionRef;

export interface String {
    offset: ExpressionRef;
    value: string;
};
