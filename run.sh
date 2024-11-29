#!/bin/bash

rm -rf dist

if ! npm run build; then
  exit 1
fi

python app.py