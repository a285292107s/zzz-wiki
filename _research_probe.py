import socket, ssl

def tunnel_get(host, path, sni=None):
    try:
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
    except Exception as e:
        print('ERR', host, type(e).__name__, str(e)[:150])
        return None

targets = [
    ('hakush.in', '/zzz/character'),
    ('www.hakush.in', '/zzz/character'),
    ('static.nanoka.cc', '/manifest.json'),
    ('nanoka.cc', '/zzz'),
    ('nankoa.cc', '/zzz'),
]
for host, path in targets:
    buf = tunnel_get(host, path)
    if buf:
        head, _, body = buf.partition(b'\r\n\r\n')
        status = head.split(b'\r\n')[0].decode('utf-8', 'replace')
        print('==', host, path, '->', status, 'body', len(body))
        fname = host.replace('.', '_')
        open(rf'C:\Users\28529\Desktop\zzz wiki\_research_probe_{fname}.bin', 'wb').write(buf)
        # print interesting headers
        for line in head.split(b'\r\n'):
            l = line.decode('utf-8', 'replace')
            if any(k in l.lower() for k in ('access-control', 'server', 'content-type', 'cache-control', 'content-encoding', 'location')):
                print('   ', l)
        if b' 200 ' in head:
            print('   body head:', body[:250].decode('utf-8', 'replace'))