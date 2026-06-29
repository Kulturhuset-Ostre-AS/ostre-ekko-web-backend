# Dev-oriented image for the test environment. Runs `payload dev` (Next dev server)
# with hot reload; source is bind-mounted by compose. For a prod image you'd do a
# multi-stage `next build` instead.
FROM node:22-bookworm-slim

WORKDIR /app

# libc/openssl bits sharp + node-gyp may want.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching. (Lockfile generated on first local install.)
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
