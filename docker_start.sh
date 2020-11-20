#!/bin/bash

set -e
export MSYS_NO_PATHCONV=1

echo "1.启动服务器"
docker-compose -f docker-compose.yml up -d dsd100
echo "2.系统进程列表"
echo "`docker ps`"
