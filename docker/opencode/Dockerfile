FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends git file && rm -rf /var/lib/apt/lists/*

RUN npm install --global opencode-ai@1.14.34

RUN mkdir -p /home/node/.local/share/opencode && chown -R node:node /home/node/.local
USER node
WORKDIR /home/node

ENTRYPOINT ["opencode"]
