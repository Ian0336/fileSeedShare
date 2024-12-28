#!/bin/bash

# 停止並移除所有服務
docker compose down

# 移除由 docker-compose.yml 生成的所有映像檔
docker images | grep -E "(fileseedshare)" | awk '{print $3}' | xargs docker rmi -f

# 移除由 docker-compose.yml 生成的所有卷
docker volume ls | grep -E "(fileseedshare_db_data|fileseedshare_shared_data)" | awk '{print $2}' | xargs docker volume rm -f

# 重建並啟動所有服務
# docker compose up --build
