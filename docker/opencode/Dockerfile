FROM node:24

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl clangd clang-format cppcheck git file iputils-ping procps python3-pip ripgrep shellcheck strace traceroute chromium fonts-liberation texlive-latex-base texlive-latex-recommended && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --no-cache-dir gersemi

RUN curl -fsSL https://opencode.ai/v2/install | bash -s -- --version 2.0.32 --no-modify-path \
 && mv /root/.opencode/bin/opencode /usr/local/bin/opencode \
 && chmod 755 /usr/local/bin/opencode

# Rename the base image's node user (uid 1000) to matt and give it the same home
# as the host user. Bind mounts already arrive as uid 1000, so ownership is
# unchanged; the point is that ~/src/... resolves the same inside and out.
# /home/node is kept as a symlink so older scripts that hardcode it still work.
RUN groupmod -n matt node \
 && usermod -l matt -d /home/matt -m node \
 && rm -rf /home/node \
 && ln -s /home/matt /home/node

# Headless render helper: system Chromium + puppeteer-core (see tools/render.mjs)
COPY tools /home/matt/tools
RUN npm install --prefix /home/matt/tools --omit=dev

# Global skill so agents discover the render helper in every session
COPY skills /home/matt/.config/opencode/skills

# Global rules so every session knows the agent cannot push
COPY global-AGENTS.md /home/matt/.config/opencode/AGENTS.md

# Global plugin: no background shell commands (keeps blocking calls visible)
COPY plugin /home/matt/.config/opencode/plugin

RUN mkdir -p /home/matt/.local/share/opencode && chown -R matt:matt /home/matt/.local /home/matt/tools /home/matt/.config
ENV HOME=/home/matt
USER matt
RUN git config --global core.excludesFile /home/matt/.gitignore
WORKDIR /home/matt

ENTRYPOINT ["opencode"]
