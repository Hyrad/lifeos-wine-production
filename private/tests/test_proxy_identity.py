"""Kernel-backed proxy checks; all identities and endpoint metadata are synthetic."""
from contextlib import ExitStack
import errno
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import wine_private as w


class SocketProcess:
    """A real process owns the listener, so its sockets carry real kernel PIDs."""
    def __init__(self, folder, name):
        self.path = str(Path(folder) / name)
        code = """import socket,sys
s=socket.socket(socket.AF_UNIX);s.bind(sys.argv[1]);s.listen(8)
print('ready',flush=True)
connections=[]
while True: connections.append(s.accept()[0])
"""
        self.process = subprocess.Popen([sys.executable, '-u', '-c', code, self.path], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        if self.process.stdout.readline() != b'ready\n':
            raise RuntimeError('Synthetic socket process failed')
        self.sockets = []

    def connect(self):
        s = socket.socket(socket.AF_UNIX)
        s.settimeout(2)
        s.connect(self.path)
        self.sockets.append(s)
        return s

    def die(self):
        if self.process.poll() is None:
            self.process.terminate()
        self.process.wait(timeout=3)

    def close(self):
        self.die()
        for s in self.sockets:
            s.close()
        self.process.stdout.close()


class KernelProxyTests(unittest.TestCase):
    def setUp(self):
        self.files = ExitStack()
        self.addCleanup(self.files.close)
        self.folder = self.files.enter_context(tempfile.TemporaryDirectory())

    def process(self, name):
        p = SocketProcess(self.folder, name)
        self.files.callback(p.close)
        return p

    def denied(self, incoming, trusted):
        with patch.object(w, 'pinned_localapi_socket', side_effect=trusted), self.assertRaises(w.Failure) as error:
            with w.VerifiedProxy(incoming):
                self.fail('Untrusted peer accepted')
        self.assertEqual(error.exception.status, 403)

    def test_same_live_kernel_process_accepted(self):
        daemon = self.process('daemon')
        with patch.object(w, 'pinned_localapi_socket', side_effect=daemon.connect):
            with w.VerifiedProxy(daemon.connect()) as proof:
                self.assertEqual(proof.incoming.credentials[0], daemon.process.pid)
                proof.check_live()
            with self.assertRaises(w.Failure):
                proof.check_live()

    def test_different_daemon_even_with_same_uid_denied(self):
        daemon, imposter = self.process('daemon'), self.process('imposter')
        self.denied(imposter.connect(), daemon.connect)

    def test_real_daemon_death_invalidates_existing_proof(self):
        daemon = self.process('daemon')
        with patch.object(w, 'pinned_localapi_socket', side_effect=daemon.connect):
            with w.VerifiedProxy(daemon.connect()) as proof:
                daemon.die()
                with self.assertRaises(w.Failure):
                    proof.check_live()

    def test_restart_rejects_old_socket_and_accepts_fresh_daemon(self):
        old, new = self.process('old'), self.process('new')
        incoming = old.connect()
        old.die()
        self.denied(incoming, new.connect)
        with patch.object(w, 'pinned_localapi_socket', side_effect=new.connect):
            with w.VerifiedProxy(new.connect()) as proof:
                proof.check_live()

    def test_reused_numeric_pid_cannot_revive_old_kernel_handle(self):
        old, new = self.process('old'), self.process('new')
        peer = w.kernel_peer(old.connect(), self.files)
        old.die()
        # Simulate numeric PID reuse, retaining the real exited process handle.
        reused = w.KernelPeer((new.process.pid, *peer.credentials[1:]), peer.pidfd)
        with self.assertRaises(ValueError):
            reused.check_live()

    def test_localapi_failure_denied_and_handles_closed(self):
        daemon = self.process('daemon')
        incoming = daemon.connect()
        before = len(list(Path('/proc/self/fd').iterdir()))
        self.denied(incoming, lambda: (_ for _ in ()).throw(ConnectionRefusedError()))
        self.assertEqual(len(list(Path('/proc/self/fd').iterdir())), before)

    def test_missing_or_malformed_kernel_evidence_denied(self):
        for error in [OSError(errno.ENOPROTOOPT, 'unsupported'), OSError(errno.ESRCH, 'dead'), ValueError('missing fdinfo')]:
            with self.subTest(error=type(error).__name__), patch.object(w, 'kernel_peer', side_effect=error):
                self.denied(Mock(), Mock())
        raw = Mock()
        raw.getsockopt.return_value = b'bad'
        with self.assertRaises(Exception):
            w.kernel_peer(raw, self.files)

    def test_same_overflow_uid_does_not_allow_different_process(self):
        a = SimpleNamespace(credentials=(111, 65534, 65534), check_live=Mock())
        b = SimpleNamespace(credentials=(222, 65534, 65534), check_live=Mock())
        with patch.object(w, 'kernel_peer', side_effect=[a, b]), patch.object(w, 'pinned_localapi_socket', return_value=Mock()):
            with self.assertRaises(w.Failure):
                with w.VerifiedProxy(Mock()):
                    self.fail('Shared overflow UID accepted')

    def test_unmapped_root_requires_same_full_daemon_identity(self):
        a = SimpleNamespace(credentials=(111, 65534, 65534), check_live=Mock())
        for credentials, allowed in [((111, 65534, 65534), True), ((111, 1000, 1000), False), ((112, 65534, 65534), False)]:
            b = SimpleNamespace(credentials=credentials, check_live=Mock())
            with self.subTest(credentials=credentials), patch.object(w, 'kernel_peer', side_effect=[a, b]), patch.object(w, 'pinned_localapi_socket', return_value=Mock()):
                if allowed:
                    with w.VerifiedProxy(Mock()) as proof:
                        proof.check_live()
                else:
                    with self.assertRaises(w.Failure):
                        with w.VerifiedProxy(Mock()):
                            self.fail('Mismatched kernel identity')


class LocalAPIPathTests(unittest.TestCase):
    def connect(self, metadata):
        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch.object(w, 'visible_root_id', return_value=0))
        opened = stack.enter_context(patch.object(w.os, 'open', side_effect=[101, 102, 103, 104]))
        stack.enter_context(patch.object(w.os, 'close'))
        stack.enter_context(patch.object(w.os, 'fstat', side_effect=metadata))
        sock = Mock()
        stack.enter_context(patch.object(w.socket, 'socket', return_value=sock))
        return sock, opened

    def metadata(self):
        directory = SimpleNamespace(st_mode=stat.S_IFDIR | 0o755, st_uid=0)
        return [directory, directory, directory, SimpleNamespace(st_mode=stat.S_IFSOCK | 0o666, st_uid=0)]

    def test_connection_uses_pinned_inode_and_nofollow_walk(self):
        sock, opened = self.connect(self.metadata())
        self.assertIs(w.pinned_localapi_socket(), sock)
        sock.connect.assert_called_once_with('/proc/self/fd/104')
        self.assertTrue(all(call.args[1] & os.O_NOFOLLOW for call in opened.call_args_list))

    def test_writable_foreign_or_spoofed_socket_path_denied(self):
        for index, mode, owner in [(0, stat.S_IFDIR | 0o777, 0), (1, stat.S_IFDIR | 0o755, 1000), (2, stat.S_IFDIR | 0o775, 0), (3, stat.S_IFSOCK | 0o666, 1000), (3, stat.S_IFLNK | 0o777, 0), (3, stat.S_IFREG | 0o600, 0)]:
            with self.subTest(index=index, mode=mode, owner=owner):
                meta = self.metadata(); meta[index] = SimpleNamespace(st_mode=mode, st_uid=owner)
                sock, _ = self.connect(meta)
                with self.assertRaises(w.Failure):
                    w.pinned_localapi_socket()
                sock.connect.assert_not_called()

    def test_symlink_resolution_or_missing_path_does_not_fallback(self):
        for error in [OSError(errno.ELOOP, 'symlink'), FileNotFoundError()]:
            with self.subTest(error=type(error).__name__), patch.object(w, 'visible_root_id', return_value=0), patch.object(w.os, 'open', side_effect=error):
                with self.assertRaises(w.Failure):
                    w.pinned_localapi_socket()

    def test_namespace_mapping_or_missing_evidence(self):
        for contents, expected in [('0 0 4294967295\n', 0), ('1000 1000 1\n', 65534)]:
            def read(path):
                return contents if str(path).endswith('_map') else '65534\n'
            with self.subTest(contents=contents), patch.object(w.Path, 'read_text', read):
                self.assertEqual(w.visible_root_id('uid'), expected)
        with patch.object(w.Path, 'read_text', side_effect=FileNotFoundError()), self.assertRaises(w.Failure):
            w.pinned_localapi_socket()


class BoundWhoisTests(unittest.TestCase):
    def proof(self, response):
        p = w.VerifiedProxy(Mock())
        p.closed = False
        p.incoming = SimpleNamespace(credentials=(111, 0, 0), check_live=Mock())
        p.daemon = SimpleNamespace(credentials=(111, 0, 0), check_live=Mock())
        p.conn = Mock()
        p.conn.getresponse.return_value = response
        return p

    def test_valid_lookup_stays_on_verified_connection(self):
        response = Mock(status=200); response.read.return_value = b'{"Node":{},"UserProfile":{}}'
        p = self.proof(response)
        self.assertEqual(set(p.whois('100.64.0.1')), {'Node', 'UserProfile'})
        p.conn.request.assert_called_once_with('GET', '/localapi/v0/whois?addr=100.64.0.1', headers={'Host': 'local-tailscaled.sock'})
        self.assertEqual(p.incoming.check_live.call_count, 2)

    def test_failed_or_malformed_localapi_never_authorizes(self):
        for status, raw in [(403, b'{}'), (404, b'{}'), (500, b'{}'), (302, b'{}'), (200, b'[]'), (200, b'not-json'), (200, b'x' * 131073)]:
            response = Mock(status=status); response.read.return_value = raw
            with self.subTest(status=status, size=len(raw)), self.assertRaises(w.Failure):
                self.proof(response).whois('100.64.0.1')
        p = self.proof(Mock()); p.conn.request.side_effect = TimeoutError()
        with self.assertRaises(w.Failure):
            p.whois('100.64.0.1')

    def test_daemon_death_during_lookup_denies_result(self):
        response = Mock(status=200); response.read.return_value = b'{"Node":{},"UserProfile":{}}'
        p = self.proof(response)
        p.daemon.check_live.side_effect = [None, ValueError('dead')]
        with self.assertRaises(w.Failure):
            p.whois('100.64.0.1')


if __name__ == '__main__':
    unittest.main()
