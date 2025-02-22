FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download
COPY main.go ./
RUN go mod tidy
RUN apk add --no-cache sqlite gcc musl-dev
RUN sqlite3 colourstream.db ".databases"

ENV CGO_ENABLED=1
RUN go build -o main .

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/main .
COPY --from=builder /app/colourstream.db .

EXPOSE 8000

CMD ["./main"]
