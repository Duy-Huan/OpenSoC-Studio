#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
exec > >(tee "$root/docs/test-evidence/runtime/ibex-build.log") 2>&1
export PATH=/opt/opensoc/venv/bin:/usr/bin:/bin
cd /opt/opensoc/src/ibex
test "$(git rev-parse HEAD)" = 1b29dae8866e6c0f0a3cd9dead53a77b4f45e357
pip install fusesoc==2.4.3 mako packaging junit-xml pathlib3x typing-utils 'typeguard~=2.13' portalocker svg.py
read -r -a config_opts <<< "$(python util/ibex_config.py small fusesoc_opts)"
fusesoc --cores-root=. run --target=sim --setup --build lowrisc:ibex:ibex_simple_system "${config_opts[@]}"
make -C examples/sw/simple_system/hello_test CC=riscv64-unknown-elf-gcc ARCH=rv32imc_zicsr_zifencei
pip freeze > "$root/docs/test-evidence/runtime/linux-python.freeze.txt"
