#!/bin/bash -e
DIR=`dirname "$(readlink -f "$0")"`
cd ${DIR}/..

tmux new-session -s houmio-nexa-bridge -d
tmux new-window -t houmio-nexa-bridge:1 -n run-houmio-nexa-bridge
tmux send-keys -t houmio-nexa-bridge:1 "node app.js" Enter
#tmux attach -t houmio-nexa-bridge
