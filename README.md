# PDFSnap2SVG

Try the demo [here](https://penxla.github.io/pdfsnap2svg/index.html)!

## Build \& Depoly With Docker
These commands detail how to use Docker to build and deploy the PDFSnap2SVG service, offering an efficient, containerized approach suitable for rapid deployment across different environments.

```bash
git submodule update --init --recursive
docker build -t penxla/pdfsnap2svg:v1 .
docker run --name pdfsnap2svg -p 9630:9630 -d penxla/pdfsnap2svg:v1
```

## Build Manually
For those preferring or requiring a manual setup, the following commands guide you through the process. This approach is beneficial for environments where Docker is not available or desired.

```bash
apt-get update
apt-get install python3 build-essential git curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash # install nodejs
source $HOME/.nvm/nvm.sh
nvm install 20
git clone -b 3.1.55 --single-branch --depth 1 https://github.com/emscripten-core/emsdk.git /opt/emsdk
/opt/emsdk/emsdk install 3.1.55
make
```

The generated files will be in the dist/ directory. You can directly run an HTTP servaer in this directory.