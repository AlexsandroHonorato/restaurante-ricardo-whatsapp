"""Valida o pacote antes de extrair e apaga só releases antigas já validadas (adaptado do PropoClient)."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tarfile

SHA = re.compile(r'[a-f0-9]{40}')
OBRIGATORIOS = ('artisan', 'vendor/autoload.php', 'public/index.php', 'public/index.html',
                'bot/agente.js', 'bot/cerebro.js', 'bot/negocio.md', 'bot/package.json')


def extract(package, destination, release):
    package, destination = Path(package), Path(destination)
    expected = Path(str(package) + '.sha256').read_text().split()[0]
    with package.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected or not SHA.fullmatch(release):
        raise ValueError('Invalid checksum or release ID')
    if destination.exists() or destination.is_symlink():
        raise ValueError('Release already exists')
    with tarfile.open(package, 'r:gz') as archive:
        members = archive.getmembers()
        names = set()
        for member in members:
            path = PurePosixPath(member.name)
            if (path.is_absolute() or '..' in path.parts or '\\' in member.name
                    or not (member.isfile() or member.isdir()) or member.name in names
                    or any(part in ('.env', '.git', '.github', 'node_modules') for part in path.parts)
                    or (path.parts and path.parts[0] == 'storage')):
                raise ValueError('Unsafe archive entry')
            names.add(member.name)
        manifest = json.load(archive.extractfile('version.json'))
        if manifest.get('commit') != release or manifest.get('application') != 'BotClient':
            raise ValueError('Manifest does not match requested release')
        for required in OBRIGATORIOS:
            if required not in names:
                raise ValueError('Incomplete production archive')
        destination.mkdir(mode=0o750)
        try:
            for member in members:
                member.mode = 0o750 if member.isdir() else 0o640
                member.uid = member.gid = 0
                member.uname = member.gname = ''
            archive.extractall(destination, members=members, filter='data')
        except BaseException:
            shutil.rmtree(destination)
            raise


def prune(directory, count):
    root = Path(directory).resolve()
    releases = root / 'releases'
    if releases.is_symlink() or not 2 <= int(count) <= 100:
        raise ValueError('Invalid retention parameters')
    protected = {(root / 'current').resolve()}
    previous = root / '.previous-release'
    if previous.is_file() and SHA.fullmatch(previous.read_text().strip()):
        protected.add(releases / previous.read_text().strip())
    candidates = [p for p in releases.iterdir() if SHA.fullmatch(p.name)
                  and p.is_dir() and not p.is_symlink() and (p / '.deployed').is_file()]
    candidates.sort(key=lambda p: (p / '.deployed').stat().st_mtime, reverse=True)
    protected.update(candidates[:int(count)])
    for candidate in candidates:
        if candidate not in protected:
            shutil.rmtree(candidate)


if __name__ == '__main__':
    if sys.argv[1] == 'extract':
        extract(*sys.argv[2:])
    elif sys.argv[1] == 'prune':
        prune(*sys.argv[2:])
    else:
        raise SystemExit('Unknown operation')
