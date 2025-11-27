import os
import json

HERE = os.path.dirname(os.path.abspath(__file__))
WORKSPACES_ROOT = os.path.abspath(os.path.join(HERE, '..', 'workspaces'))


def ensure_workspace_dirs(workspace_id: str):
    base_dir = os.path.abspath(os.path.join(WORKSPACES_ROOT, workspace_id))
    os.makedirs(os.path.join(base_dir, 'data'), exist_ok=True)
    os.makedirs(os.path.join(base_dir, 'models', 'spacy_model'), exist_ok=True)
    os.makedirs(os.path.join(base_dir, 'models', 'rasa_model'), exist_ok=True)
    # seed empty files if missing
    for name, default in [
        ('annotations.json', []),
        ('intents.json', []),
        ('entities.json', [])
    ]:
        p = os.path.join(base_dir, 'data', name)
        if not os.path.exists(p):
            with open(p, 'w', encoding='utf-8') as f:
                json.dump(default, f, indent=2)
    return base_dir
