#!/bin/bash
scp /home/Piotr/Documents/scrapy2/local_backup.sql root@scrapy2.duckdns.org:/scrapy2/
ssh root@scrapy2.duckdns.org 'docker exec -i scrapy2_db_1 psql -d scrapy2 -U admin -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
ssh root@scrapy2.duckdns.org 'cat /scrapy2/local_backup.sql | sudo docker exec -i scrapy2_db_1 psql -d scrapy2 -U admin'
