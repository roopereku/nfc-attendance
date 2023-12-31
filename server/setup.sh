#!/bin/bash

DOMAIN_NAME=$1

# The domain name has to be supplied.
if [ -z "$DOMAIN_NAME" ]; then
	echo "Supply the domain name as the first argument"
	exit 1
fi

# Check if docker is in PATH.
if ! command -v docker &> /dev/null
then
	echo "Docker cannot be located?"

	# Ask the user whether they want to install it through a script.
	read -p "Install docker through the install script? [y/n] " -n 1 -r
	echo
	if [[ $REPLY =~ ^[Yy]$ ]]
	then
		echo "Installing docker through the install script."
		curl -fsSL https://get.docker.com -o get-docker.sh
		sudo sh get-docker.sh
	fi
fi

# Create necessary files and directories.
mkdir -p certbot/www
mkdir -p certbot/conf
mkdir -p postgres
mkdir -p nginx

# Instantiate the Nginx pre-ssl configuration with the given domain name.
sed template/nginx_pre_ssl.conf -e "s/__CONFIG_DOMAIN__/$DOMAIN_NAME/g" > nginx/nginx.conf

# TODO: Make sure that the user is in docker group.

# Startup Nginx for certbot challenge.
docker compose up -d nginx

# Run certbot to get the certificate.
docker compose run --rm  certbot certonly --webroot --webroot-path /var/www/certbot/ -d $DOMAIN_NAME

# Shut down Nginx.
docker compose down nginx

# Run postgres once to make sure that it creates whatever metadata it needs.
# Not doing so might lead to a delay in the database that Node doesn't like.
docker compose up -d postgres
docker compose down postgres 

# Instantiate the Nginx configuration with the given domain name.
sed template/nginx.conf -e "s/__CONFIG_DOMAIN__/$DOMAIN_NAME/g" > nginx/nginx.conf
