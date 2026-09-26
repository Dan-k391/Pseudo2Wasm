#include "host.h"
static int a[1024], b[1024], c[1024];
static int kernel(int n, int seed) {
    for (int i = 0; i < n * n; ++i) {
        a[i] = (i + seed) % 97;
        b[i] = (i * 3 + seed) % 89;
    }
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j) {
            int cell = 0;
            for (int k = 0; k < n; ++k) cell += a[i * n + k] * b[k * n + j];
            c[i * n + j] = cell;
        }
    }
    int total = 0;
    for (int i = 0; i < n * n; ++i) total += c[i];
    return total;
}
void run(void) {
    int n = inputInteger();
    int seed = inputInteger();
    logInteger(kernel(n, seed));
}
