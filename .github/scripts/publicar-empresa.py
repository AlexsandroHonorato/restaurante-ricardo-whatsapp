"""Envia o pacote de uma versão para UMA empresa por SSH e roda deploy.sh no servidor (adaptado do PropoClient).

Variáveis: EMPRESA (id em vars.EMPRESAS), GITHUB_SHA, SERVERS_CONFIG (JSON), SSH_PRIVATE_KEY, SSH_KNOWN_HOSTS.
Nada de credencial, host ou comando remoto é impresso no log do Actions.
"""
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
from urllib.parse import urlsplit

CAMINHO = re.compile(r'/[A-Za-z0-9_./-]+')


def configuracao(config, empresa):
    servidor = config[empresa]
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*', servidor['host']):
        raise ValueError('host inválido (use DNS ou IPv4)')
    usuario = servidor['user']
    if not re.fullmatch(r'[a-z_][a-z0-9_-]*', usuario) or usuario == 'root':
        raise ValueError('use o usuário do site, nunca root')
    porta = servidor.get('port', 22)
    if type(porta) is not int or not 1 <= porta <= 65535:
        raise ValueError('porta SSH inválida')
    for campo in ('app_dir', 'backup_hook', 'reload_hook'):
        valor = servidor[campo]
        if not CAMINHO.fullmatch(valor) or '..' in valor or valor == '/':
            raise ValueError(f'caminho inválido em {campo}')
    url = urlsplit(servidor['health_url'])
    if (url.scheme != 'https' or not url.hostname or url.path != '/api/health'
            or url.username or url.password or url.query or url.fragment):
        raise ValueError('health_url deve ser HTTPS terminando em /api/health')
    if type(servidor['bot_port']) is not int or not 1024 <= servidor['bot_port'] <= 65535:
        raise ValueError('bot_port inválida')
    manter = servidor.get('keep_releases', 5)
    if type(manter) is not int or not 2 <= manter <= 100:
        raise ValueError('keep_releases deve ser 2..100')
    if type(servidor.get('seed_cardapio', False)) is not bool:
        raise ValueError('seed_cardapio deve ser true/false')
    return servidor


def publicar():
    empresa, sha = os.environ['EMPRESA'], os.environ['GITHUB_SHA']
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,31}', empresa) or not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Identificação da publicação inválida')
    servidor = configuracao(json.loads(os.environ['SERVERS_CONFIG']), empresa)
    for valor in (servidor['host'], servidor['health_url']):
        print(f'::add-mask::{valor}', flush=True)
    pasta = Path('runtime/pacote').resolve()
    pacote = f'botclient-{sha}.tar.gz'
    if not (pasta / pacote).is_file():
        raise ValueError('Pacote da versão ausente')
    with tempfile.TemporaryDirectory(prefix='botclient-ssh-', dir=os.environ.get('RUNNER_TEMP')) as temporario:
        chave, conhecidos = Path(temporario) / 'key', Path(temporario) / 'known_hosts'
        chave.write_text(os.environ['SSH_PRIVATE_KEY'].strip() + '\n')
        conhecidos.write_text(os.environ['SSH_KNOWN_HOSTS'].strip() + '\n')
        chave.chmod(0o600)
        conhecidos.chmod(0o600)
        opcoes = ['-i', str(chave), '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
                  '-o', 'StrictHostKeyChecking=yes', '-o', f'UserKnownHostsFile={conhecidos}',
                  '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4']
        destino = f"{servidor['user']}@{servidor['host']}"
        porta = str(servidor.get('port', 22))
        ssh = ['ssh', *opcoes, '-p', porta, destino]
        execucao, tentativa = os.environ.get('GITHUB_RUN_ID', ''), os.environ.get('GITHUB_RUN_ATTEMPT', '')
        if not execucao.isdigit() or not tentativa.isdigit():
            raise ValueError('Identificação da execução inválida')
        entrada = f"{servidor['app_dir']}/incoming/{sha}-{execucao}-{tentativa}"
        subprocess.run([*ssh, shlex.join(['mkdir', '-m', '750', '-p', entrada])], check=True)
        try:
            subprocess.run(['scp', *opcoes, '-P', porta, '-r', str(pasta / pacote), str(pasta / (pacote + '.sha256')),
                            str(pasta / 'ops'), f'{destino}:{entrada}/'], check=True)
            ambiente = {
                'APP_DIR': servidor['app_dir'], 'RELEASE_ID': sha, 'PACKAGE_PATH': f'{entrada}/{pacote}',
                'HEALTH_URL': servidor['health_url'], 'BOT_PORT': str(servidor['bot_port']),
                'BACKUP_HOOK': servidor['backup_hook'], 'RELOAD_HOOK': servidor['reload_hook'],
                'KEEP_RELEASES': str(servidor.get('keep_releases', 5)),
                'SEED_CARDAPIO': str(servidor.get('seed_cardapio', False)).lower(),
            }
            comando = ['env', *(f'{k}={v}' for k, v in ambiente.items()), 'bash', f'{entrada}/ops/deploy.sh']
            # O próprio servidor faz health check e volta à versão anterior sob a mesma trava.
            subprocess.run([*ssh, shlex.join(comando)], check=True)
            print(f'PUBLICAÇÃO + HEALTH CHECK {empresa}: OK', flush=True)
        finally:
            subprocess.run([*ssh, shlex.join(['rm', '-rf', '--', entrada])], check=False)


if __name__ == '__main__':
    try:
        publicar()
    except Exception as erro:
        # Não serializa configuração, chaves, comandos remotos nem exceções que possam conter segredos.
        print(f'PUBLICAÇÃO FALHOU ({type(erro).__name__}). Confira a configuração desta empresa e o log no servidor.', flush=True)
        raise SystemExit(1) from None
