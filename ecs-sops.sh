#!/bin/bash

mkdir -p ~/.aws/
echo "[default]" > ~/.aws/credentials

security_credentials=$(curl -s "169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI")

AWS_ACCESS_KEY_ID=$(echo "$security_credentials" | jq -r .AccessKeyId)
AWS_SECRET_ACCESS_KEY=$(echo "$security_credentials" | jq -r .SecretAccessKey)
AWS_SESSION_TOKEN=$(echo "$security_credentials" | jq -r .Token)

echo "aws_access_key_id = $AWS_ACCESS_KEY_ID" >> ~/.aws/credentials
echo "aws_secret_access_key = $AWS_SECRET_ACCESS_KEY" >> ~/.aws/credentials
echo "aws_session_token = $AWS_SESSION_TOKEN" >> ~/.aws/credentials

sops -d -i "$@"

if [ $? -eq 0 ]
then
  echo "Successfully decrypted $@"
  exit 0
else
  echo "Could not decrypt $@" >&2
  exit 1
fi