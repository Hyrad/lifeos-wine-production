#!/usr/bin/env python3
"""Owner-run terminal entry. Never prints or logs the credential; refuses overwrite."""
import getpass
import os
from pathlib import Path

folder = Path.home() / '.config' / 'lifeos-wine-private'
folder.mkdir(mode=0o700, parents=True, exist_ok=True)
if folder.is_symlink() or folder.stat().st_mode & 0o077:
    raise SystemExit('Configuration directory must have mode 0700.')
token = getpass.getpass('New read-only Notion connection token (hidden): ').strip()
if not token.startswith(('ntn_', 'secret_')) or len(token) < 25 or any(c.isspace() for c in token):
    raise SystemExit('Token shape rejected; nothing saved.')
fd = os.open(folder / 'notion-token', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as out:
    out.write(token + '\n')
    out.flush()
    os.fsync(out.fileno())
print('Credential saved with mode 0600. Token was not displayed. Tell Codex setup is complete, without sending the token.')
