#!/bin/bash
TOKEN=$(cat /home/Piotr/github_scrapy2_token)
sed "s/REPLACE/$TOKEN/g" cloud-init.yml > cloud-init_token.yml
cat cloud-init_token.yml | xclip -selection clipboard
rm cloud-init_token.yml
