#!/bin/bash

echo "Installing $1"

PEM_FILE_NAME=$1
hash=$(openssl x509 -inform PEM -subject_hash_old -in $PEM_FILE_NAME | head -1)
OUT_FILE_NAME="$hash.0"

cp $PEM_FILE_NAME $OUT_FILE_NAME
openssl x509 -inform PEM -text -in $PEM_FILE_NAME -out /dev/null >> $OUT_FILE_NAME

#adb push $OUT_FILE_NAME /sdcard/
adb push $1 /sdcard/

rm $OUT_FILE_NAME
