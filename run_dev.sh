#!/bin/bash

rm -rf dist

if ! npm run build; then
  exit 1
fi

# Start both servers
npm run dev & python run_dev.py

# Kill background processes on exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT 