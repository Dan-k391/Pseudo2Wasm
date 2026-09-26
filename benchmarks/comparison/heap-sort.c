#include "host.h"
static int values[16384];
static void sift(int start, int finish) {
    int root = start;
    while (root * 2 + 1 <= finish) {
        int child = root * 2 + 1;
        if (child < finish) {
            if (values[child] < values[child + 1]) ++child;
        }
        if (values[root] < values[child]) {
            int temp = values[root];
            values[root] = values[child];
            values[child] = temp;
            root = child;
        } else root = finish;
    }
}
void run(void) {
    int n = inputInteger(), seed = inputInteger();
    int state = seed;
    for (int i = 0; i < n; ++i) {
        state = (state * 17 + 23) % 65521;
        values[i] = state;
    }
    for (int i = n / 2 - 1; i >= 0; --i) sift(i, n - 1);
    for (int i = n - 1; i > 0; --i) {
        int temp = values[0];
        values[0] = values[i];
        values[i] = temp;
        sift(0, i - 1);
    }
    int checksum = 0;
    for (int i = 0; i < n; ++i) checksum = (checksum * 17 + values[i]) % 65521;
    logInteger(checksum);
}
