#!/bin/bash
# usage: batch.sh <round> <k-list> <id>...   (serial; nai_gen refuses below the floor)
cd /home/user/work/tools
rnd=$1; ks=$2; shift 2
for g in "$@"; do for k in ${ks//,/ }; do
  [ -f ../roster/$g/r$rnd-$k.png ] && continue
  python3 -I nai_gen.py gen $g $rnd $k 2>&1 | tail -1
  grep -q REFUSED ../roster/_ledger.jsonl && tail -1 ../roster/_ledger.jsonl | grep -q REFUSED && { echo STOP-FLOOR; exit 2; }
done; done
echo exit=0
