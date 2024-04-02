FROM ubuntu:22.04 as build
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    git \
    curl

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && \
    . $HOME/.nvm/nvm.sh && \
    nvm install 20

RUN git clone -b 3.1.55 --single-branch --depth 1 https://github.com/emscripten-core/emsdk.git /opt/emsdk && \
    /opt/emsdk/emsdk install 3.1.55

COPY . /app
WORKDIR /app

RUN make -j

# =======================
FROM python as runtime
WORKDIR /app
COPY --from=build /app/dist /app/dist

CMD ["python3", "-m", "http.server", "9630", "--directory", "/app/dist"]



