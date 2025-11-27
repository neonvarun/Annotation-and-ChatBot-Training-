import os
import json
from flask import Blueprint, request, jsonify

from . import ensure_workspace_dirs

bp = Blueprint('models_api', __name__)


@bp.route('/models', methods=['GET'])
def list_models():
    ws = request.args.get('workspace_id')
    if not ws:
        return jsonify({'error': 'missing workspace_id'}), 400
    base = ensure_workspace_dirs(ws)
    models_dir = os.path.join(base, 'models', 'rasa_model')
    result = {'models': []}
    try:
        # look for models_index.json first
        idx = os.path.join(models_dir, 'models_index.json')
        if os.path.exists(idx):
            with open(idx, 'r', encoding='utf-8') as fh:
                result['models'] = json.load(fh)
                return jsonify(result)
        # fallback: inspect folder
        if os.path.isdir(models_dir):
            for fname in os.listdir(models_dir):
                if fname.endswith('.tar.gz'):
                    p = os.path.join(models_dir, fname)
                    result['models'].append({'file': fname, 'trained_at': int(os.path.getmtime(p)), 'path': p})
    except Exception:
        pass
    return jsonify(result)
