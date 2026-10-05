"""Executa deploy.sh/rollback.sh reais (Linux) com php, curl e sudo simulados.

  python3 -m unittest discover -s deploy/tests -v
"""
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest

DEPLOY = Path(__file__).resolve().parents[1]
SHA_A, SHA_B, SHA_C = 'a' * 40, 'b' * 40, 'c' * 40

PHP = """#!/usr/bin/env bash
# Simula "php artisan ..." e o preflight; registra cada chamada.
printf '%s\\n' "$*" >> "$STUB_LOG"
if [[ "$1" == *release-preflight.php ]]; then exit 0; fi
if [[ "$2" == migrate && -n "${FAIL_MIGRATE:-}" ]]; then exit 1; fi
exit 0
"""
CURL = """#!/usr/bin/env bash
# Health HTTPS devolve o SHA pedido em ?release=; o bot local responde "agente no ar".
url="${@: -1}"
if [[ "$url" == http://127.0.0.1:* ]]; then printf 'agente no ar'; exit 0; fi
release="${url#*release=}"; release="${release%%&*}"
if [[ "$release" == "${FAIL_HEALTH_FOR:-nenhum}" ]]; then exit 22; fi
printf '{"application":"BotClient","status":"healthy","database":"ok","version":"%s"}\\n200' "$release"
"""
SUDO = """#!/usr/bin/env bash
[[ "$1" == -n && "$2" == -- ]] && shift 2
printf 'reload %s\\n' "$*" >> "$STUB_LOG"
"""


def pacote(pasta, sha, adulterar=False):
    caminho = Path(pasta) / f'botclient-{sha}.tar.gz'
    arquivos = {
        'artisan': b'<?php', 'vendor/autoload.php': b'<?php', 'public/index.php': b'<?php',
        'public/index.html': b'<html>', 'bot/agente.js': b'', 'bot/cerebro.js': b'',
        'bot/negocio.md': b'# Ficha modelo', 'bot/package.json': b'{}',
        'version.json': json.dumps({'application': 'BotClient', 'commit': sha}).encode(),
    }
    with tarfile.open(caminho, 'w:gz') as tar:
        for nome, conteudo in arquivos.items():
            info = tarfile.TarInfo(nome)
            info.size = len(conteudo)
            tar.addfile(info, io.BytesIO(conteudo))
    soma = hashlib.sha256(caminho.read_bytes()).hexdigest()
    Path(str(caminho) + '.sha256').write_text(('0' * 64 if adulterar else soma) + '\n')
    return caminho


@unittest.skipUnless(shutil.which('flock') and shutil.which('bash'), 'requer Linux com bash e flock')
class DeployTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.app = self.tmp / 'app'
        (self.app / 'shared/bot').mkdir(parents=True)
        (self.app / 'shared/.env').write_text('APP_ENV=production\n')
        (self.app / 'shared/bot/bot.env').write_text('PORTA=3101\n')
        stubs = self.tmp / 'bin'
        stubs.mkdir()
        for nome, conteudo in (('php', PHP), ('curl', CURL), ('sudo', SUDO)):
            (stubs / nome).write_text(conteudo)
            (stubs / nome).chmod(0o755)
        backup = self.tmp / 'backup-hook'
        backup.write_text('#!/usr/bin/env bash\nprintf "backup %s\\n" "$2" >> "$STUB_LOG"\n')
        backup.chmod(0o755)
        self.log = self.tmp / 'stub.log'
        self.env = {**os.environ, 'PATH': f'{stubs}:{os.environ["PATH"]}', 'STUB_LOG': str(self.log),
                    'APP_DIR': str(self.app), 'HEALTH_URL': 'https://empresa.example/api/health', 'BOT_PORT': '3101',
                    'BACKUP_HOOK': str(backup), 'RELOAD_HOOK': '/usr/local/bin/botclient-reload',
                    'HEALTH_INTERVAL': '0', 'KEEP_RELEASES': '2'}

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def deploy(self, sha, **extra):
        caminho = pacote(self.tmp, sha, adulterar=extra.pop('adulterar', False))
        return subprocess.run(['bash', str(DEPLOY / 'deploy.sh')], capture_output=True, text=True,
                              env={**self.env, 'RELEASE_ID': sha, 'PACKAGE_PATH': str(caminho), **extra})

    def ativa(self):
        return (self.app / 'current').resolve().name

    def test_primeira_publicacao_liga_dados_da_empresa_e_semeia_cardapio(self):
        resultado = self.deploy(SHA_A, SEED_CARDAPIO='true')
        self.assertEqual(resultado.returncode, 0, resultado.stderr + resultado.stdout)
        self.assertEqual(self.ativa(), SHA_A)
        self.assertTrue((self.app / f'releases/{SHA_A}/.deployed').is_file())
        self.assertEqual((self.app / 'shared/bot/negocio.md').read_text(), '# Ficha modelo')
        self.assertTrue((self.app / f'releases/{SHA_A}/.env').is_symlink())
        log = self.log.read_text()
        self.assertIn(f'backup {SHA_A}', log)
        self.assertIn('CardapioSeeder', log)
        self.assertIn('reload /usr/local/bin/botclient-reload', log)

    def test_falha_no_health_volta_para_versao_anterior_sem_semear(self):
        self.assertEqual(self.deploy(SHA_A).returncode, 0)
        (self.app / 'shared/bot/negocio.md').write_text('# Ficha editada pela empresa')
        resultado = self.deploy(SHA_B, FAIL_HEALTH_FOR=SHA_B, SEED_CARDAPIO='true')
        self.assertNotEqual(resultado.returncode, 0)
        self.assertEqual(self.ativa(), SHA_A)
        self.assertEqual((self.app / 'shared/bot/negocio.md').read_text(), '# Ficha editada pela empresa')
        self.assertNotIn('CardapioSeeder', self.log.read_text())
        self.assertIn('DEPLOY FAILED', resultado.stdout + resultado.stderr)

    def test_falha_na_migration_mantem_versao_anterior(self):
        self.assertEqual(self.deploy(SHA_A).returncode, 0)
        resultado = self.deploy(SHA_B, FAIL_MIGRATE='1')
        self.assertNotEqual(resultado.returncode, 0)
        self.assertEqual(self.ativa(), SHA_A)

    def test_pacote_adulterado_e_recusado(self):
        self.assertEqual(self.deploy(SHA_A).returncode, 0)
        resultado = self.deploy(SHA_B, adulterar=True)
        self.assertNotEqual(resultado.returncode, 0)
        self.assertEqual(self.ativa(), SHA_A)
        self.assertFalse((self.app / f'releases/{SHA_B}').exists())

    def test_rollback_e_retencao(self):
        for sha in (SHA_A, SHA_B, SHA_C):
            self.assertEqual(self.deploy(sha).returncode, 0)
        resultado = subprocess.run(['bash', str(DEPLOY / 'rollback.sh')], capture_output=True, text=True, env=self.env)
        self.assertEqual(resultado.returncode, 0, resultado.stderr + resultado.stdout)
        self.assertEqual(self.ativa(), SHA_B)
        self.assertTrue((self.app / f'releases/{SHA_C}').is_dir())


if __name__ == '__main__':
    unittest.main()
