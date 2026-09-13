FROM alpine:3.20

LABEL maintainer="Gengar Dark-Web OSINT"
LABEL description="Lightweight Tor SOCKS5 proxy service for Gengar"

RUN apk add --no-cache tor curl && \
    mkdir -p /etc/tor /var/lib/tor && \
    chown -R tor:tor /var/lib/tor /etc/tor

COPY docker/tor/torrc /etc/tor/torrc
RUN chown tor:tor /etc/tor/torrc && chmod 644 /etc/tor/torrc

EXPOSE 9050

USER tor

HEALTHCHECK --interval=5s --timeout=3s --start-period=3s --retries=5 \
  CMD nc -z 127.0.0.1 9050 || exit 1

CMD ["tor", "-f", "/etc/tor/torrc"]
