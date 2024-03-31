# PDFSnap2SVG

## Build
#### Step 1
```bash
git submodule update --init --recursive
```

#### Step 2
Follow the guide in lib/mupdf.js/BUILDING.md to build the mupdf.js library.

#### Step 3
```bash
make
```
The generated files will be in the `dist/` directory. You can directly run an HTTP server in this directory.