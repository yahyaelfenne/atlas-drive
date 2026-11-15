"""Run the local API with Linux .NET while preserving the Windows development DB."""
import json
import hashlib
import os
from pathlib import Path
import signal
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
STATE = Path.home() / '.local/share/location-ennour' / hashlib.sha256(str(ROOT).encode()).hexdigest()[:12]
DLL = STATE / 'api/AtlasDrive.Api.dll'
PIDFILE = STATE / 'process.json'

def running():
    try:
        state = json.loads(PIDFILE.read_text())
        pid = int(state['pid'])
        proc = Path(f'/proc/{pid}')
        if proc.joinpath('stat').read_text().split()[21] != state['started']:
            return None
        if str(DLL).encode() not in proc.joinpath('cmdline').read_bytes().split(b'\0'):
            return None
        return pid
    except (OSError, ValueError, KeyError):
        return None

if '--runtime-dir' in sys.argv:
    STATE.mkdir(parents=True, exist_ok=True)
    print(STATE)
    sys.exit(0)
if '--status' in sys.argv:
    sys.exit(0 if running() else 1)
if '--stop' in sys.argv:
    pid = running()
    if pid:
        os.kill(pid, signal.SIGTERM)
        for _ in range(100):
            if not running():
                break
            time.sleep(0.1)
    sys.exit(0)
if running():
    raise SystemExit('The project API is already running in WSL.')
if not DLL.is_file():
    raise SystemExit('Publish the Linux API before starting it.')
settings = json.loads((ROOT / '.local/settings.json').read_text(encoding='utf-8-sig'))
env = dict(os.environ)
env.update({
    'ASPNETCORE_ENVIRONMENT': 'Development',
    'ASPNETCORE_URLS': 'http://127.0.0.1:5180',
    'ConnectionStrings__DefaultConnection': 'Host=127.0.0.1;Port=5433;Database=atlas_drive;Username=atlas;Password=' + settings['DatabasePassword'],
    'Jwt__Key': settings['JwtKey'],
    'Ai__BaseUrl': 'http://127.0.0.1:8101',
    'Seed__AdminEmail': 'admin@atlasdrive.ma',
    'Seed__AdminPassword': 'AtlasAdmin2026!',
    'Seed__CustomerEmail': 'client@atlasdrive.ma',
    'Seed__CustomerPassword': 'AtlasClient2026!',
})
PIDFILE.write_text(json.dumps({'pid': os.getpid(), 'started': Path('/proc/self/stat').read_text().split()[21]}))
os.chdir(ROOT / 'backend')
os.execve('/usr/bin/dotnet', ['dotnet', str(DLL)], env)
