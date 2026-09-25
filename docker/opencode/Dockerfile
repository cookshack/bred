FROM node:24

RUN apt-get update && apt-get install -y --no-install-recommends clangd cppcheck git file iputils-ping procps ripgrep shellcheck strace traceroute chromium fonts-liberation && rm -rf /var/lib/apt/lists/*

RUN npm install --global opencode-ai@1.18.18

# Headless render helper: system Chromium + puppeteer-core (see tools/render.mjs)
COPY tools /home/node/tools
RUN npm install --prefix /home/node/tools --omit=dev

# Global skill so agents discover the render helper in every session
COPY skills /home/node/.config/opencode/skills

RUN mkdir -p /home/node/.local/share/opencode && chown -R node:node /home/node/.local /home/node/tools /home/node/.config
USER node
RUN git config --global core.excludesFile /home/node/.gitignore
WORKDIR /home/node

ENTRYPOINT ["opencode"]
