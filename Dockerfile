# syntax=docker/dockerfile:1

FROM resinci/jellyfish-test:v1.4.16
RUN npm i -g npm@6

WORKDIR /usr/src/jellyfish

COPY package.json .npmrc ./
RUN npm install

COPY . ./

CMD /bin/bash -c "task test"
