#include "host.h"
static int fib(int n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}
void run(void) {
    int n = inputInteger();
    int seed = inputInteger();
    logInteger(fib(n + seed % 3));
}
