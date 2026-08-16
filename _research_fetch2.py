import socket, ssl

def tunnel_get(host, path, sni=None):
    s = socket.create_connection(('127.0.0.1', 7890), timeout=10)
    s.sendall(f'CONNECT {host}:443 HTTP/1.1\r\nHost: {host}:443\r\n\r\n'.encode())
    s.settimeout(20)
    resp = s.recv(4096)
    if b'200' not in resp:
        print('CONNECT FAIL', host, resp.split(b'\r\n')[0]); s.close(); return None
    ctx = ssl.create_default_context()
    tls = ctx.wrap_socket(s, server_hostname=sni or host)
    tls.sendall(f'GET {path} HTTP/1.1\r\nHost: {sni or host}\r\nUser-Agent: research/1.0\r\nAccept: */*\r\nConnection: close\r\n\r\n'.encode())
    buf = b''
    while True:
        c = tls.recv(16384)
        if not c: break
        buf += c
    tls.close()
    return buf

targets = [
    ('hakushin/clients/zzz.py', r'C:\Users\28529\Desktop\zzz wiki\_research_clients_zzz.py'),
    ('hakushin/clients/base.py', r'C:\Users\28529\Desktop\zzz wiki\_research_clients_base.py'),
    ('hakushin/constants.py', r'C:\Users\28529\Desktop\zzz wiki\_research_constants.py'),
    ('hakushin/models/zzz/character.py', r'C:\Users\28529\Desktop\zzz wiki\_research_m_character.py'),
    ('hakushin/models/zzz/bangboo.py', r'C:\Users\28529\Desktop\zzz wiki\_research_m_bangboo.py'),
    ('hakushin/models/zzz/disc.py', r'C:\Users\28529\Desktop\zzz wiki\_research_m_disc.py'),
    ('hakushin/models/zzz/weapon.py', r'C:\Users\28529\Desktop\zzz wiki\_research_m_weapon.py'),
    ('hakushin/models/zzz/common.py', r'C:\Users\28529\Desktop\zzz wiki\_research_m_common.py'),
    ('hakushin/models/zzz/items.py', r'C:\Users\28529\Desktop\zzz wiki\_research_m_items.py'),
    ('hakushin/models/zzz/new.py', r'C:\Users\28529\Desktop\zzz wiki\_research_m_new.py'),
    ('hakushin/models/zzz/__init__.py', r'C:\Users\28529\Desktop\zzz wiki\_research_m_init.py'),
    ('hakushin/__init__.py', r'C:\Users\28529\Desktop\zzz wiki\_research_init.py'),
    ('hakushin/utils.py', r'C:\Users\28529\Desktop\zzz wiki\_research_utils.py'),
    ('tests/test_models/test_zzz.py', r'C:\Users\28529\Desktop\zzz wiki\_research_test_zzz.py'),
]
base = 'https://raw.githubusercontent.com/seriaati/hakushin-py/main/'
for path, save in targets:
    buf = tunnel_get('raw.githubusercontent.com', base + path)
    if buf:
        with open(save, 'wb') as f:
            f.write(buf)
        # strip HTTP headers
        head, _, body = buf.partition(b'\r\n\r\n')
        status = head.split(b'\r\n')[0].decode('utf-8', 'replace')
        print('OK' if b' 200 ' in head else 'NON200', status, path, 'body', len(body))
    else:
        print('FAILED', path)