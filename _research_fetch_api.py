import socket, ssl, json, sys

def tunnel_request(host, path, sni=None):
    """Return (status_line, headers_dict, body_bytes) via CONNECT tunnel."""
    s = socket.create_connection(('127.0.0.1', 7890), timeout=12)
    s.sendall(f'CONNECT {host}:443 HTTP/1.1\r\nHost: {host}:443\r\n\r\n'.encode())
    s.settimeout(25)
    resp = s.recv(4096)
    if b'200' not in resp:
        s.close()
        return None, {}, None
    ctx = ssl.create_default_context()
    tls = ctx.wrap_socket(s, server_hostname=sni or host)
    tls.sendall(
        f'GET {path} HTTP/1.1\r\nHost: {sni or host}\r\nUser-Agent: research/1.0\r\nAccept: */*\r\nConnection: close\r\n\r\n'.encode()
    )
    buf = b''
    while True:
        c = tls.recv(65536)
        if not c:
            break
        buf += c
    tls.close()
    head, _, body = buf.partition(b'\r\n\r\n')
    lines = head.split(b'\r\n')
    status = lines[0].decode('utf-8', 'replace')
    headers = {}
    for l in lines[1:]:
        if b':' in l:
            k, _, v = l.partition(b':')
            headers[k.decode('utf-8', 'replace').strip().lower()] = v.decode('utf-8', 'replace').strip()
    if headers.get('transfer-encoding', '').lower() == 'chunked':
        out = b''
        pos = 0
        while True:
            # find chunk size line
            idx = body.find(b'\r\n', pos)
            size = int(body[pos:idx].split(b';')[0], 16)
            pos = idx + 2
            if size == 0:
                break
            out += body[pos:pos + size]
            pos += size + 2
        body = out
    return status, headers, body

def fetch(host, path, label):
    status, headers, body = tunnel_request(host, path)
    if body is None:
        print(f'[FAIL] {label} :: {status or "connect failed"}')
        return None
    ct = headers.get('content-type', '')
    cors = headers.get('access-control-allow-origin', headers.get('access-control-allow-headers', '-'))
    print(f'[{status}] {label} :: bytes={len(body)} CORS={cors}')
    return body

base = 'https://static.nanoka.cc'
# 1. manifest
mb = fetch('static.nanoka.cc', '/manifest.json', 'GET /manifest.json')
manifest = json.loads(mb) if mb else None
zzz = manifest.get('zzz', {}) if manifest else {}
print('ZZZ manifest:', json.dumps(zzz, ensure_ascii=False))
latest = zzz.get('latest')

# 2. character list (in_data)
if latest:
    cb = fetch('static.nanoka.cc', f'/zzz/{latest}/character.json', f'GET /zzz/{latest}/character.json')
    if cb:
        chars = json.loads(cb)
        print('character count:', len(chars))
        k = list(chars.keys())[0]
        print('first char id:', k)
        print('first char raw sample:', json.dumps(chars[k], ensure_ascii=False)[:900])
        open(r'C:\Users\28529\Desktop\zzz wiki\_research_char_list.json', 'wb').write(json.dumps(chars, ensure_ascii=False, indent=1)[:200000].encode('utf-8'))

    # 3. character detail EN
    db = fetch('static.nanoka.cc', f'/zzz/{latest}/en/character/1041.json', f'GET /zzz/{latest}/en/character/1041.json')
    if db:
        detail = json.loads(db)
        print('detail keys:', list(detail.keys())[:40])
        open(r'C:\Users\28529\Desktop\zzz wiki\_research_char_detail_1041.json', 'wb').write(json.dumps(detail, ensure_ascii=False, indent=1)[:300000].encode('utf-8'))

    # 4. weapon list
    wb = fetch('static.nanoka.cc', f'/zzz/{latest}/weapon.json', f'GET /zzz/{latest}/weapon.json')
    if wb:
        weapons = json.loads(wb)
        wk = list(weapons.keys())[0]
        print('weapon count:', len(weapons), 'sample:', json.dumps(weapons[wk], ensure_ascii=False)[:400])
        open(r'C:\Users\28529\Desktop\zzz wiki\_research_weapon_list.json', 'wb').write(json.dumps(weapons[wk], ensure_ascii=False, indent=1).encode('utf-8'))

    # 5. bangboo list
    bb = fetch('static.nanoka.cc', f'/zzz/{latest}/bangboo.json', f'GET /zzz/{latest}/bangboo.json')
    if bb:
        bangboos = json.loads(bb)
        print('bangboo count:', len(bangboos))

    # 6. equipment (drive disc) list
    eb = fetch('static.nanoka.cc', f'/zzz/{latest}/equipment.json', f'GET /zzz/{latest}/equipment.json')
    if eb:
        disc = json.loads(eb)
        print('disc count:', len(disc))

# 7. item (static)
itb = fetch('static.nanoka.cc', '/zzz/item.json', 'GET /zzz/item.json')
if itb:
    items = json.loads(itb)
    print('item count:', len(items))

# 8. asset host check
fetch('static.nanoka.cc', '/zzz/UI/IconRole01.webp', 'GET /zzz/UI/IconRole01.webp')

# 9. old-style path check
fetch('static.nanoka.cc', '/zzz/data/character.json', 'GET /zzz/data/character.json (old scheme probe)')