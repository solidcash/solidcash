# Build a BCHN image with the regtest-only consensus-limit options.
#
# The build context is a source tree with build artifacts and test/bench directories excluded. Use
# scripts/build-bchn-relaxed.sh, which prepares that context without touching this checkout.

FROM debian:bookworm-slim AS build

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    git \
    libboost-chrono-dev \
    libboost-filesystem-dev \
    libboost-system-dev \
    libboost-test-dev \
    libboost-thread-dev \
    libdb++-dev \
    libdb-dev \
    libevent-dev \
    libgmp-dev \
    libssl-dev \
    ninja-build \
    pkg-config \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .

RUN cmake -S . -B build -G Ninja \
      -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_BITCOIN_DAEMON=ON \
      -DBUILD_BITCOIN_CLI=ON \
      -DBUILD_BITCOIN_TX=OFF \
      -DBUILD_BITCOIN_WALLET=ON \
      -DBUILD_BITCOIN_QT=OFF \
      -DBUILD_BITCOIN_SEEDER=OFF \
      -DBUILD_BITCOIN_ZMQ=OFF \
      -DBUILD_LIBBITCOINCONSENSUS=OFF \
      -DENABLE_TEST=OFF \
      -DENABLE_MAN=OFF \
      -DENABLE_QRCODE=OFF \
      -DENABLE_NATPMP=OFF \
      -DENABLE_UPNP=OFF \
    && cmake --build build --target bitcoind bitcoin-cli -j"$(nproc)"

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libatomic1 \
    libboost-chrono1.74.0 \
    libboost-filesystem1.74.0 \
    libboost-system1.74.0 \
    libboost-thread1.74.0 \
    libdb5.3++ \
    libevent-2.1-7 \
    libevent-pthreads-2.1-7 \
    libgmp10 \
    libgmpxx4ldbl \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/build/src/bitcoind /usr/local/bin/bitcoind
COPY --from=build /src/build/src/bitcoin-cli /usr/local/bin/bitcoin-cli

EXPOSE 8332 8333 18332 18333 18443 18444
ENTRYPOINT ["bitcoind"]
