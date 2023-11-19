# NFC Attendance

## Usage

### Server

Make sure that docker and docker-compose are installed.

Inside the `nfc-attendance` directory, do:

```
# Go to the server directory.
cd server

# Make the setup script executable and do setup.
# This initialized the Nginx configuration and setups an SSL certificate.
chmod +x setup.sh && ./setup.sh

# Start the docker containers in background.
docker compose up -d
```
