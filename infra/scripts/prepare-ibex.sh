#!/usr/bin/env bash
set -euo pipefail
mkdir -p /opt/opensoc/src
if [ ! -d /opt/opensoc/src/ibex/.git ]; then
  git init /opt/opensoc/src/ibex
  git -C /opt/opensoc/src/ibex remote add origin https://github.com/lowRISC/ibex.git
  git -C /opt/opensoc/src/ibex fetch --depth 1 origin 1b29dae8866e6c0f0a3cd9dead53a77b4f45e357
  git -C /opt/opensoc/src/ibex checkout --detach FETCH_HEAD
fi
cd /opt/opensoc/src/ibex
cat examples/simple_system/README.md
cat examples/sw/simple_system/common/common.mk
