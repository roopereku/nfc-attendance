#!/bin/bash

DOMAIN_NAME=$1

# The domain name has to be supplied.
if [ -z "$DOMAIN_NAME" ]; then
	echo "Supply the domain name as the first argument"
	exit 1
fi

# Create necessary files and directories.
mkdir -p certbot/www
mkdir -p certbot/conf
mkdir -p nginx

# Instantiate the Nginx configuration with the given domain name.
sed template/nginx -e "s/__CONFIG_DOMAIN__/$DOMAIN_NAME/g" > nginx/nginx.conf

# Startup Nginx for certbot challenge.
docker compose up -d nginx

# Run certbot to get the certificate.
docker compose run --rm  certbot certonly --webroot --webroot-path /var/www/certbot/ -d $DOMAIN_NAME

# Shut down Nginx.
docker compose down nginx
