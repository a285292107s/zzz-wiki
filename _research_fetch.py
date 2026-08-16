import socket, ssl, sys, os

def tunnel_get(host, path, sni=None, save=None, tls_ok=True):
    try:
        s = socket.create_connection(('127.0.0.1', 7890), timeout=10)
        s.sendall(f'CONNECT {host}:443 HTTP/1.1\r\nHost: {host}:443\r\n\r\n'.encode())
        s.settimeout(15)
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
        print('ERR', host, path, type(e).__name__, e)
        return None

if __name__ == '__main__':
    targets = [
        ('raw.githubusercontent.com', '/seriaati/hakushin-py/main/hakushin/zzz.py', r'C:\Users\28529\Desktop\zzz wiki\_research_zzz.py'),
        ('raw.githubusercontent.com', '/seriaati/hakushin-py/main/hakushin/client.py', r'C:\Users\28529\Desktop\zzz wiki\_research_client.py'),
        ('raw.githubusercontent.com', '/seriaati/hakushin-py/main/hakushin/models/zzz.py', r'C:\Users\28529\Desktop\zzz wiki\_research_models_zzz.py'),
        ('raw.githubusercontent.com', '/seriaati/hakushin-py/main/README.md', r'C:\Users\28529\Desktop\zzz wiki\_research_README.md'),
    ]
    for host, path, save in targets:
        buf = tunnel_get(host, path)
        if buf:
            with open(save, 'wb') as f:
                f.write(buf)
            print('SAVED', save, len(buf), 'bytes')
        else:
            print('FAILED', host, path)