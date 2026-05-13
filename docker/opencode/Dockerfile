FROM node:24-slim

RUN apt-get update && apt-get install -y --no-install-recommends clangd cppcheck git file iputils-ping procps ripgrep shellcheck && rm -rf /var/lib/apt/lists/*

RUN npm install --global opencode-ai@1.14.48

RUN mkdir -p /home/node/.local/share/opencode && chown -R node:node /home/node/.local
USER node
RUN git config --global core.excludesFile /home/node/.gitignore
WORKDIR /home/node

ENTRYPOINT ["opencode"]
