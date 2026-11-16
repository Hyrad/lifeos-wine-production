#!/usr/bin/env python3
"""Owner-private Wine: Unix socket only, fixed read-only Notion source, no public mode."""
import argparse
from contextlib import ExitStack
from dataclasses import dataclass
import datetime as dt
import http.client
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import re
import select
import socket
import socketserver
import stat
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import quote, urlencode, urlsplit, unquote

API_PATH = '/api/v1/wine-supplies'
APP_PATH = '/lifeos-wine-production/'
NOTION_VERSION = '2026-03-11'
CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"


class Failure(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code
        super().__init__(code)


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def future(value):
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')) > dt.datetime.now(dt.timezone.utc)
    except (ValueError, TypeError, AttributeError):
        return False


def protected_file(path):
    p = Path(path)
    s = p.lstat()
    if not stat.S_ISREG(s.st_mode) or s.st_uid != os.getuid() or s.st_mode & 0o077:
        raise ValueError('Unsafe protected file')
    return p.read_text().strip()


def load_policy(path, allow_expired=False):
    p = json.loads(protected_file(path))
    required = {'origin', 'owner_login', 'device_ids', 'source_page', 'source_parent', 'authorization_expires_at'}
    if set(p) != required:
        raise ValueError('Incomplete policy')
    u = urlsplit(p['origin'])
    if u.scheme != 'https' or not u.hostname or not u.hostname.endswith('.ts.net') or u.path or u.query or u.fragment or u.username or u.password:
        raise ValueError('Invalid private origin')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+', p['owner_login']) or p['owner_login'] != p['owner_login'].lower():
        raise ValueError('Invalid owner')
    if not isinstance(p['device_ids'], list) or not p['device_ids'] or any(not re.fullmatch(r'n[A-Za-z0-9]+', v) for v in p['device_ids']):
        raise ValueError('Explicit device allowlist required')
    for k in ('source_page', 'source_parent'):
        if not re.fullmatch(r'[a-f0-9]{32}', p[k]):
            raise ValueError('Invalid source pin')
    if not allow_expired and not future(p['authorization_expires_at']):
        raise ValueError('Authorization expired')
    return p


def visible_root_id(kind):
    """Host root may be unmapped in systemd's per-user filesystem sandbox."""
    rows = Path('/proc/self/' + kind + '_map').read_text().splitlines()
    if not rows or len(rows) > 340:
        raise ValueError('Missing namespace evidence')
    for row in rows:
        inside, outside, length = map(int, row.split())
        if inside < 0 or outside < 0 or length <= 0:
            raise ValueError('Invalid namespace evidence')
        if outside == 0:
            return inside
    return int(Path('/proc/sys/kernel/overflow' + kind).read_text())


def pinned_localapi_socket():
    """Walk a fixed root-controlled path without symlinks, then dial its inode."""
    sock = None
    try:
        root_uid = visible_root_id('uid')
        flags = os.O_PATH | os.O_NOFOLLOW | os.O_CLOEXEC
        with ExitStack() as files:
            fd = os.open('/', flags | os.O_DIRECTORY)
            files.callback(os.close, fd)
            for component in (None, 'run', 'tailscale'):
                if component is not None:
                    fd = os.open(component, flags | os.O_DIRECTORY, dir_fd=fd)
                    files.callback(os.close, fd)
                meta = os.fstat(fd)
                if not stat.S_ISDIR(meta.st_mode) or meta.st_uid != root_uid or meta.st_mode & 0o022:
                    raise ValueError('Untrusted LocalAPI directory')
            fd = os.open('tailscaled.sock', flags, dir_fd=fd)
            files.callback(os.close, fd)
            meta = os.fstat(fd)
            if not stat.S_ISSOCK(meta.st_mode) or meta.st_uid != root_uid:
                raise ValueError('Untrusted LocalAPI socket')
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.settimeout(1)
            sock.connect('/proc/self/fd/' + str(fd))
        return sock
    except Exception:
        if sock is not None:
            sock.close()
        raise Failure(403, 'forbidden') from None


@dataclass(frozen=True)
class KernelPeer:
    credentials: tuple
    pidfd: int

    def check_live(self):
        pid, uid, gid = self.credentials
        if pid <= 0 or uid < 0 or gid < 0:
            raise ValueError('Invalid peer credentials')
        # A numeric PID alone can be reused. This handle comes from the socket,
        # not pidfd_open(PID), and remains tied to its original peer process.
        info = Path('/proc/self/fdinfo/' + str(self.pidfd)).read_text()
        lines = [line for line in info.splitlines() if line.startswith('Pid:')]
        if len(lines) != 1 or int(lines[0].split(':', 1)[1]) != pid:
            raise ValueError('Missing peer process evidence')
        poll = select.poll()
        poll.register(self.pidfd, select.POLLIN | select.POLLHUP | select.POLLERR)
        if poll.poll(0):
            raise ValueError('Peer process exited')


def kernel_peer(sock, resources):
    raw = sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize('3i'))
    credentials = struct.unpack('3i', raw)
    # Linux UAPI SO_PEERPIDFD=77; older Python builds do not name it. Unsupported
    # kernels fail closed. Never fall back to UID, comm, or a numeric PID lookup.
    fd = sock.getsockopt(socket.SOL_SOCKET, getattr(socket, 'SO_PEERPIDFD', 77))
    resources.callback(os.close, fd)
    os.set_inheritable(fd, False)
    peer = KernelPeer(credentials, fd)
    peer.check_live()
    return peer


class VerifiedProxy:
    """Per-request proof bound to the daemon on the protected LocalAPI inode."""
    def __init__(self, incoming):
        self.incoming_socket = incoming
        self.resources = ExitStack()
        self.incoming = self.daemon = self.conn = None
        self.closed = True

    def __enter__(self):
        try:
            self.closed = False
            self.incoming = kernel_peer(self.incoming_socket, self.resources)
            self.conn = http.client.HTTPConnection('local-tailscaled.sock', timeout=1)
            self.resources.callback(self.conn.close)
            self.conn.auto_open = 0  # Never reconnect to an unverified endpoint.
            self.conn.sock = pinned_localapi_socket()
            self.daemon = kernel_peer(self.conn.sock, self.resources)
            self.check_live()
            return self
        except Exception:
            self.closed = True
            self.resources.close()
            raise Failure(403, 'forbidden') from None

    def __exit__(self, *args):
        self.closed = True
        self.resources.close()

    def check_live(self):
        try:
            if self.closed:
                raise ValueError('Closed proxy proof')
            self.incoming.check_live()
            self.daemon.check_live()
            if self.incoming.credentials != self.daemon.credentials:
                raise ValueError('Proxy process mismatch')
        except Exception:
            raise Failure(403, 'forbidden') from None

    def whois(self, address):
        try:
            self.check_live()
            self.conn.request('GET', '/localapi/v0/whois?addr=' + quote(address, safe=''), headers={'Host': 'local-tailscaled.sock'})
            r = self.conn.getresponse()
            raw = r.read(131073)
            if r.status != 200 or len(raw) > 131072:
                raise ValueError('Whois unavailable')
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise ValueError('Invalid whois')
            self.check_live()
            return result
        except Exception:
            raise Failure(403, 'forbidden') from None


def authorize(headers, policy, method, path, whois):
    # Kernel proxy authentication occurs before this application/identity gate.
    if not future(policy['authorization_expires_at']):
        raise Failure(403, 'forbidden')
    critical = ['host', 'tailscale-user-login', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'origin', 'sec-fetch-site', 'x-lifeos-client']
    if any(len(headers.get_all(k) or []) > 1 for k in critical):
        raise Failure(403, 'forbidden')
    h = {k.lower(): v for k, v in headers.items()}
    login = h.get('tailscale-user-login', '')
    if not login:
        raise Failure(401, 'authentication_required')
    if any(c.isspace() for c in login) or not login.isascii() or len(login) > 254 or login.lower() != policy['owner_login']:
        raise Failure(403, 'forbidden')
    if any('funnel' in k for k in h):
        raise Failure(403, 'forbidden')
    origin = policy['origin']
    host = urlsplit(origin).netloc
    if h.get('host') != 'localhost' or h.get('x-forwarded-host') != host or h.get('x-forwarded-proto') != 'https':
        raise Failure(403, 'forbidden')
    if h.get('origin') not in (None, origin) or h.get('sec-fetch-site') not in (None, 'none', 'same-origin'):
        raise Failure(403, 'forbidden')
    if path == API_PATH and (h.get('x-lifeos-client') != 'wine-private' or h.get('sec-fetch-site') != 'same-origin'):
        raise Failure(403, 'forbidden')
    try:
        address = str(ipaddress.ip_address(h.get('x-forwarded-for', '')))
        w = whois(address)
        n, user = w['Node'], w['UserProfile']
        if user.get('LoginName', '').lower() != login.lower() or n.get('StableID') not in policy['device_ids'] or n.get('Tags') or n.get('MachineAuthorized') is not True or not future(n.get('KeyExpiry')):
            raise ValueError('Unauthorized node')
        if type(n.get('User')) is not int or n['User'] <= 0 or type(user.get('ID')) is not int or n['User'] != user['ID']:
            raise ValueError('Owner mismatch')
        # Addresses are node host prefixes, never subnet routes or AllowedIPs.
        addresses = [ipaddress.ip_network(a, strict=True) for a in n.get('Addresses', [])]
        if not any(a.prefixlen == a.max_prefixlen and ipaddress.ip_address(address) == a.network_address for a in addresses):
            raise ValueError('Address mismatch')
    except Exception:
        raise Failure(403, 'forbidden') from None
    if method not in ('GET', 'HEAD'):
        raise Failure(405, 'method_not_allowed')
    return n['StableID']


def clean(text):
    if not isinstance(text, str) or len(text) > 8000:
        raise Failure(502, 'source_invalid')
    text = re.sub(r'https?://[^\s<>]+|www\.[^\s<>]+', '[link omitted]', text, flags=re.I)
    text = re.sub(r'\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b|\b[a-f0-9]{32}\b|(?:ntn_|secret_|ghp_|github_pat_)[A-Za-z0-9_]+', '[reference omitted]', text, flags=re.I)
    text = re.sub(r'<[^>]*>', '', text)
    text = ''.join(c if c.isprintable() else ' ' for c in text)
    return re.sub(r'\s+', ' ', text).strip()


def rich_text(parts):
    if not isinstance(parts, list) or len(parts) > 200:
        raise Failure(502, 'source_invalid')
    out = []
    for p in parts:
        if not isinstance(p, dict):
            raise Failure(502, 'source_invalid')
        value = p.get('plain_text')
        if value is None and p.get('type') == 'text':
            value = (p.get('text') or {}).get('content')
        if not isinstance(value, str):
            raise Failure(502, 'source_invalid')
        out.append(value)
    return clean(''.join(out))


AMOUNT = re.compile(r'(?P<approx>(?:environ|approximately|approx\.?|about|~|≈)\s*)?(?P<qty>\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?)\s*(?P<unit>kg|kilogrammes?|g|grammes?|ml|millilitres?|l|litres?|bouteilles?|bottles?|paquets?|packs?|unités?|units?|sachets?)\b', re.I)


def item_fields(text):
    if not text:
        raise Failure(502, 'source_invalid')
    pieces = re.split(r'\s+[—–]\s+|:\s*', text, maxsplit=1)
    name = pieces[0].strip()
    rest = pieces[1] if len(pieces) > 1 else text
    amount = AMOUNT.search(rest)
    qty = ((amount['approx'] or '') + amount['qty']).strip() if amount else ''
    unit = amount['unit'] if amount else ''
    condition = bool(re.search(r'\b(?:conditionnel(?:le)?|conditional|if|si)\b', text, re.I))
    review = not amount or len(pieces) == 1 or bool(re.search(r'\b(?:à confirmer|a confirmer|to confirm)\b', text, re.I))
    return {'name': name[:240], 'quantity': qty, 'unit': unit, 'purpose': rest,
            'classification': 'conditional' if condition else 'review' if review else 'confirmed',
            'condition': rest if condition else ''}


class NotionReader:
    def __init__(self, token, page, parent, transport=None):
        self.token, self.page, self.parent = token, page, parent
        self.transport = transport
        self.lock = threading.Lock()
        self.last_request = 0.0

    def _get(self, path, deadline):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise Failure(504, 'upstream_timeout')
        if self.transport:
            return self.transport(path)
        # HTTPSConnection avoids environment proxies and redirects; only this fixed host.
        wait = 0.36 - (time.monotonic() - self.last_request)
        if wait > 0:
            time.sleep(min(wait, remaining))
        self.last_request = time.monotonic()
        conn = http.client.HTTPSConnection('api.notion.com', timeout=min(4, max(0.1, deadline - time.monotonic())))
        try:
            conn.request('GET', '/v1/' + path, headers={'Authorization': 'Bearer ' + self.token, 'Notion-Version': NOTION_VERSION, 'Accept': 'application/json'})
            r = conn.getresponse()
            chunks, size = [], 0
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise Failure(504, 'upstream_timeout')
                if conn.sock is not None:
                    conn.sock.settimeout(min(4, remaining))
                chunk = r.read1(min(65536, 524289 - size))
                if not chunk:
                    break
                chunks.append(chunk)
                size += len(chunk)
                if size > 524288:
                    raise Failure(502, 'source_limit')
            raw = b''.join(chunks)
            if r.status in (401, 403, 404):
                raise Failure(503, 'source_access_unavailable')
            if r.status == 429:
                raise Failure(503, 'upstream_busy')
            if r.status != 200:
                raise Failure(502, 'upstream_unavailable')
            if len(raw) > 524288:
                raise Failure(502, 'source_limit')
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise Failure(502, 'source_invalid')
            return result
        except (TimeoutError, socket.timeout):
            raise Failure(504, 'upstream_timeout') from None
        except Failure:
            raise
        except Exception:
            raise Failure(502, 'upstream_unavailable') from None
        finally:
            conn.close()

    def read(self):
        if not self.lock.acquire(blocking=False):
            raise Failure(429, 'refresh_busy')
        try:
            return self._read()
        finally:
            self.lock.release()

    def _read(self):
        deadline = time.monotonic() + 12
        page = self._get('pages/' + self.page, deadline)
        parent = page.get('parent') or {}
        parent_id = parent.get(parent.get('type', ''), '')
        if str(page.get('id', '')).replace('-', '') != self.page or str(parent_id).replace('-', '') != self.parent or page.get('archived') or page.get('in_trash'):
            raise Failure(502, 'source_boundary')
        budget = {'pages': 0, 'blocks': 0}

        def children(block_id, depth=0):
            if not isinstance(block_id, str) or not re.fullmatch(r'[a-f0-9-]{32,36}', block_id):
                raise Failure(502, 'source_invalid')
            if depth > 3:
                raise Failure(502, 'source_limit')
            cursor, seen = None, set()
            while True:
                budget['pages'] += 1
                if budget['pages'] > 16:
                    raise Failure(502, 'source_limit')
                query = urlencode({'page_size': 100, **({'start_cursor': cursor} if cursor else {})})
                data = self._get('blocks/' + block_id + '/children?' + query, deadline)
                if not isinstance(data.get('results'), list) or type(data.get('has_more')) is not bool:
                    raise Failure(502, 'source_invalid')
                for b in data['results']:
                    budget['blocks'] += 1
                    if budget['blocks'] > 1000 or not isinstance(b, dict) or not isinstance(b.get('type'), str):
                        raise Failure(502, 'source_limit')
                    yield b
                if not data['has_more']:
                    return
                cursor = data.get('next_cursor')
                if not isinstance(cursor, str) or not re.fullmatch(r'[a-f0-9-]{32,36}', cursor) or cursor in seen:
                    raise Failure(502, 'source_invalid')
                seen.add(cursor)

        items, inside, found, ended = [], False, 0, False

        def collect(b, depth=0):
            kind = b['type']
            payload = b.get(kind)
            if not isinstance(payload, dict):
                raise Failure(502, 'source_invalid')
            if b.get('archived') or b.get('in_trash'):
                return
            if kind == 'to_do':
                if type(payload.get('checked')) is not bool:
                    raise Failure(502, 'source_invalid')
                if payload['checked']:
                    return
                text = rich_text(payload.get('rich_text'))
                # Child prose is part of this item's restriction; child checkboxes are separate items.
                nested = list(children(b['id'], depth + 1)) if b.get('has_children') else []
                notes = []
                for child in nested:
                    if child.get('type') in ('paragraph', 'bulleted_list_item', 'numbered_list_item'):
                        if child.get('has_children'):
                            raise Failure(502, 'source_invalid')
                        notes.append(rich_text((child.get(child['type']) or {}).get('rich_text')))
                items.append(item_fields(clean(' '.join([text, *notes]))))
                for child in nested:
                    if child.get('type') == 'to_do':
                        collect(child, depth + 1)
            elif b.get('has_children'):
                if kind not in ('toggle', 'bulleted_list_item', 'numbered_list_item'):
                    raise Failure(502, 'source_invalid')
                for child in children(b['id'], depth + 1):
                    collect(child, depth + 1)
            if len(items) > 100:
                raise Failure(502, 'source_limit')

        for b in children(self.page):
            kind = b['type']
            if kind in ('heading_1', 'heading_2'):
                heading = rich_text((b.get(kind) or {}).get('rich_text'))
                target = kind == 'heading_2' and re.fullmatch(r'À acheter\s*[—–-]\s*Vinification(?:\s*\([^)]*\))?', heading, re.I)
                if target:
                    found += 1
                    if found > 1:
                        raise Failure(502, 'section_ambiguous')
                    inside = True
                elif inside:
                    inside, ended = False, True
                continue
            if inside and not ended:
                collect(b)
        if found != 1:
            raise Failure(502, 'section_missing')
        if time.monotonic() > deadline:
            raise Failure(504, 'upstream_timeout')
        return {'items': items, 'fetchedAt': stamp()}


class WineServer(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True
    request_queue_size = 16
    def __init__(self, socket_path, policy_path, dist, token):
        self.policy_path = policy_path
        policy = load_policy(policy_path)
        self.reader = NotionReader(token, policy['source_page'], policy['source_parent'])
        self.dist = Path(dist).resolve()
        self.limit_lock = threading.Lock()
        self.limits = {}
        self.slots = threading.BoundedSemaphore(16)
        super().__init__(socket_path, Handler)
        os.chmod(socket_path, 0o600)

    def get_request(self):
        conn, _ = self.socket.accept()
        return conn, ('unix', 0)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        super().process_request(request, client_address)

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()

    def rate(self, node):
        now = int(time.monotonic() // 60)
        with self.limit_lock:
            self.limits = {k: v for k, v in self.limits.items() if v[0] == now}
            window, count = self.limits.get(node, (now, 0))
            self.limits[node] = (window, count + 1)
            if count >= 10:
                raise Failure(429, 'rate_limited')


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    timeout = 15
    server_version = 'Wine'
    sys_version = ''

    def log_message(self, *args):
        pass  # No paths, tokens, upstream data or identity values in access logs.

    def respond(self, status, content, content_type='application/json; charset=utf-8', extra=None):
        self.send_response(status)
        for k, v in {'Content-Type': content_type, 'Content-Length': str(len(content)), 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP, 'Cross-Origin-Resource-Policy': 'same-origin', **(extra or {})}.items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(content)

    def handle_any(self):
        try:
            if len(self.path) > 2048 or sum(len(k) + len(v) for k, v in self.headers.items()) > 16384:
                raise Failure(431, 'request_too_large')
            policy = load_policy(self.server.policy_path, allow_expired=True)  # Revocation/expiry applies without restart.
            if policy['source_page'] != self.server.reader.page or policy['source_parent'] != self.server.reader.parent:
                raise Failure(503, 'configuration_changed')
            with VerifiedProxy(self.connection) as proxy:
                node = authorize(self.headers, policy, self.command, self.path, proxy.whois)
                proxy.check_live()
                self.serve_authorized(node, proxy)
        except Failure as e:
            self.respond(e.status, json.dumps({'error': e.code}).encode())
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.respond(503, b'{"error":"service_unavailable"}')
        finally:
            self.close_connection = True

    def serve_authorized(self, node, proxy):
        if self.path == API_PATH:
            self.server.rate(node)
            result = json.dumps(self.server.reader.read(), ensure_ascii=False).encode()
            if len(result) > 200000:
                raise Failure(502, 'source_limit')
            proxy.check_live()
            self.respond(200, result)
            return
        if self.path == '/healthz':
            self.respond(200, b'{"ok":true}')
            return
        if self.path == '/':
            self.respond(303, b'', extra={'Location': APP_PATH + '#supplies'})
            return
        if '?' in self.path or '%' in self.path or not self.path.startswith(APP_PATH):
            raise Failure(404, 'not_found')
        relative = self.path[len(APP_PATH):] or 'index.html'
        target = (self.server.dist / relative).resolve()
        if not target.is_relative_to(self.server.dist) or not target.is_file() or target.is_symlink() or target.suffix not in ('.html', '.js', '.css', '.svg', '.png', '.webmanifest'):
            raise Failure(404, 'not_found')
        raw = target.read_bytes()
        if len(raw) > 1048576:
            raise Failure(404, 'not_found')
        mime = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'}[target.suffix]
        proxy.check_live()
        self.respond(200, raw, mime)

    do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = do_TRACE = do_CONNECT = handle_any


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--policy', required=True)
    parser.add_argument('--dist', required=True)
    parser.add_argument('--socket', required=True)
    args = parser.parse_args()
    directory = os.environ.get('CREDENTIALS_DIRECTORY')
    if not directory:
        raise SystemExit('Protected service credential required')
    token = protected_file(Path(directory) / 'notion-token')
    if not token.startswith(('ntn_', 'secret_')) or len(token) < 25 or any(c.isspace() for c in token):
        raise SystemExit('Invalid service credential')
    sock = Path(args.socket)
    if sock.exists():
        raise SystemExit('Socket already exists; refuse replacement')
    with WineServer(str(sock), args.policy, args.dist, token) as server:
        try:
            server.serve_forever()
        finally:
            sock.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
