int main() {
    int *a;
    int b = 7;
    a = &b;
    *a = 9;

    int c = b;
    return 0;
}