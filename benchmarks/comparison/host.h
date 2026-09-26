#ifndef BENCHMARK_HOST_H
#define BENCHMARK_HOST_H
// Identical logical I/O; native calls do not cross a JS/Wasm boundary.
#ifdef _MSC_VER
extern int inputInteger(void);
extern void logInteger(int value);
#else
__attribute__((import_module("env"), import_name("inputInteger")))
extern int inputInteger(void);
__attribute__((import_module("env"), import_name("logInteger")))
extern void logInteger(int value);
#endif
#endif
