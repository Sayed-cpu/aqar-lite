#!/usr/bin/env bash
# HTTP smoke test against a running stack (`docker compose up`), driving the
# real forms the way a browser without JavaScript would. It checks what only
# shows up on the wire: status codes, cookie flags, a revoked session being
# refused, who can open which page, and that stored markup comes back escaped.
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
# A here-string, not a pipe: grep -q exits at the first match, and a writer
# still feeding it a large page gets SIGPIPE, which pipefail reports as "not
# found". That failed a real check, and it would have passed `lacks` on a hit.
contains() { # contains <description> <haystack> <needle>
  if grep -qF -- "$3" <<<"$2"; then pass "$1"; else fail "$1"; fi
}
lacks() { # lacks <description> <haystack> <needle>
  if grep -qF -- "$3" <<<"$2"; then fail "$1"; else pass "$1"; fi
}
status() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }
page() { curl -sS -b "aqar_session=$1" "$BASE$2"; }
first_id() { # first_id <html> <section> → the first /<section>/<uuid> linked from the page
  printf '%s' "$1" | grep -o "href=\"/$2/[0-9a-f-]\{36\}\"" | head -1 | sed "s|href=\"/$2/||; s|\"||" || true
}
# Percent-encoded in bash, byte by byte, so curl's arguments stay ASCII: on
# Windows, Git Bash passes non-ASCII arguments to curl.exe through the ANSI
# code page and Arabic arrives as "?".
urlencode() {
  local LC_ALL=C string=$1 i char out=""
  for ((i = 0; i < ${#string}; i++)); do
    char=${string:i:1}
    case $char in
      [a-zA-Z0-9.~_-]) out+=$char ;;
      *)
        printf -v char '%%%02X' "'$char"
        out+=$char
        ;;
    esac
  done
  printf '%s' "$out"
}

# Read a hidden input's value out of a form.
form_field() {
  printf '%s' "$1" | grep -o "name=\"$2\"[^>]*" | sed -n 's/.*value="\([^"]*\)".*/\1/p' | sed 's/&quot;/"/g'
}

# submit_form <path> <session-token or ""> [field=value ...]
# Posts the page's useActionState form, with React's hidden fields read from
# the page; sets CODE, LOCATION and HEADERS. Values go through --form-string,
# so one starting with "<" or "@" is sent as text, not read from a file.
submit_form() {
  local path=$1 token=$2
  shift 2
  local cookie=() fields=() html ref
  if [ -n "$token" ]; then cookie=(-b "aqar_session=$token"); fi
  html=$(curl -sS "${cookie[@]}" "$BASE$path")
  ref=$(printf '%s' "$html" | grep -o 'name="\$ACTION_REF_[0-9]*"' | head -1 | sed 's/.*_\([0-9]*\)"$/\1/')
  for pair in "$@"; do fields+=(--form-string "$pair"); done
  HEADERS=$(curl -sS -o /dev/null -D - -X POST "$BASE$path" -H "Origin: $BASE" "${cookie[@]}" \
    --form-string "\$ACTION_REF_$ref=" \
    --form-string "\$ACTION_$ref:0=$(form_field "$html" "\\\$ACTION_$ref:0")" \
    --form-string "\$ACTION_$ref:1=$(form_field "$html" "\\\$ACTION_$ref:1")" \
    --form-string "\$ACTION_KEY=$(form_field "$html" '\$ACTION_KEY')" \
    "${fields[@]}" | tr -d '\r')
  CODE=$(printf '%s\n' "$HEADERS" | head -1 | cut -d' ' -f2)
  LOCATION=$(printf '%s\n' "$HEADERS" | sed -n 's/^[Ll]ocation: //p')
}

# login <email> <password> → sets CODE, TOKEN and SET_COOKIE
login() {
  submit_form /login "" "email=$1" "password=$2"
  TOKEN=$(printf '%s\n' "$HEADERS" | sed -n 's/^[Ss]et-[Cc]ookie: aqar_session=\([^;]*\);.*/\1/p')
  SET_COOKIE=$(printf '%s\n' "$HEADERS" | grep -i '^set-cookie: aqar_session=' || true)
}

echo "smoke test against $BASE"

echo "foundation"
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

echo "units"
units=$(page "$rep" /units)
contains "a sales rep sees the company's units" "$units" "أبراج الأفق"
unit_id=$(first_id "$units" units)
expect "a sales rep opens a unit" 200 "$(status -b "aqar_session=$rep" "$BASE/units/$unit_id")"
expect "a sales rep cannot open the add-unit page" 404 "$(status -b "aqar_session=$rep" "$BASE/units/new")"
expect "a sales rep cannot open the edit-unit page" 404 "$(status -b "aqar_session=$rep" "$BASE/units/$unit_id/edit")"
expect "nonsense filters fall back instead of failing" 200 \
  "$(status -b "aqar_session=$rep" "$BASE/units?status=gone&minPrice=abc&sort=1%3Bdrop&page=-3&pageSize=9999")"
expect "a malformed unit id is a 404, not a 500" 404 "$(status -b "aqar_session=$rep" "$BASE/units/not-a-uuid")"
expect "the manager opens the add-unit page" 200 "$(status -b "aqar_session=$manager" "$BASE/units/new")"
expect "the manager opens the edit-unit page" 200 "$(status -b "aqar_session=$manager" "$BASE/units/$unit_id/edit")"

echo "clients"
mine=$(page "$rep" /clients)
contains "a sales rep sees their own clients" "$mine" "محمد السالم"
lacks "a sales rep does not see another rep's clients" "$mine" "تركي المالكي"
own_client=$(first_id "$(page "$rep" "/clients?q=$(urlencode 'محمد السالم')")" clients)
expect "a sales rep opens their own client's edit page" 200 \
  "$(status -b "aqar_session=$rep" "$BASE/clients/$own_client/edit")"
seeded=$(page "$rep" "/clients/$own_client")
contains "markup in seeded notes comes back escaped" "$seeded" '&lt;script&gt;alert('
lacks "markup in seeded notes is never live" "$seeded" '<script>alert('

login rep2@ofuq.test "$PASSWORD"
rep2=$TOKEN
others_client=$(first_id "$(page "$rep2" "/clients?q=$(urlencode 'تركي')")" clients)
expect "a sales rep gets a 404 on another rep's client" 404 \
  "$(status -b "aqar_session=$rep" "$BASE/clients/$others_client")"

phone="05$(date +%s | tail -c 9)"
submit_form /clients/new "$rep" "name=Smoke Test" "phone=$phone" "notes=x" "ownerUserId=00000000-0000-0000-0000-000000000000"
expect "a smuggled ownerUserId is refused, nothing is created" 200 "$CODE"
submit_form /clients/new "$rep" "name=Smoke Test" "phone=$phone" 'notes=<img src=x onerror="alert(1)">'
expect "a sales rep adds a client" 303 "$CODE"
created=$(page "$rep" "$LOCATION")
contains "typed markup is shown escaped on the client page" "$created" '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
lacks "typed markup is never live" "$created" '<img src=x'

login accountant@ofuq.test "$PASSWORD"
accountant=$TOKEN
company_clients=$(page "$accountant" /clients)
contains "the accountant sees every rep's clients" "$company_clients" "تركي المالكي"
contains "...including the other rep's" "$company_clients" "محمد السالم"
expect "the accountant cannot open the add-client page" 404 "$(status -b "aqar_session=$accountant" "$BASE/clients/new")"
expect "the accountant cannot edit a client" 404 \
  "$(status -b "aqar_session=$accountant" "$BASE/clients/$own_client/edit")"
expect "the accountant cannot edit a unit" 404 "$(status -b "aqar_session=$accountant" "$BASE/units/$unit_id/edit")"

echo "company isolation"
login manager@madar.test "$PASSWORD"
madar=$TOKEN
lacks "another company's manager does not list these units" "$(page "$madar" /units)" "أبراج الأفق"
expect "another company's unit is a 404" 404 "$(status -b "aqar_session=$madar" "$BASE/units/$unit_id")"
expect "another company's client is a 404" 404 "$(status -b "aqar_session=$madar" "$BASE/clients/$own_client")"

echo "sign out"
logout_field=$(page "$manager" / | grep -o 'name="\$ACTION_ID_[^"]*"' | head -1 | sed 's/^name="//; s/"$//')
expect "manager signs out" 303 "$(status -X POST -b "aqar_session=$manager" -H "Origin: $BASE" -F "$logout_field=" "$BASE/")"
expect "the signed-out session is refused" 307 "$(status -b "aqar_session=$manager" "$BASE/audit")"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
