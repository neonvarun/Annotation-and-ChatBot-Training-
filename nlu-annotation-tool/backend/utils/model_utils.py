# backend/utils/model_utils.py
import os
import json
import random
import time
import shutil
import subprocess
from glob import glob
from typing import List
from datetime import datetime

# ---------- spaCy trainer (your existing function kept) ----------
def train_spacy_model(base_dir: str) -> str:
    """
    Train a minimal spaCy NER model from annotations.json and save to models/spacy_model/model_v{ts}
    """
    try:
        import spacy
        from spacy.training import Example
    except Exception as e:
        raise RuntimeError('spaCy is required for training: ' + str(e))

    backend_dir = os.path.join(base_dir, 'models')
    spacy_dir = os.path.join(backend_dir, 'spacy_model')
    os.makedirs(spacy_dir, exist_ok=True)

    data_file = os.path.join(base_dir, 'data', 'annotations.json')
    if not os.path.exists(data_file):
        raise FileNotFoundError('annotations.json not found')

    with open(data_file, 'r', encoding='utf-8') as fh:
        annotations = json.load(fh)

    # Prepare training examples: spaCy expects list of (text, {'entities': [(start,end,label), ...]})
    training_data = []
    labels = set()
    for ann in annotations:
        text = ann.get('text', '')
        ents = ann.get('entities', [])
        spacy_ents = []
        for e in ents:
            # Expect entity dict with start, end, label
            try:
                s = int(e.get('start'))
                en = int(e.get('end'))
                lab = str(e.get('label'))
                spacy_ents.append((s, en, lab))
                labels.add(lab)
            except Exception:
                continue
        if text:
            training_data.append((text, {'entities': spacy_ents}))

    if not training_data:
        raise RuntimeError('No training data available in annotations.json')

    # Create blank English model
    nlp = spacy.blank('en')

    if 'ner' not in nlp.pipe_names:
        ner = nlp.add_pipe('ner')
    else:
        ner = nlp.get_pipe('ner')

    for label in labels:
        ner.add_label(label)

    # Begin training
    optimizer = nlp.begin_training()

    # convert training data to spaCy Example objects for newer API
    examples = []
    for text, ann in training_data:
        doc = nlp.make_doc(text)
        examples.append(Example.from_dict(doc, ann))

    # Train for a small number of epochs
    for epoch in range(10):
        random.shuffle(examples)
        losses = {}
        for example in examples:
            nlp.update([example], sgd=optimizer, drop=0.35, losses=losses)
        print(f'[model_utils] epoch {epoch+1}/10, losses={losses}')

    # Save model
    timestamp = int(time.time())
    model_version_dir = os.path.join(spacy_dir, f'model_v{timestamp}')
    os.makedirs(model_version_dir, exist_ok=True)
    nlp.to_disk(model_version_dir)

    # write metadata
    meta = {'name': 'spacy_ner', 'version': f'v{timestamp}', 'trained_at': timestamp}
    with open(os.path.join(spacy_dir, f'meta_v{timestamp}.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, indent=2)

    return model_version_dir

def save_rasa_model_metadata(model_path: str, training_data: dict, model_performance: dict = None) -> None:
    """
    Save metadata for a trained Rasa model
    Args:
        model_path: Path to the trained Rasa model
        training_data: Dictionary containing training data statistics
        model_performance: Dictionary containing model performance metrics (optional)
    """
    metadata = {
        "model_info": {
            "created_at": datetime.now().isoformat(),
            "model_path": model_path,
            "model_size": os.path.getsize(model_path) if os.path.exists(model_path) else None,
        },
        "training_data": {
            "num_intents": training_data.get("num_intents", 0),
            "num_examples": training_data.get("num_examples", 0),
            "intents": training_data.get("intents", []),
            "entities": training_data.get("entities", [])
        },
        "training_timestamp": int(time.time())
    }
    
    if model_performance:
        metadata["model_performance"] = model_performance
    
    # Create metadata directory if it doesn't exist
    metadata_dir = os.path.join(os.path.dirname(model_path), "metadata")
    os.makedirs(metadata_dir, exist_ok=True)
    
    # Save metadata
    metadata_path = os.path.join(metadata_dir, "model_metadata.json")
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    
    # Also save a copy with timestamp for version tracking
    timestamp_metadata_path = os.path.join(
        metadata_dir, 
        f"model_metadata_{metadata['training_timestamp']}.json"
    )
    with open(timestamp_metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)

def get_training_data_stats(nlu_data_path: str) -> dict:
    """
    Extract training data statistics from nlu.yml
    Args:
        nlu_data_path: Path to the nlu.yml file
    Returns:
        Dictionary containing training data statistics
    """
    try:
        import yaml
        with open(nlu_data_path, 'r', encoding='utf-8') as f:
            nlu_data = yaml.safe_load(f)

        intents = set()
        entities = set()
        examples_count = 0

        for item in nlu_data.get('nlu', []):
            if 'intent' in item:
                intent_name = item['intent']
                intents.add(intent_name)
                examples = item.get('examples', '').split('\n')
                examples_count += len([ex for ex in examples if ex.strip()])

                # Extract entities from examples
                for example in examples:
                    if '[' in example and '](' in example:
                        entity_matches = example.split('[')
                        for match in entity_matches[1:]:
                            if '](' in match:
                                entity_type = match.split('](')[1].split(')')[0]
                                entities.add(entity_type)

        return {
            "num_intents": len(intents),
            "num_examples": examples_count,
            "intents": list(intents),
            "entities": list(entities)
        }
    except Exception as e:
        print(f"Error getting training data stats: {str(e)}")
        return {
            "num_intents": 0,
            "num_examples": 0,
            "intents": [],
            "entities": []
        }

    if not training_data:
        raise RuntimeError('No training data available in annotations.json')

    # Create blank English model
    import spacy
    nlp = spacy.blank('en')

    if 'ner' not in nlp.pipe_names:
        ner = nlp.add_pipe('ner')
    else:
        ner = nlp.get_pipe('ner')

    for label in labels:
        ner.add_label(label)

    # Begin training
    optimizer = nlp.begin_training()

    # convert training data to spaCy Example objects for newer API
    examples = []
    from spacy.training import Example
    for text, ann in training_data:
        doc = nlp.make_doc(text)
        examples.append(Example.from_dict(doc, ann))

    # Train for a small number of epochs
    for epoch in range(10):
        random.shuffle(examples)
        losses = {}
        for example in examples:
            nlp.update([example], sgd=optimizer, drop=0.35, losses=losses)
        print(f'[model_utils] epoch {epoch+1}/10, losses={losses}')

    # Save model
    timestamp = int(time.time())
    model_version_dir = os.path.join(spacy_dir, f'model_v{timestamp}')
    os.makedirs(model_version_dir, exist_ok=True)
    nlp.to_disk(model_version_dir)

    # write metadata
    meta = {'name': 'spacy_ner', 'version': f'v{timestamp}', 'trained_at': timestamp}
    with open(os.path.join(spacy_dir, f'meta_v{timestamp}.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, indent=2)

    return model_version_dir


# ---------- Rasa trainer + helpers ----------
def annotations_to_rasa_nlu(annotations: List[dict], rasa_project_path: str) -> str:
    """
    Convert annotations list into Rasa-style data/nlu.yml file inside rasa_project_path/data/nlu.yml
    annotations: list of {"text":..., "intent":..., "entities":[{"start":int,"end":int,"label":str}, ...]}
    Returns path to written nlu.yml
    """
    import yaml, os
    

    data_dir = os.path.join(rasa_project_path, "data")
    os.makedirs(data_dir, exist_ok=True)

    intents_map = {}
    for ann in annotations:
        text = ann.get("text", "").strip()
        if not text:
            continue

        intent = ann.get("intent", "unknown_intent")
        entities = ann.get("entities", [])

        if not entities:
            example = text
        else:
            spans = sorted(entities, key=lambda e: int(e.get("start", 0)))
            marked = ""
            last = 0
            for sp in spans:
                s = int(sp["start"])
                e = int(sp["end"])
                label = sp["label"]
                marked += text[last:s]
                marked += f"[{text[s:e]}]({label})"
                last = e
            marked += text[last:]
            example = marked

        intents_map.setdefault(intent, []).append(example)

    nlu_section = {"version": "3.1", "nlu": []}

    for intent, examples in intents_map.items():
        block = {
            "intent": intent,
            "examples": "\n".join(f"  - {ex}" for ex in examples)
        }

        nlu_section["nlu"].append(block)

    target = os.path.join(data_dir, "nlu.yml")

    with open(target, "w", encoding="utf-8") as f:
        f.write('version: "3.1"\n')
        f.write("nlu:\n")
        for intent, examples in intents_map.items():
            f.write(f"- intent: {intent}\n")
            f.write("  examples: |\n")
            for ex in examples:
                f.write(f"    - {ex}\n")


    return target



def _which_rasa_executable():
    """
    Return a command list to invoke rasa in the current environment.
    Prefer running rasa as a module with the same Python interpreter (sys.executable -m rasa)
    so the Flask process uses the same venv where rasa is installed.
    """
    import shutil, sys
    # if there is a system 'rasa' on PATH and it matches our sys.executable, use it;
    # otherwise prefer `sys.executable -m rasa` so it runs inside the same venv.
    rasa_path = shutil.which("rasa")
    if rasa_path:
        try:
            # quick check: run `rasa --version` via PATH rasa to see if it works
            return ["rasa"]
        except Exception:
            pass
    # fallback to module invocation via same Python interpreter
    return [sys.executable, "-m", "rasa"]


def find_latest_rasa_model(rasa_project_path: str):
    models_dir = os.path.join(rasa_project_path, "models")
    if not os.path.isdir(models_dir):
        return None
    gz = sorted(glob(os.path.join(models_dir, "*.tar.gz")), key=os.path.getmtime, reverse=True)
    return gz[0] if gz else None


def train_rasa_model(base_dir: str) -> str:
    """
    Robust Rasa training:
      - writes annotations -> rasa_project/data/nlu.yml (uses annotations_to_rasa_nlu)
      - backs up existing nlu.yml
      - runs `rasa train nlu` using the same Python interpreter (sys.executable -m rasa)
      - saves full logs to backend/models/rasa_model/training_log_{ts}.txt
      - copies produced .tar.gz into backend/models/rasa_model/
      - writes metadata.json and returns dest path
    """
    # allow override with env var for safety
    rasa_project_path = os.environ.get("RASA_PROJECT_PATH")
    if not rasa_project_path:
        # parent directory of backend (your layout: rasa_chatbot/)
        rasa_project_path = os.path.abspath(os.path.join(base_dir, "..", ".."))
    rasa_project_path = os.path.abspath(rasa_project_path)

    annotations_file = os.path.join(base_dir, "data", "annotations.json")
    dest_models_dir = os.path.join(base_dir, "models", "rasa_model")
    os.makedirs(dest_models_dir, exist_ok=True)

    if not os.path.exists(annotations_file):
        raise FileNotFoundError("annotations.json not found at: " + annotations_file)

    # load annotations
    with open(annotations_file, "r", encoding="utf-8") as fh:
        annotations = json.load(fh)

    # convert -> rasa/data/nlu.yml using your converter function
    # annotations_to_rasa_nlu is defined above in same file (keep it)
    nlu_path = annotations_to_rasa_nlu(annotations, rasa_project_path)

    # backup existing nlu.yml (if any)
    nlu_file = os.path.join(rasa_project_path, "data", "nlu.yml")
    try:
        if os.path.exists(nlu_file):
            backup = nlu_file + f".bak_{int(time.time())}"
            shutil.copy2(nlu_file, backup)
    except Exception:
        # not fatal, continue
        pass

    # build command to run rasa; prefer module invocation to use same venv
    rasa_cmd = _which_rasa_executable()
    cmd = rasa_cmd + ["train", "nlu"]  # faster: only NLU
    env = os.environ.copy()

    # run training synchronously and capture logs (so Flask returns clear errors)
    proc = subprocess.run(cmd, cwd=rasa_project_path, env=env, capture_output=True, text=True)
    stdout = proc.stdout or ""
    stderr = proc.stderr or ""

    ts = int(time.time())
    # save training logs for debugging
    log_file = os.path.join(dest_models_dir, f"training_log_{ts}.txt")
    with open(log_file, "w", encoding="utf-8") as lf:
        lf.write("CMD: " + " ".join(cmd) + "\n\n")
        lf.write("CWD: " + rasa_project_path + "\n\n")
        lf.write("=== STDOUT ===\n")
        lf.write(stdout + "\n\n")
        lf.write("=== STDERR ===\n")
        lf.write(stderr + "\n")

    if proc.returncode != 0:
        # raise with pointer to saved log so UI can show where to inspect
        raise RuntimeError(
            "Rasa training failed. See training log: "
            + log_file
            + "\n\nSTDERR:\n"
            + stderr[:4000]
            + "\n\nSTDOUT:\n"
            + stdout[:4000]
        )

    # find produced model in rasa project
    latest = find_latest_rasa_model(rasa_project_path)
    if not latest:
        raise RuntimeError("Rasa trained but no model file found in rasa_project/models. See log: " + log_file)

    # copy models from rasa project's models/ into backend models dir (include any new/older models)
    rasa_models = sorted(glob(os.path.join(rasa_project_path, "models", "*.tar.gz")), key=os.path.getmtime)
    copied = []
    for rm in rasa_models:
        name = os.path.basename(rm)
        dest = os.path.join(dest_models_dir, name)
        try:
            if not os.path.exists(dest):
                shutil.copy2(rm, dest)
            copied.append({
                "file": name,
                "original_model_path": rm,
                "trained_at": int(os.path.getmtime(rm)),
            })
        except Exception:
            # non-fatal: continue with others
            continue

    # ensure latest is present (guaranteed by copy above, but set dest_name/dest_path)
    dest_name = os.path.basename(latest)
    dest_path = os.path.join(dest_models_dir, dest_name)

    # write metadata for the most-recent training run (keeps compatibility)
    metadata = {
        "info": {"name": "rasa_model", "trained_at": ts, "version": f"v{ts}"},
        "file": dest_name,
        "original_model_path": latest,
        "training_log": log_file,
        "rasa_stdout_snippet": stdout[:4000],
        "rasa_stderr_snippet": stderr[:4000],
    }
    meta_file = os.path.join(dest_models_dir, "metadata.json")
    # Append new metadata entry instead of overwriting the file.
    # Preserve backward compatibility: if an existing metadata.json is a dict,
    # convert to a list of entries, then append the new one.
    try:
        if os.path.exists(meta_file):
            with open(meta_file, 'r', encoding='utf-8') as fh:
                existing_meta = json.load(fh)
        else:
            existing_meta = None
    except Exception:
        existing_meta = None

    if isinstance(existing_meta, dict):
        entries = [existing_meta]
    elif isinstance(existing_meta, list):
        entries = existing_meta
    else:
        entries = []

    entries.append(metadata)

    try:
        with open(meta_file, 'w', encoding='utf-8') as fh:
            json.dump(entries, fh, indent=2)
    except Exception:
        # If writing fails, fall back to writing single-object metadata to avoid losing latest info
        try:
            with open(meta_file, 'w', encoding='utf-8') as fh:
                json.dump(metadata, fh, indent=2)
        except Exception:
            pass

    # Maintain an index of all copied models with basic metadata
    index_file = os.path.join(dest_models_dir, "models_index.json")
    try:
        if os.path.exists(index_file):
            with open(index_file, 'r', encoding='utf-8') as idxf:
                index = json.load(idxf) or []
        else:
            index = []
    except Exception:
        index = []

    # Add/merge entries for copied models
    existing_files = {e.get('file'): e for e in index if isinstance(e, dict) and e.get('file')}
    for c in copied:
        fname = c['file']
        if fname in existing_files:
            # update original path/trained_at if changed
            existing_files[fname].setdefault('original_model_path', c.get('original_model_path'))
            existing_files[fname].setdefault('trained_at', c.get('trained_at'))
        else:
            index.append({
                'file': fname,
                'original_model_path': c.get('original_model_path'),
                'trained_at': c.get('trained_at')
            })

    # also ensure latest metadata entry is present (with training log and stdout/stderr)
    latest_entry = {
        'file': dest_name,
        'original_model_path': latest,
        'trained_at': ts,
        'training_log': log_file,
        'rasa_stdout_snippet': stdout[:4000],
        'rasa_stderr_snippet': stderr[:4000]
    }
    # replace or append latest
    replaced = False
    for i, e in enumerate(index):
        if e.get('file') == dest_name:
            index[i] = {**e, **latest_entry}
            replaced = True
            break
    if not replaced:
        index.append(latest_entry)

    # write back index
    try:
        with open(index_file, 'w', encoding='utf-8') as idxf:
            json.dump(index, idxf, indent=2)
    except Exception:
        # non-fatal
        pass

    return dest_path
