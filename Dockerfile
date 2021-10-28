FROM node:8.16-jessie

RUN apt-get update && \
    apt-get -y install python2.7 python-pip build-essential curl jq python2.7-dev

RUN pip install --upgrade awscli==1.14.5

ADD https://github.com/mozilla/sops/releases/download/v3.6.1/sops-v3.6.1.linux /usr/bin/sops
RUN chmod 0755 /usr/bin/sops

ADD wait-for-it.sh /
ADD ecs-sops.sh /usr/bin/ecs-sops.sh

RUN chmod 0755 /usr/bin/sops
RUN chmod 0755 /wait-for-it.sh
RUN chmod 0755 /usr/bin/ecs-sops.sh

ARG NPM_TOKEN
ENV NPM_TOKEN=$NPM_TOKEN

ARG ENVIRONMENT
ENV ENVIRONMENT=$ENVIRONMENT

WORKDIR /usr/src/app

COPY .npmrc ./
COPY package*.json ./

RUN npm install --production --no-optional
RUN rm -f .npmrc
COPY . .

CMD [ "node", "app.js" ]
