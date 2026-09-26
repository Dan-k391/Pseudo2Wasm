#include "host.h"
static int distances[9216];
void run(void) {
    int n = inputInteger(), seed = inputInteger();
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j) {
            distances[i * n + j] = i == j ? 0 : (i * 17 + j * 31 + seed) % 1000 + 1;
        }
    }
    for (int k = 0; k < n; ++k) {
        for (int i = 0; i < n; ++i) {
            for (int j = 0; j < n; ++j) {
                int candidate = distances[i * n + k] + distances[k * n + j];
                if (candidate < distances[i * n + j]) distances[i * n + j] = candidate;
            }
        }
    }
    int total = 0;
    for (int i = 0; i < n * n; ++i) total += distances[i];
    logInteger(total);
}
