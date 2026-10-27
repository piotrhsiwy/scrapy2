#!/bin/bash

if [[! -f '/home/Piotr/github_scrapy2_token']]; then
    echo "Error: the token file does not exist"
fi

if [[! -f '/home/Piotr/postgres_password']]; then
    echo "Error: the password file does not exist"
fi

echo "Inserting github scrapy2 token into cloud-init.yml"
TOKEN=$(cat /home/Piotr/github_scrapy2_token)
sed "s/REPLACE_GITHUB_SCRAPY2_TOKEN/$TOKEN/g" cloud-init.yml > cloud-init_token.yml

echo "Generating postgres password"
openssl rand -base64 32 > /home/Piotr/postgres_password
PASSWORD=$(cat /home/Piotr/postgres_password)
echo "Inserting postgres password into cloud-init.yml"
sed "s/REPLACE_POSTGRES_PASSWORD/$PASSWORD/g" cloud-init_token.yml > cloud-init_token_password.yml

cat cloud-init_token_password.yml | xclip -selection clipboard
rm cloud-init_token.yml cloud-init_token_password.yml
