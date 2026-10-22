#!/usr/bin/env bash
# Upstream bridge smoke only, NOT the CPU/MMIO acceptance test.
# Caller must provide an isolated disposable Linux worker with network disabled.
set -euo pipefail
test "$(uname -s)" = Linux
test -d /evidence
test "$(git -C /workspace/gem5 rev-parse HEAD)" = b9da2bfe1e21f6efa2730edd4e80e58c5d965458
git -C /workspace/gem5 diff --exit-code
git -C /workspace/gem5 diff --cached --exit-code
test -n "${SYSTEMC_HOME:-}"
mkdir -p /evidence/B
exec > >(tee /evidence/B/commands.log) 2>&1
set -x
python3 --version
scons --version
g++ --version
cd /workspace/gem5
timeout --kill-after=10s 3600s scons -j2 build/ARM/gem5.opt
timeout --kill-after=10s 120s scons setconfig build/ARM USE_SYSTEMC=n
timeout --kill-after=10s 3600s scons -j2 --with-cxx-config --without-python --without-tcmalloc --duplicate-sources build/ARM/libgem5_opt.so
cd util/tlm
timeout --kill-after=10s 900s scons -j2
# Upstream documents this specific config generation fatal. No other failure is swallowed.
config_exit=0
timeout --kill-after=10s 120s ../../build/ARM/gem5.opt conf/tlm_slave.py > /evidence/B/config-generation.log 2>&1 || config_exit=$?
if [ "$config_exit" -ne 0 ]; then
  test "$config_exit" -ne 124
  grep -F "Can't find port handler type 'tlm_slave'" /evidence/B/config-generation.log
fi
test -s m5out/config.ini
cp m5out/config.ini /evidence/B/config.ini
timeout --kill-after=10s 120s build/examples/slave_port/gem5.sc m5out/config.ini -e 1000000 -v > /evidence/B/bridge.log 2>&1
test -s /evidence/B/bridge.log
sha256sum ../../build/ARM/gem5.opt ../../build/ARM/libgem5_opt.so build/examples/slave_port/gem5.sc /evidence/B/config.ini /evidence/B/bridge.log > /evidence/B/artifact-hashes.txt
set +x
printf '%s\n' 'Upstream demo terminated. INCONCLUSIVE: paired transaction oracle, tick/phase checks and a CPU MMIO workload remain required. This demo alone must never grant Spike B PASS.'
