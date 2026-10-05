"""Monta o pacote único de uma versão: Laravel (vendor sem dev) + painel Angular + bot Node, nunca dados de empresa.

Uso (raiz do repositório):
  SHA=<commit> BUILD=<número> [API_SOURCE=backend] python .github/scripts/empacotar.py
Gera runtime/pacote/botclient-<SHA>.tar.gz, o .sha256 e a pasta ops/ com os scripts de servidor.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import tarfile

ROOT = Path(__file__).resolve().parents[2]
OPS = ('deploy.sh', 'rollback.sh', 'release-common.sh', 'release-files.py', 'release-preflight.php')
EXCLUIDOS = {'.git', '.github', 'node_modules', 'tests', 'test', '__tests__', 'logs', '.env', '.env.example', '.DS_Store'}
LARAVEL = ('app', 'bootstrap', 'config', 'database/migrations', 'database/seeders', 'public', 'resources', 'routes',
           'vendor', 'artisan', 'composer.json', 'composer.lock')
# Bot: só o que roda em produção (simulador, testes e dados locais ficam de fora).
BOT = ('agente.js', 'cerebro.js', 'pedidos.js', 'negocio.md', 'package.json', 'lib')


def permitido(relativo):
    return (not any(p in EXCLUIDOS or p.startswith('.env.') for p in relativo.parts)
            and relativo.suffix.lower() not in {'.log', '.pem', '.key', '.p12', '.pfx', '.sqlite', '.map', '.tmp'})


def empacotar(api, angular, destino, sha, build):
    if not re.fullmatch(r'[a-f0-9]{40}', sha) or not str(build).isdigit():
        raise ValueError('SHA ou número de build inválido')
    instalados = json.loads((api / 'vendor/composer/installed.json').read_text(encoding='utf-8'))
    if instalados.get('dev', True):
        raise ValueError('Instale o Composer com --no-dev antes de empacotar')
    for obrigatorio in (api / 'vendor/autoload.php', angular / 'index.html', ROOT / 'agente.js'):
        if not obrigatorio.is_file():
            raise ValueError(f'Build de produção ausente: {obrigatorio}')
    destino.mkdir(parents=True, exist_ok=True)
    caminho = destino / f'botclient-{sha}.tar.gz'
    manifesto = json.dumps({'application': 'BotClient', 'commit': sha, 'build': str(build)}, indent=2).encode()

    with tarfile.open(caminho, 'w:gz') as pacote:
        def adicionar(origem, relativo):
            if origem.is_symlink():
                return
            info = pacote.gettarinfo(str(origem), str(relativo).replace('\\', '/'))
            info.uid = info.gid = 0
            info.uname = info.gname = ''
            info.mode = 0o640
            with origem.open('rb') as fluxo:
                pacote.addfile(info, fluxo)

        def arquivos(base, nome):
            origem = base / nome
            return sorted(p for p in origem.rglob('*') if p.is_file()) if origem.is_dir() else [origem]

        for nome in LARAVEL:
            for arquivo in arquivos(api, nome):
                relativo = arquivo.relative_to(api)
                texto = str(relativo).replace('\\', '/')
                if (not permitido(relativo) or arquivo.name == '.htaccess'
                        or texto.startswith(('bootstrap/cache/', 'public/storage/', 'vendor/bin/', 'public/build/', 'public/hot'))):
                    continue
                if relativo.parts[0] == 'public' and (angular / Path(*relativo.parts[1:])).is_file():
                    continue  # o arquivo do painel (ex.: favicon) prevalece
                adicionar(arquivo, relativo)
        for arquivo in sorted(angular.rglob('*')):
            if arquivo.is_file() and permitido(arquivo.relative_to(angular)):
                if arquivo.suffix == '.php' or arquivo.name == '.htaccess':
                    raise ValueError('Executável inesperado na saída do Angular')
                adicionar(arquivo, Path('public') / arquivo.relative_to(angular))
        adicionar(ROOT / 'deploy/web/spa.htaccess', 'public/.htaccess')
        for nome in BOT:
            for arquivo in arquivos(ROOT, nome):
                adicionar(arquivo, Path('bot') / arquivo.relative_to(ROOT))
        for nome in OPS:
            adicionar(ROOT / 'deploy' / nome, Path('.ops') / nome)
        for nome in ('version.json', 'public/version.json'):
            info = tarfile.TarInfo(nome)
            info.size, info.mode = len(manifesto), 0o640
            pacote.addfile(info, io.BytesIO(manifesto))

    with caminho.open('rb') as fluxo:
        checksum = hashlib.file_digest(fluxo, 'sha256').hexdigest()
    Path(str(caminho) + '.sha256').write_text(checksum + '\n')
    scripts = destino / 'ops'
    scripts.mkdir(exist_ok=True)
    for nome in OPS:
        shutil.copyfile(ROOT / 'deploy' / nome, scripts / nome)
    print(f'PACOTE OK: {caminho.name} SHA256={checksum}')


if __name__ == '__main__':
    empacotar(Path(os.environ.get('API_SOURCE', str(ROOT / 'backend'))).resolve(),
              ROOT / 'frontend/dist/frontend/browser',
              ROOT / 'runtime/pacote', os.environ['SHA'], os.environ['BUILD'])
