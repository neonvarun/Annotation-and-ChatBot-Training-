import os
import json
from flask import Blueprint, request, jsonify

from . import ensure_workspace_dirs, WORKSPACES_ROOT

bp = Blueprint('workspace_api', __name__)


@bp.route('/workspaces', methods=['GET'])
def list_workspaces():
    os.makedirs(WORKSPACES_ROOT, exist_ok=True)
    items = []
    try:
        for name in os.listdir(WORKSPACES_ROOT):
            p = os.path.join(WORKSPACES_ROOT, name)
            if os.path.isdir(p):
                items.append(name)
    except Exception:
        pass
    return jsonify({'workspaces': items})


@bp.route('/workspaces', methods=['POST'])
def create_workspace():
    payload = request.get_json(force=True) or {}
    name = payload.get('name')
    if not name:
        return jsonify({'error': 'missing_name'}), 400
    # sanitize name a little
    safe = ''.join([c for c in name if c.isalnum() or c in ['-', '_']]).strip()
    if not safe:
        return jsonify({'error': 'invalid_name'}), 400
    base = ensure_workspace_dirs(safe)
    return jsonify({'id': safe, 'path': base})


@bp.route('/annotations', methods=['POST'])
def post_annotation():
    payload = request.get_json(force=True) or {}
    ws = payload.get('workspace_id')
    if not ws:
        return jsonify({'error': 'missing workspace_id'}), 400
    base = ensure_workspace_dirs(ws)
    ann_file = os.path.join(base, 'data', 'annotations.json')
    try:
        with open(ann_file, 'r', encoding='utf-8') as fh:
            data = json.load(fh) or []
    except Exception:
        data = []
    # shape should be preserved
    data.append(payload)
    with open(ann_file, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, indent=2)
    return jsonify({'ok': True, 'saved': payload})


@bp.route('/annotations', methods=['GET'])
def get_annotations():
    ws = request.args.get('workspace_id')
    if not ws:
        return jsonify({'error': 'missing workspace_id'}), 400
    base = ensure_workspace_dirs(ws)
    ann_file = os.path.join(base, 'data', 'annotations.json')
    try:
        with open(ann_file, 'r', encoding='utf-8') as fh:
            data = json.load(fh) or []
    except Exception:
        data = []
    return jsonify({'annotations': data})
