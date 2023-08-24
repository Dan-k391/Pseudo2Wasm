with open("bin.txt") as f1:
    bin = f1.read().split(',')
    with open("pointer.wasm", "wb") as f2:
        f2.write(bytes([int(x, 16) for x in bin]))
        f2.close()
    f1.close()
