#!/bin/bash

# Start both servers
npm run dev & python app_dev.py

# Kill background processes on exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT 