#include "host.h"
static int columns[12], rising[23], falling[23];
static int search(int row, int n, int shift) {
    if (row == n) return 1;
    int total = 0;
    for (int choice = 0; choice < n; ++choice) {
        int col = (choice + shift) % n;
        int up = row + col, down = row - col + n - 1;
        if (columns[col] == 0 && rising[up] == 0 && falling[down] == 0) {
            columns[col] = rising[up] = falling[down] = 1;
            total += search(row + 1, n, shift);
            columns[col] = rising[up] = falling[down] = 0;
        }
    }
    return total;
}
void run(void) {
    int n = inputInteger(), seed = inputInteger();
    for (int i = 0; i < 12; ++i) columns[i] = 0;
    for (int i = 0; i < 23; ++i) rising[i] = falling[i] = 0;
    logInteger(search(0, n, seed));
}
