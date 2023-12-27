FROM oven/bun:1-debian

EXPOSE 80

# Set the working directory for the app
WORKDIR /app

# Copy only the dependency file and install dependencies
COPY package.json bun.lockb ./ 

RUN apt update -y && apt upgrade -y && apt install procps brotli -y
RUN bun install

# Copy the rest of the application
COPY src/ ./src/

RUN bun install

CMD ["sh", "-c", "PORT=80 bun start"]