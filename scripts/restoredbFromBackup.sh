#!/bin/bash
sudo docker exec -i scrapy2_db_1 psql -d scrapy2 -U admin -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cat /scrapy2/local_backup.sql | sudo docker exec -i scrapy2_db_1 psql -d scrapy2 -U admin