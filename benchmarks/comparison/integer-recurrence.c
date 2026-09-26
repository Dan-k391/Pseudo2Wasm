#include "host.h"
static int kernel(int n, int seed) {
    int state = seed;
    for (int i = 0; i < n; ++i) state = (state * 17 + 23) % 65521;
    return state;
}
void run(void) {
    int n = inputInteger();
    int seed = inputInteger();
    logInteger(kernel(n, seed));
}
