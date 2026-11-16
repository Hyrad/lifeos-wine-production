#!/usr/bin/env python3
"""Owner-only hidden terminal entry; never echoes, logs or overwrites values."""
import getpass
import os
import resource
from pathlib import Path
import stat
import sys
import warnings


def save_pair(folder, client_id, secret):
    folder = Path(folder)
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    meta = folder.lstat()
    if not stat.S_ISDIR(meta.st_mode) or meta.st_uid != os.getuid() or stat.S_IMODE(meta.st_mode) != 0o700:
        raise ValueError('Unsafe credential directory')
    if any(not value or len(value) > 512 or not value.isascii() or any(c.isspace() for c in value) for value in (client_id, secret)):
        raise ValueError('Invalid input')
    created = []
    try:
        for name, value in [('tailscale-oauth-id', client_id), ('tailscale-oauth-secret', secret)]:
            path = folder / name
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            created.append(path)
            with os.fdopen(fd, 'w') as out:
                os.fchmod(out.fileno(), 0o600)
                out.write(value + '\n')
                out.flush()
                os.fsync(out.fileno())
    except BaseException:
        for path in created:
            path.unlink()
        raise


def main():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise ValueError('Private interactive terminal required')
    folder = Path.home() / '.config/lifeos-wine-private'
    if any((folder / name).exists() or (folder / name).is_symlink() for name in ('tailscale-oauth-id', 'tailscale-oauth-secret')):
        raise ValueError('Credential already exists; no overwrite')
    warnings.simplefilter('error', getpass.GetPassWarning)
    client_id = getpass.getpass('OAuth client ID (hidden): ')
    secret = getpass.getpass('OAuth client secret (hidden): ')
    save_pair(folder, client_id, secret)
    print('PASS: protected OAuth files saved. No values displayed. Tell Codex completion and scope only.')


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt):
        print('FAIL: entry cancelled or protected files unavailable; no existing file overwritten.')
    input('Press Enter to close this private entry window.')
