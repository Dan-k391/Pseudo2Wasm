#include "host.h"
static int marked[8192];
static int kernel(int n, int seed) {
    int limit = n + seed % 31;
    for (int i = 0; i <= limit; ++i) marked[i] = 0;
    for (int i = 2; i * i <= limit; ++i) {
        if (marked[i] == 0) {
            for (int j = i * i; j <= limit; j += i) marked[j] = 1;
        }
    }
    int count = 0;
    for (int i = 2; i <= limit; ++i) if (marked[i] == 0) ++count;
    return count;
}
void run(void) {
    int n = inputInteger();
    int seed = inputInteger();
    logInteger(kernel(n, seed));
}
