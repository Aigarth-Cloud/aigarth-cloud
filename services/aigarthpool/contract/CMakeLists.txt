# AigarthPool — Qubic smart contract build.
#
# Phase 20.2 of Aigarth Cloud.
#
# This CMakeLists is the AIO toolchain entry point. It produces a
# `.qpi` artifact (the compiled QPI contract) that AIO's deploy
# tool can upload to the testnet.
#
# Build prerequisites (only needed on the testnet hardware, not for
# review / simulator-only dev):
#   - AIO Qubic Dev Kit (`ghcr.io/qubic/core-aio` or the Linux pkg)
#   - A compiler toolchain (gcc-12 / clang-15; AIO's QPI headers
#     require C++20 or later)
#   - CMake 3.22+
#
# To build when AIO is available:
#
#   docker run --rm -v $PWD:/src -w /src ghcr.io/qubic/core-aio \
#     cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \
#           -DAIGARTHPOOL_AIO_BUILD=ON \
#           -DCMAKE_PREFIX_PATH=/opt/aio
#   docker run --rm -v $PWD:/src -w /src ghcr.io/qubic/core-aio \
#     cmake --build build -j
#
# The artifact `build/AigarthPool.qpi` is uploaded via the AIO
# deploy tool (see contract.md).

cmake_minimum_required(VERSION 3.22)
project(aigarthpool_qpi LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# When AIO is present, link against the QPI runtime. When not (e.g.
# for static analysis / review), the file still compiles via the
# stub types in the header — see AIGARTHPOOL_AIO_BUILD in AigarthPool.h.
option(AIGARTHPOOL_AIO_BUILD "Build against the AIO QPI headers" OFF)

if (AIGARTHPOOL_AIO_BUILD)
    # AIO installs QPI under /opt/aio. The path is configurable.
    if (NOT CMAKE_PREFIX_PATH)
        set(CMAKE_PREFIX_PATH "/opt/aio" CACHE PATH "AIO install prefix")
    endif()
    find_package(QPI REQUIRED)
    add_compile_definitions(AIGARTHPOOL_AIO_BUILD=1)
endif()

add_library(aigarthpool_qpi STATIC
    AigarthPool.cpp
    AigarthPool.h
)

if (AIGARTHPOOL_AIO_BUILD)
    target_link_libraries(aigarthpool_qpi PRIVATE QPI::runtime)
endif()

target_include_directories(aigarthpool_qpi PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

# Optional: gtest harness for on-chain integration tests.
# Activated by AIGARTHPOOL_INTEGRATION_TESTS=ON; the test binary
# expects an AIO Core URL via the AIO_RPC_URL env var.
option(AIGARTHPOOL_INTEGRATION_TESTS "Build the on-chain gtest harness" OFF)
if (AIGARTHPOOL_INTEGRATION_TESTS)
    find_package(GTest REQUIRED)
    enable_testing()
    add_executable(aigarthpool_integration_tests
        tests/integration_tests.cpp
    )
    target_link_libraries(aigarthpool_integration_tests
        PRIVATE
            aigarthpool_qpi
            QPI::runtime
            GTest::gtest
    )
    add_test(NAME aigarthpool_integration_tests
             COMMAND aigarthpool_integration_tests)
endif()
