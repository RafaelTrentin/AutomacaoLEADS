FROM node:20-bullseye

# Chrome
RUN apt-get update && apt-get install -y wget gnupg ca-certificates fonts-liberation \
    libasound2 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libcups2 libdbus-1-3 \
    libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
    xdg-utils unzip && \
    wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /usr/share/keyrings/googlechrome.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# ...
WORKDIR /app

# Copia package.json e (se existir) o lockfile
COPY package.json package-lock.json* ./

# Instala dependências (sem dev)
RUN npm install --omit=dev --no-audit --no-fund

# Agora copia o resto do projeto
COPY . .

ENV CHROME_PATH=/usr/bin/google-chrome
ENV PORT=3333
EXPOSE 3333

CMD ["npm","start"]
