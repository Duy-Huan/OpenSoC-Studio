#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p docs/test-evidence/runtime
exec > >(tee docs/test-evidence/runtime/linux-setup.log) 2>&1
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends build-essential python3-dev python3-venv scons m4 zlib1g-dev libprotobuf-dev protobuf-compiler libboost-dev libboost-regex-dev pkg-config libsystemc-dev verilator iverilog yosys gcc-riscv64-unknown-elf binutils-riscv64-unknown-elf cmake ninja-build git curl ca-certificates bubblewrap libpng-dev libhdf5-dev libelf-dev srecord
id opensoc >/dev/null 2>&1 || useradd -m -s /bin/bash opensoc
mkdir -p /opt/opensoc
python3 -m venv /opt/opensoc/venv
/opt/opensoc/venv/bin/pip install pywellen==0.25.7 fusesoc==2.4.3 edalize==0.6.8
/opt/opensoc/venv/bin/pip freeze > docs/test-evidence/runtime/linux-python.freeze.txt
dpkg-query -W -f='${Package}\t${Version}\n' > docs/test-evidence/runtime/linux-packages.tsv
chown -R opensoc:opensoc /opt/opensoc
uname -a
free -h
verilator --version
riscv64-unknown-elf-gcc --version
pkg-config --modversion systemc
echo 'Linux preparation complete. Build/simulate as opensoc, not root.'
