#!/usr/bin/env bash
# HTTP smoke test against a running stack (`docker compose up`), driving the
# real login form the way a browser without JavaScript would. It checks what
# only shows up on the wire: status codes, cookie flags, and that a revoked
# session is refused.
#
#   scripts/smoke.sh [base-url]        default: http://localhost:3000
set -euo pipefail

BASE=${1:-http://localhost:3000}
PASSWORD='Aqar@2026!'
failures=0

pass() { echo "  ok    $1"; }
fail() { echo "  FAIL  $1"; failures=$((failures + 1)); }
expect() { # expect <description> <expected> <actual>
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected $2, got $3)"; fi
}
status() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }

# Read a hidden input's value out of the login form.
form_field() {
  printf '%s' "$1" | grep -o "name=\"$2\"[^>]*" | sed -n 's/.*value="\([^"]*\)".*/\1/p' | sed 's/&quot;/"/g'
}

# login <email> <password> → sets CODE, TOKEN and SET_COOKIE
login() {
  local page headers
  page=$(curl -sS "$BASE/login")
  headers=$(curl -sS -o /dev/null -D - -X POST "$BASE/login" -H "Origin: $BASE" \
    -F '$ACTION_REF_1=' \
    -F "\$ACTION_1:0=$(form_field "$page" '\$ACTION_1:0')" \
    -F "\$ACTION_1:1=$(form_field "$page" '\$ACTION_1:1')" \
    -F "\$ACTION_KEY=$(form_field "$page" '\$ACTION_KEY')" \
    -F "email=$1" -F "password=$2" | tr -d '\r')
  CODE=$(printf '%s\n' "$headers" | head -1 | cut -d' ' -f2)
  TOKEN=$(printf '%s\n' "$headers" | sed -n 's/^[Ss]et-[Cc]ookie: aqar_session=\([^;]*\);.*/\1/p')
  SET_COOKIE=$(printf '%s\n' "$headers" | grep -i '^set-cookie: aqar_session=' || true)
}

echo "smoke test against $BASE"

expect "health endpoint" 200 "$(status "$BASE/api/health")"
expect "a page with no session redirects" 307 "$(status "$BASE/audit")"

login manager@ofuq.test 'not-the-password'
expect "a wrong password is refused without redirecting" 200 "$CODE"
expect "a wrong password sets no session" "" "$TOKEN"

login rep1@ofuq.test "$PASSWORD"
expect "sales rep signs in" 303 "$CODE"
rep=$TOKEN
expect "sales rep gets a real 404 on the audit log" 404 "$(status -b "aqar_session=$rep" "$BASE/audit")"

login manager@ofuq.test "$PASSWORD"
expect "manager signs in" 303 "$CODE"
manager=$TOKEN
for flag in HttpOnly Secure 'SameSite=lax'; do
  if printf '%s' "$SET_COOKIE" | grep -qi "$flag"; then pass "session cookie is $flag"; else fail "session cookie lacks $flag"; fi
done
expect "manager opens the audit log" 200 "$(status -b "aqar_session=$manager" "$BASE/audit")"

logout_field=$(curl -sS -b "aqar_session=$manager" "$BASE/" | grep -o 'name="\$ACTION_ID_[^"]*"' | head -1 | sed 's/^name="//; s/"$//')
expect "manager signs out" 303 "$(status -X POST -b "aqar_session=$manager" -H "Origin: $BASE" -F "$logout_field=" "$BASE/")"
expect "the signed-out session is refused" 307 "$(status -b "aqar_session=$manager" "$BASE/audit")"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
