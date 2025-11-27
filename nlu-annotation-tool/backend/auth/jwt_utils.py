import os
import time
import json
import hmac
import hashlib
import base64

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret-change-me')
JWT_ALG = 'HS256'


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=') .decode('ascii')


def _b64decode(data: str) -> bytes:
    rem = len(data) % 4
    if rem:
        data += '=' * (4 - rem)
    return base64.urlsafe_b64decode(data.encode('ascii'))


def encode(payload: dict, exp_seconds: int = 3600) -> str:
    payload = dict(payload)
    payload['exp'] = int(time.time()) + int(exp_seconds)
    header = {'alg': JWT_ALG, 'typ': 'JWT'}
    header_b = _b64encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b = _b64encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    to_sign = f"{header_b}.{payload_b}".encode('ascii')
    sig = hmac.new(JWT_SECRET.encode('utf-8'), to_sign, hashlib.sha256).digest()
    sig_b = _b64encode(sig)
    return f"{header_b}.{payload_b}.{sig_b}"


def decode(token: str) -> dict:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            raise ValueError('Invalid token')
        header_b, payload_b, sig_b = parts
        to_sign = f"{header_b}.{payload_b}".encode('ascii')
        expected = hmac.new(JWT_SECRET.encode('utf-8'), to_sign, hashlib.sha256).digest()
        sig = _b64decode(sig_b)
        if not hmac.compare_digest(expected, sig):
            raise ValueError('Invalid signature')
        payload = json.loads(_b64decode(payload_b).decode('utf-8'))
        if 'exp' in payload and int(time.time()) > int(payload['exp']):
            raise ValueError('Token expired')
        return payload
    except Exception:
        raise
