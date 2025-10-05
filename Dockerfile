FROM zenika/alpine-chrome

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 1
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser

USER root
RUN apk add --no-cache \
      tini make gcc g++ python3 git nodejs npm yarn
USER chrome

WORKDIR /app
COPY ./ /app
RUN npm install

CMD [ "npm","start" ]
ENTRYPOINT ["tini", "--"]