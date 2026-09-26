#include <chrono>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <vector>
#include "host.h"

// Separate translation units, no /GL: the optimizer cannot hoist a kernel out
// of the timing loop or replace runtime input with a constant answer.
extern void run(void);
struct Case { int n, seed, expected; };
static Case active;
static int inputs, outputs;

static void fail(const char* message) {
    std::cerr << message << '\n';
    std::exit(1);
}

int inputInteger(void) {
    if (++inputs > 2) fail("Too many inputs");
    return inputs == 1 ? active.n : active.seed;
}

void logInteger(int value) {
    ++outputs;
    if (value != active.expected) fail("Incorrect native result");
}

static void invoke(const Case& test) {
    active = test;
    inputs = outputs = 0;
    run();
    if (inputs != 2 || outputs != 1) fail("Expected exactly two inputs and one output");
}

int main() {
    std::cout << "ready\n" << std::flush;
    std::vector<Case> cases;
    size_t sequence = 0;
    char command;
    while (std::cin >> command) {
        if (command == 'Q') return 0;
        if (command == 'I') {
            Case test;
            if (!(std::cin >> test.n >> test.seed >> test.expected)) fail("Invalid case");
            invoke(test);
            std::cout << "ok\n" << std::flush;
        } else if (command == 'C') {
            int count;
            if (!(std::cin >> count) || count < 1 || count > 1000) fail("Invalid cases");
            cases.resize(count);
            for (auto& test : cases) {
                if (!(std::cin >> test.n >> test.seed >> test.expected)) fail("Invalid case");
            }
            sequence = 0;
            std::cout << "ok\n" << std::flush;
        } else if (command == 'B') {
            int count;
            if (!(std::cin >> count) || count < 1 || count > 1048576 || cases.empty()) fail("Invalid batch");
            const auto start = std::chrono::steady_clock::now();
            for (int i = 0; i < count; ++i) invoke(cases[sequence++ % cases.size()]);
            const double ms = std::chrono::duration<double, std::milli>(
                std::chrono::steady_clock::now() - start).count();
            std::cout << std::setprecision(17) << ms << '\n' << std::flush;
        } else {
            fail("Unknown command");
        }
    }
    return 0;
}
