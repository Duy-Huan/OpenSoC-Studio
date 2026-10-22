#!/usr/bin/env bash
# Feasibility harness only. Caller MUST provide a disposable, isolated Linux worker.
# This script is NOT a sandbox and must not be used for arbitrary imported RTL.
set -euo pipefail
test "$(uname -s)" = Linux
test -d /evidence
test "$(git -C /workspace/ibex rev-parse HEAD)" = 1b29dae8866e6c0f0a3cd9dead53a77b4f45e357
git -C /workspace/ibex diff --exit-code
git -C /workspace/ibex diff --cached --exit-code
mkdir -p /evidence/A/runtime
exec > >(tee /evidence/A/commands.log) 2>&1
set -x
export XDG_CACHE_HOME=/workspace/cache
python3 --version
verilator --version
fusesoc --version
riscv32-unknown-elf-gcc --version
cd /workspace/ibex
git submodule status --recursive > /evidence/A/submodules.txt
read -r -a config_opts <<< "$(python3 util/ibex_config.py small fusesoc_opts)"
timeout --kill-after=10s 1800s fusesoc --cores-root=. run --target=sim --setup --build lowrisc:ibex:ibex_simple_system "${config_opts[@]}"
timeout --kill-after=10s 180s make -C examples/sw/simple_system/hello_test
sim=/workspace/ibex/build/lowrisc_ibex_ibex_simple_system_0/sim-verilator/Vibex_simple_system
elf=/workspace/ibex/examples/sw/simple_system/hello_test/hello_test.elf
test -x "$sim"
test -s "$elf"
sha256sum "$sim" "$elf" > /evidence/A/binary-hashes.txt
cp "$elf" /evidence/A/hello_test.elf
cd /evidence/A/runtime
timeout --kill-after=10s 120s "$sim" -t "--meminit=ram,$elf"
test -s ibex_simple_system.log
test -s trace_core_00000000.log
grep -F 'Hello simple system' ibex_simple_system.log
grep -iF 'deadbeef' ibex_simple_system.log
grep -iF 'baadf00d' ibex_simple_system.log
find . -type f -name '*.fst' -size +0c -print > /evidence/A/waveform-files.txt
test -s /evidence/A/waveform-files.txt
find . -type f -exec sha256sum '{}' + > /evidence/A/artifact-hashes.txt
set +x
printf '%s\n' 'Hardware output checks completed. Full Spike A remains INCONCLUSIVE until FST parser/selection UI checks and toolchain/license manifest are verified.'
