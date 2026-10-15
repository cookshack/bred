FROM node:24

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl clangd clang-format cppcheck git file iputils-ping procps python3-pip ripgrep shellcheck strace traceroute chromium fonts-liberation && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --no-cache-dir gersemi

RUN curl -fsSL https://opencode.ai/v2/install | bash -s -- --version 2.0.32 --no-modify-path \
 && mv /root/.opencode/bin/opencode /usr/local/bin/opencode \
 && chmod 755 /usr/local/bin/opencode

# Headless render helper: system Chromium + puppeteer-core (see tools/render.mjs)
COPY tools /home/node/tools
RUN npm install --prefix /home/node/tools --omit=dev

# Global skill so agents discover the render helper in every session
COPY skills /home/node/.config/opencode/skills

# Global rules so every session knows the agent cannot push
COPY global-AGENTS.md /home/node/.config/opencode/AGENTS.md

RUN mkdir -p /home/node/.local/share/opencode && chown -R node:node /home/node/.local /home/node/tools /home/node/.config
USER node
RUN git config --global core.excludesFile /home/node/.gitignore
WORKDIR /home/node

ENTRYPOINT ["opencode"]
