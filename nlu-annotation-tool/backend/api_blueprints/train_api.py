import os
import json
from flask import Blueprint, request, jsonify

from . import ensure_workspace_dirs
from utils.model_utils import train_spacy_model, train_rasa_model

bp = Blueprint('train_api', __name__)


@bp.route('/train', methods=['POST'])
def train():
    payload = request.get_json(force=True) or {}
    ws = payload.get('workspace_id')
    backend = payload.get('backend', 'rasa')
    if not ws:
        return jsonify({'error': 'missing workspace_id'}), 400
    base = ensure_workspace_dirs(ws)

    try:
        # Ensure Rasa runs from the repository root (where config.yml lives) when not overridden.
        # train_rasa_model checks RASA_PROJECT_PATH env var first; set it here if missing.
        if 'RASA_PROJECT_PATH' not in os.environ:
            # project root is three levels above this file: backend/api_blueprints -> backend -> nlu-annotation-tool -> repo root
            repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
            os.environ['RASA_PROJECT_PATH'] = repo_root

        if backend == 'spacy':
            model_path = train_spacy_model(base)
        else:
            model_path = train_rasa_model(base)
        return jsonify({'status': 'ok', 'model': model_path})
    except Exception as e:
        return jsonify({'error': 'training_failed', 'details': str(e)}), 500


@bp.route('/train/status', methods=['GET'])
def status():
    # simple placeholder; if you have SSE integration elsewhere keep it
    return jsonify({'status': 'unknown'})
