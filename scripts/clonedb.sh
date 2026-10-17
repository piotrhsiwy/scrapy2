#!/bin/bash
ssh root@scrapy2.duckdns.org "docker exec -t scrapy2_db_1 pg_dump -U admin scrapy2" > /home/Piotr/Documents/scrapy2/local_backup.sql
sudo docker exec -i scrapy2-db-1 psql -d scrapy2 -U admin -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cat /home/Piotr/Documents/scrapy2/local_backup.sql | sudo docker exec -i scrapy2-db-1 psql -d scrapy2 -U admin