#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
mkdir -p /opt/opensoc/src "$root/docs/test-evidence/runtime"
exec > >(tee -a "$root/docs/test-evidence/runtime/gem5-build.log") 2>&1
if [ ! -d /opt/opensoc/src/gem5/.git ]; then
  git init /opt/opensoc/src/gem5
  git -C /opt/opensoc/src/gem5 remote add origin https://github.com/gem5/gem5.git
  git -C /opt/opensoc/src/gem5 fetch --depth 1 origin b9da2bfe1e21f6efa2730edd4e80e58c5d965458
  git -C /opt/opensoc/src/gem5 checkout --detach FETCH_HEAD
fi
cd /opt/opensoc/src/gem5
test "$(git rev-parse HEAD)" = b9da2bfe1e21f6efa2730edd4e80e58c5d965458
export PATH=/opt/opensoc/venv/bin:/usr/bin:/bin
scons -j4 build/RISCV/gem5.opt --without-tcmalloc
sha256sum build/RISCV/gem5.opt > "$root/docs/test-evidence/runtime/gem5-binary.sha256"
