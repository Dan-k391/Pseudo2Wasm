#ifndef BENCHMARK_HOST_H
#define BENCHMARK_HOST_H
// Identical synchronous I/O boundary for all three languages.
__attribute__((import_module("env"), import_name("inputInteger")))
extern int inputInteger(void);
__attribute__((import_module("env"), import_name("logInteger")))
extern void logInteger(int value);
#endif
