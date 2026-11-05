#!/usr/bin/env bash
# shellcheck disable=SC2319 # each check passes the status of its own test on purpose
# Runs the edge image against a stub upstream named nginx and checks the routing per host name.
# Usage: bash deploy/tests/edge-test.sh   (needs docker and openssl)
set -uo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
net=subs-edge-test
failures=0
cleanup() { docker rm -f subs-edge-test-edge subs-edge-test-nginx > /dev/null 2>&1; docker network rm "$net" > /dev/null 2>&1; rm -rf "$work"; }
trap cleanup EXIT
check() { if [[ "$2" == 0 ]]; then echo "PASS  $1"; else echo "FAIL  $1 ${3:-}"; failures=$((failures + 1)); fi; }

docker build -q -f "$repo/docker/prod/edge.Dockerfile" -t subs-edge:test "$repo" > /dev/null || { echo "FAIL  image build"; exit 1; }
mkdir -p "$work/certs" "$work/extra" "$work/stub"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=unsab.com" -addext "subjectAltName=DNS:unsab.com,DNS:*.unsab.com" \
  -keyout "$work/certs/origin.key" -out "$work/certs/origin.pem" 2> /dev/null
echo "trusted_proxies static private_ranges" > "$work/extra/cloudflare-ips.caddy"
docker network create "$net" > /dev/null
# Stub upstream: answers "proxied <path>" so a 404 from Caddy and a reply from nginx can be told apart.
printf ':80 {\n\trespond "proxied {path}"\n}\n' > "$work/stub/Caddyfile"
docker run -d --name subs-edge-test-nginx --network "$net" --network-alias nginx \
  -v "$work/stub/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine > /dev/null
docker run -d --name subs-edge-test-edge --network "$net" -p 127.0.0.1:18443:443 \
  -v "$work/certs:/etc/caddy/certs:ro" -v "$work/extra:/etc/caddy/extra:ro" subs-edge:test > /dev/null
for _ in $(seq 1 30); do curl -sk -o /dev/null --resolve unsab.com:18443:127.0.0.1 https://unsab.com:18443/ && break; sleep 1; done

req() { # req <host> <path> → "<status> <body>"
  curl -sk --resolve "$1:18443:127.0.0.1" -o "$work/body" -w '%{http_code}' "https://$1:18443$2"; printf ' '; head -c 200 "$work/body"
}

check "landing page" "$([[ $(req unsab.com /) == "200 "*Unsab* ]]; echo $?)" "($(req unsab.com /))"
redirect="$(curl -sk --resolve www.unsab.com:18443:127.0.0.1 -o /dev/null -w '%{http_code} %{redirect_url}' https://www.unsab.com:18443/x)"
check "www redirects" "$(grep -q '^301 https://unsab.com/x' <<< "$redirect"; echo $?)" "($redirect)"
check "api proxied" "$([[ $(req api.unsab.com /up) == "200 proxied /up" ]]; echo $?)" "($(req api.unsab.com /up))"
check "api hides horizon" "$([[ $(req api.unsab.com /horizon) == 404* ]]; echo $?)"
check "api hides horizon subpaths" "$([[ $(req api.unsab.com /horizon/api/stats) == 404* ]]; echo $?)"
check "api hides admin api" "$([[ $(req api.unsab.com /api/admin/v1/x) == 404* ]]; echo $?)"
check "admin proxies horizon" "$([[ $(req admin.unsab.com /horizon) == "200 proxied /horizon" ]]; echo $?)"
check "admin placeholder" "$([[ $(req admin.unsab.com /anything) == "200 "*"coming soon"* ]]; echo $?)"
headers="$(curl -sk -D - -o /dev/null --resolve admin.unsab.com:18443:127.0.0.1 https://admin.unsab.com:18443/)"
check "admin frame header" "$(grep -qi '^x-frame-options: DENY' <<< "$headers"; echo $?)"

echo
if [[ $failures == 0 ]]; then echo "ALL PASS"; else echo "$failures FAILED"; exit 1; fi
