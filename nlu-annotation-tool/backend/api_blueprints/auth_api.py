import os
import json
from flask import Blueprint, request, jsonify

from auth import jwt_utils
from . import ensure_workspace_dirs

bp = Blueprint('auth_api', __name__)

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
USERS_FILE = os.path.join(BACKEND_DIR, 'users.json')


def _load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as fh:
            return json.load(fh)
    except Exception:
        return {}


def _save_users(users: dict):
    with open(USERS_FILE, 'w', encoding='utf-8') as fh:
        json.dump(users, fh, indent=2)


@bp.route('/register', methods=['POST'])
def register():
    payload = request.get_json(force=True) or {}
    email = payload.get('email')
    password = payload.get('password')
    if not email or not password:
        return jsonify({'error': 'missing_fields'}), 400

    users = _load_users()
    if email in users:
        return jsonify({'error': 'user_exists'}), 400

    import os, hashlib
    salt = os.urandom(8).hex()
    pw_hash = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    users[email] = {'salt': salt, 'hash': pw_hash}
    _save_users(users)
    token = jwt_utils.encode({'email': email})
    return jsonify({'ok': True, 'token': token})


@bp.route('/login', methods=['POST'])
def login():
    payload = request.get_json(force=True) or {}
    email = payload.get('email')
    password = payload.get('password')
    if not email or not password:
        return jsonify({'error': 'missing_fields'}), 400
    users = _load_users()
    rec = users.get(email)
    if not rec:
        return jsonify({'error': 'invalid_credentials'}), 401
    import hashlib
    salt = rec.get('salt', '')
    pw_hash = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    if pw_hash != rec.get('hash'):
        return jsonify({'error': 'invalid_credentials'}), 401
    token = jwt_utils.encode({'email': email})
    return jsonify({'ok': True, 'token': token})


@bp.route('/verify', methods=['GET'])
def verify():
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        token = auth.split(' ', 1)[1]
    else:
        return jsonify({'ok': False, 'error': 'missing_token'}), 401
    try:
        payload = jwt_utils.decode(token)
        return jsonify({'ok': True, 'user': {'email': payload.get('email')}})
    except Exception:
        return jsonify({'ok': False, 'error': 'invalid_token'}), 401
