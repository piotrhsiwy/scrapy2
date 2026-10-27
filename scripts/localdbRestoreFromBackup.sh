#!/bin/bash
sudo docker exec -i scrapy2-db-1 psql -d scrapy2 -U admin -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cat /home/Piotr/Documents/scrapy2/local_backup.sql | sudo docker exec -i scrapy2-db-1 psql -d scrapy2 -U admin
