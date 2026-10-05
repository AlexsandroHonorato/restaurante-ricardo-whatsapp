"""Validação do SERVERS_CONFIG usado pelo GitHub Actions (.github/scripts/publicar-empresa.py)."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / '.github/scripts/publicar-empresa.py'
spec = importlib.util.spec_from_file_location('publicar_empresa', SCRIPT)
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)

VALIDA = {
    'host': '129.121.47.198', 'user': 'famil1234', 'port': 22022, 'bot_port': 3101,
    'app_dir': '/home/familiaricardo.botclient.propoclient.com.br/botclient',
    'health_url': 'https://familiaricardo.botclient.propoclient.com.br/api/health',
    'backup_hook': '/usr/local/bin/botclient-backup', 'reload_hook': '/usr/local/bin/botclient-reload',
}


class ConfiguracaoTest(unittest.TestCase):
    def config(self, **alteracoes):
        return modulo.configuracao({'familiaricardo': {**VALIDA, **alteracoes}}, 'familiaricardo')

    def test_configuracao_valida(self):
        self.assertEqual(self.config()['bot_port'], 3101)

    def test_recusa_root_http_e_caminhos_inseguros(self):
        for alteracao in ({'user': 'root'}, {'health_url': 'http://x.com.br/api/health'},
                          {'health_url': 'https://x.com.br/up'}, {'app_dir': '/home/../etc'},
                          {'bot_port': 80}, {'bot_port': '3101'}, {'seed_cardapio': 'sim'}):
            with self.subTest(alteracao=alteracao), self.assertRaises(ValueError):
                self.config(**alteracao)

    def test_campos_obrigatorios(self):
        sem_porta = dict(VALIDA)
        del sem_porta['bot_port']
        with self.assertRaises(KeyError):
            modulo.configuracao({'familiaricardo': sem_porta}, 'familiaricardo')


if __name__ == '__main__':
    unittest.main()
