#!/usr/bin/env python3
"""Stage an immutable private candidate only. Does not install a unit or change Serve."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[2]
dist = root / '.private-dist'
if not (dist / 'index.html').is_file():
    raise SystemExit('Build the private edition first.')
version = json.loads((root / 'package.json').read_text())['privateDisplayVersion']
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
files = {str(p.relative_to(dist)): hashlib.sha256(p.read_bytes()).hexdigest() for p in dist.rglob('*') if p.is_file()}
if any(p.is_symlink() for p in dist.rglob('*')):
    raise SystemExit('Symlinks are not allowed in release assets.')
server = root / 'private/server/wine_private.py'
files['server/wine_private.py'] = hashlib.sha256(server.read_bytes()).hexdigest()
digest = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
release = Path.home() / '.local/share/lifeos-wine-private/releases' / (revision[:12] + '-' + digest[:12])
release.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
if release.exists():
    raise SystemExit('Release already staged; inspect the existing manifest instead of overwriting.')
release.mkdir(mode=0o700)
shutil.copytree(dist, release / 'dist')
(release / 'server').mkdir()
shutil.copyfile(server, release / 'server/wine_private.py')
(release / 'manifest.json').write_text(json.dumps({'version': version, 'revision': revision, 'artifactDigest': digest, 'files': files, 'state': 'staged-inactive'}, indent=2) + '\n')
for p in release.rglob('*'):
    p.chmod(0o500 if p.is_dir() else 0o400)
release.chmod(0o500)
print(json.dumps({'release': str(release), 'version': version, 'revision': revision, 'artifactDigest': digest, 'active': False}))
