#!/bin/bash
docker exec -i scrapy2_db_1 pg_dump -U admin -d scrapy2 -t bets