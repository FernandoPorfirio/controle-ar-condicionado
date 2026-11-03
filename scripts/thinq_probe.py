"""Sonda somente-leitura da ThinQ Connect API.

Lista os aparelhos da conta e, para cada ar condicionado, salva o profile
(o que o modelo suporta) e o state (estado atual) em scripts/out/.
Não envia nenhum comando ao aparelho.

Uso: python scripts/thinq_probe.py
"""

import base64
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "out"

# Chave pública do cliente ThinQ Connect (a mesma do SDK oficial thinqconnect).
API_KEY = "v6GFvkweNo7DK7yD3ylIZ9w52aKBU0eJ7wLXkSR3"

# Servidor regional por país: América = aic, Europa = eic, Ásia/resto = kic.
REGION_BY_COUNTRY = {"BR": "aic", "US": "aic", "CA": "aic", "MX": "aic", "AR": "aic", "CL": "aic", "CO": "aic"}


def load_env():
    env_file = ROOT / ".env"
    if not env_file.exists():
        sys.exit("Arquivo .env não encontrado. Copie .env.example para .env e preencha.")
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def request(path, region):
    headers = {
        "Authorization": f"Bearer {os.environ['THINQ_PAT']}",
        "x-country": os.environ["THINQ_COUNTRY"],
        "x-message-id": base64.urlsafe_b64encode(uuid.uuid4().bytes).decode()[:-2],
        "x-client-id": os.environ["THINQ_CLIENT_ID"],
        "x-api-key": API_KEY,
        "x-service-phase": "OP",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(f"https://api-{region}.lgthinq.com{path}", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as err:
        body = err.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {err.code} em {path} ({region}): {body}") from None


def main():
    load_env()
    country = os.environ["THINQ_COUNTRY"]
    preferred = REGION_BY_COUNTRY.get(country, "kic")
    regions = [preferred] + [r for r in ("aic", "eic", "kic") if r != preferred]

    devices, region = None, None
    for candidate in regions:
        try:
            devices = request("/devices", candidate)["response"]
            region = candidate
            break
        except RuntimeError as err:
            print(f"[{candidate}] falhou: {err}")
    if devices is None:
        sys.exit("Nenhuma região respondeu. Confira o token e o país.")

    print(f"Região: {region} — {len(devices)} aparelho(s)")
    OUT.mkdir(exist_ok=True)

    for dev in devices:
        info = dev.get("deviceInfo", {})
        dev_id = dev["deviceId"]
        print(f"- {info.get('alias')} | {info.get('deviceType')} | {info.get('modelName')} | id: {dev_id}")
        if "AIR_CONDITIONER" not in info.get("deviceType", ""):
            continue
        profile = request(f"/devices/{dev_id}/profile", region)["response"]
        state = request(f"/devices/{dev_id}/state", region)["response"]
        (OUT / "profile.json").write_text(json.dumps(profile, indent=2, ensure_ascii=False), encoding="utf-8")
        (OUT / "state.json").write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(state, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
