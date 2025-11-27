import os
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

from utils.tokenizer import tokenize_text
from utils.model_utils import train_spacy_model, train_rasa_model

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

ANNOTATIONS_FILE = os.path.join(DATA_DIR, 'annotations.json')
INTENTS_FILE = os.path.join(DATA_DIR, 'intents.json')
ENTITIES_FILE = os.path.join(DATA_DIR, 'entities.json')

# ensure data files exist
for f, default in [(ANNOTATIONS_FILE, []), (INTENTS_FILE, []), (ENTITIES_FILE, [])]:
    if not os.path.exists(f):
        with open(f, 'w', encoding='utf-8') as fh:
            json.dump(default, fh, indent=2)

app = Flask(__name__)
CORS(app)

# register new API blueprints (workspace, auth, training, models)
try:
    from api_blueprints.auth_api import bp as auth_bp
    from api_blueprints.workspace_api import bp as ws_bp
    from api_blueprints.train_api import bp as train_bp
    from api_blueprints.models_api import bp as models_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(ws_bp, url_prefix='/api')
    app.register_blueprint(train_bp, url_prefix='/api')
    app.register_blueprint(models_bp, url_prefix='/api')
except Exception as e:
    # non-fatal: if import fails keep legacy routes working, but print error for debugging
    import traceback, sys
    print('Failed to register API blueprints:', file=sys.stderr)
    traceback.print_exc()


def _load_annotations():
    with open(ANNOTATIONS_FILE, 'r', encoding='utf-8') as fh:
        return json.load(fh)


def _save_annotations(data):
    with open(ANNOTATIONS_FILE, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


@app.route('/save_annotation', methods=['POST'])
def save_annotation():
    payload = request.get_json(force=True)
    if not payload or 'text' not in payload:
        return jsonify({'error': 'Invalid payload, missing text'}), 400

    annotations = _load_annotations()
    annotations.append(payload)
    _save_annotations(annotations)
    return jsonify({'status': 'ok', 'saved': payload}), 201


@app.route('/train_model', methods=['POST'])
def train_model():
    payload = request.get_json(force=True) or {}
    backend = payload.get('backend', 'spacy')

    if backend == 'spacy':
        try:
            model_path = train_spacy_model(BASE_DIR)
            return jsonify({'status': 'ok', 'model': model_path}), 200
        except Exception as e:
            return jsonify({'error': 'training_failed', 'details': str(e)}), 500
    elif backend == 'rasa':
        try:
            model_path = train_rasa_model(BASE_DIR)
            return jsonify({'status': 'ok', 'model': model_path}), 200
        except Exception as e:
            return jsonify({'error': 'training_failed', 'details': str(e)}), 500
    else:
        return jsonify({'error': 'unknown_backend'}), 400


@app.route('/model_metadata', methods=['GET'])
def model_metadata():
    metadata = []
    # list models directory
    for root, dirs, files in os.walk(MODELS_DIR):
        # only top-level children
        break
    for name in os.listdir(MODELS_DIR):
        path = os.path.join(MODELS_DIR, name)
        if os.path.isdir(path):
            # look for meta.json or version folders
            meta = {'name': name, 'versions': []}
            for child in os.listdir(path):
                child_path = os.path.join(path, child)
                if os.path.isdir(child_path):
                    meta['versions'].append(child)
                elif child.lower().endswith('.json'):
                    try:
                        with open(child_path, 'r', encoding='utf-8') as fh:
                            meta['info'] = json.load(fh)
                    except Exception:
                        meta['info'] = {'file': child}
            metadata.append(meta)
    return jsonify({'models': metadata})


@app.route('/tokenize', methods=['POST'])
def tokenize():
    payload = request.get_json(force=True) or {}
    text = payload.get('text', '')
    if not text:
        return jsonify({'tokens': []})
    tokens = tokenize_text(text)
    return jsonify({'tokens': tokens})


# ========== MODULE 4: Active Learning, Admin & Deployment Routes ==========
try:
    from utils.active_learning import (
        load_uncertain_samples,
        save_uncertain_samples,
        mark_sample_reviewed,
        retrain_workspace,
        get_workspace_stats,
        load_annotations,
        get_workspace_dir
    )
    from api_blueprints.auth_api import _load_users
    
    @app.route('/api/active_learning/uncertain_samples', methods=['GET'])
    def get_uncertain():
        """Get uncertain samples for a workspace (active learning module)."""
        ws = request.args.get('workspace_id')
        if not ws:
            return jsonify({'error': 'missing workspace_id'}), 400
        samples = load_uncertain_samples(ws)
        return jsonify({'samples': samples})
    
    
    @app.route('/api/active_learning/mark_reviewed', methods=['POST'])
    def mark_reviewed():
        """Mark a sample as reviewed, re-annotated, or added to training set."""
        payload = request.get_json(force=True) or {}
        ws = payload.get('workspace_id')
        sample_id = payload.get('sample_id')
        action = payload.get('action')
        
        if not ws or not sample_id or not action:
            return jsonify({'error': 'missing workspace_id, sample_id, or action'}), 400
        
        result = mark_sample_reviewed(ws, sample_id, action)
        if 'error' in result:
            return jsonify(result), 400
        return jsonify(result)
    
    
    @app.route('/api/active_learning/retrain', methods=['POST'])
    def retrain():
        """Retrain model(s) for a workspace using active learning flow."""
        payload = request.get_json(force=True) or {}
        ws = payload.get('workspace_id')
        backend = payload.get('backend', 'both')
        
        if not ws:
            return jsonify({'error': 'missing workspace_id'}), 400
        
        if backend not in ['spacy', 'rasa', 'both']:
            return jsonify({'error': 'invalid backend; must be spacy, rasa, or both'}), 400
        
        result = retrain_workspace(ws, backend)
        return jsonify(result)
    
    
    @app.route('/api/admin/stats', methods=['GET'])
    def admin_stats():
        """Get admin statistics for a workspace."""
        ws = request.args.get('workspace_id')
        if not ws:
            return jsonify({'error': 'missing workspace_id'}), 400
        
        stats = get_workspace_stats(ws)
        return jsonify(stats)
    
    
    @app.route('/api/admin/users', methods=['GET'])
    def admin_users():
        """Get list of registered users."""
        try:
            users_data = _load_users()
            users_list = [{'email': email} for email in users_data.keys()]
            return jsonify({'users': users_list, 'total': len(users_list)})
        except Exception as e:
            print(f"[admin_users] Error loading users: {e}")
            return jsonify({'users': [], 'total': 0, 'error': 'Could not load user list'}), 200
    
    
    @app.route('/api/admin/model_health', methods=['GET'])
    def admin_model_health():
        """Get model health metrics for a workspace."""
        ws = request.args.get('workspace_id')
        if not ws:
            return jsonify({'error': 'missing workspace_id'}), 400
        
        stats = get_workspace_stats(ws)
        # Get per-workspace accuracy
        health = {
            'last_trained': stats.get('last_training_ts'),
            'model_versions': stats.get('model_versions', {'spacy': [], 'rasa': []}),
            'total_annotations': stats.get('total_annotations', 0),
            'total_intents': stats.get('num_intents', 0),
            'accuracy': stats.get('accuracy')
        }
        return jsonify(health)
    
    
    @app.route('/api/active_learning/avg_accuracy', methods=['GET'])
    def avg_accuracy():
        """Get average accuracy across all workspaces."""
        try:
            # Get list of workspaces from workspace directory
            from api_blueprints import WORKSPACES_ROOT
            workspaces = []
            if os.path.exists(WORKSPACES_ROOT):
                for name in os.listdir(WORKSPACES_ROOT):
                    p = os.path.join(WORKSPACES_ROOT, name)
                    if os.path.isdir(p):
                        workspaces.append(name)
            
            if not workspaces:
                return jsonify({'avg_accuracy': None, 'message': 'No workspaces found'})
            
            accuracies = []
            for ws in workspaces:
                stats = get_workspace_stats(ws)
                acc = stats.get('accuracy')
                if acc is not None:
                    accuracies.append(acc)
            
            if not accuracies:
                return jsonify({'avg_accuracy': None, 'message': 'No accuracy data available'})
            
            avg = sum(accuracies) / len(accuracies)
            return jsonify({
                'avg_accuracy': round(avg, 2),
                'workspace_count': len(workspaces),
                'workspaces_with_data': len(accuracies)
            })
        except Exception as e:
            print(f"[avg_accuracy] Error calculating average: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': str(e), 'avg_accuracy': None}), 500
    
    
    @app.route('/api/deployment/status', methods=['GET'])
    def deployment_status():
        """Get deployment status for a workspace."""
        ws = request.args.get('workspace_id')
        if not ws:
            return jsonify({'error': 'missing workspace_id'}), 400
        
        # Load deployment history from file
        import os
        import json
        from datetime import datetime
        
        ws_dir = get_workspace_dir(ws)
        deploy_file = os.path.join(ws_dir, 'deployment_history.json')
        
        deployment_data = {
            'version': '1.0.0',
            'last_deployed': None,
            'state': 'not_deployed',
            'message': 'No deployments yet',
            'history': []
        }
        
        if os.path.exists(deploy_file):
            try:
                with open(deploy_file, 'r', encoding='utf-8') as f:
                    deployment_data = json.load(f)
            except:
                pass
        
        return jsonify(deployment_data)
    
    
    @app.route('/api/deployment/build_docker', methods=['POST'])
    def build_docker():
        """Build a Docker image for the workspace."""
        data = request.get_json()
        ws = data.get('workspace_id')
        image_name = data.get('image_name', 'nlu-tool')
        tag = data.get('tag', 'latest')
        
        if not ws:
            return jsonify({'error': 'missing workspace_id'}), 400
        
        try:
            import subprocess
            import os
            
            # Get the nlu-annotation-tool directory (parent of backend/)
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(backend_dir)
            dockerfile_path = os.path.join(project_root, 'Dockerfile')
            
            print(f"[deployment] Backend dir: {backend_dir}")
            print(f"[deployment] Project root: {project_root}")
            print(f"[deployment] Dockerfile path: {dockerfile_path}")
            
            if not os.path.exists(dockerfile_path):
                return jsonify({
                    'status': 'error',
                    'message': f'Dockerfile not found at: {dockerfile_path}'
                }), 404
            
            # Check if Docker is available
            try:
                docker_check = subprocess.run(
                    ['docker', '--version'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if docker_check.returncode != 0:
                    return jsonify({
                        'status': 'error',
                        'message': 'Docker is not running or not accessible'
                    }), 500
            except FileNotFoundError:
                return jsonify({
                    'status': 'error',
                    'message': 'Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop'
                }), 500
            except subprocess.TimeoutExpired:
                return jsonify({
                    'status': 'error',
                    'message': 'Docker command timed out. Make sure Docker Desktop is running.'
                }), 500
            
            full_image_name = f"{image_name}:{tag}"
            
            print(f"[deployment] Building Docker image: {full_image_name}")
            
            # Build the Docker image
            result = subprocess.run(
                ['docker', 'build', '-t', full_image_name, '-f', dockerfile_path, project_root],
                capture_output=True,
                text=True,
                cwd=project_root,
                timeout=300  # 5 minute timeout
            )
            
            print(f"[deployment] Docker build return code: {result.returncode}")
            print(f"[deployment] Docker build stdout: {result.stdout[:500] if result.stdout else 'None'}")
            print(f"[deployment] Docker build stderr: {result.stderr[:500] if result.stderr else 'None'}")
            
            if result.returncode == 0:
                # Get image size and ID
                inspect_result = subprocess.run(
                    ['docker', 'inspect', full_image_name, '--format', '{{.Size}}'],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                size_bytes = 0
                if inspect_result.returncode == 0 and inspect_result.stdout:
                    try:
                        size_bytes = int(inspect_result.stdout.strip())
                    except:
                        size_bytes = 0
                
                size_mb = round(size_bytes / (1024 * 1024), 2) if size_bytes > 0 else 0
                
                stdout_text = result.stdout if result.stdout else ''
                output_text = stdout_text[-1000:] if len(stdout_text) > 1000 else stdout_text
                
                return jsonify({
                    'status': 'success',
                    'message': f'Docker image built successfully: {full_image_name}',
                    'image_name': full_image_name,
                    'size_mb': size_mb,
                    'output': output_text
                })
            else:
                error_msg = result.stderr if result.stderr else (result.stdout if result.stdout else 'Unknown error')
                stdout_msg = result.stdout if result.stdout else ''
                
                # Check for common Docker errors
                if 'dockerDesktopLinuxEngine' in error_msg or 'pipe' in error_msg or 'cannot find the file' in error_msg:
                    return jsonify({
                        'status': 'error',
                        'message': 'Docker Desktop is not running. Please start Docker Desktop and try again.',
                        'error': error_msg[-2000:] if len(error_msg) > 2000 else error_msg
                    }), 500
                elif 'docker' not in error_msg.lower():
                    return jsonify({
                        'status': 'error',
                        'message': 'Docker build failed. Make sure Docker Desktop is running.',
                        'error': error_msg[-2000:] if len(error_msg) > 2000 else error_msg
                    }), 500
                else:
                    return jsonify({
                        'status': 'error',
                        'message': 'Docker build failed',
                        'error': error_msg[-2000:] if len(error_msg) > 2000 else error_msg,
                        'output': stdout_msg[-1000:] if len(stdout_msg) > 1000 else stdout_msg
                    }), 500
                
        except subprocess.TimeoutExpired:
            return jsonify({
                'status': 'error',
                'message': 'Docker build timed out after 5 minutes'
            }), 500
        except Exception as e:
            print(f"[deployment] Error building Docker image: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'status': 'error',
                'message': f'Unexpected error: {str(e)}'
            }), 500
    
    
    @app.route('/api/deployment/push_docker', methods=['POST'])
    def push_docker():
        """Push Docker image to registry."""
        data = request.get_json()
        ws = data.get('workspace_id')
        image_name = data.get('image_name', 'nlu-tool:latest')
        username = data.get('username', '')
        repo_name = data.get('repo_name', 'nlu-tool')
        
        if not ws:
            return jsonify({'error': 'missing workspace_id'}), 400
        
        if not username:
            return jsonify({
                'status': 'error',
                'message': 'Registry username is required'
            }), 400
        
        try:
            import subprocess
            
            # Tag the image for registry
            registry_tag = f"{username}/{repo_name}:latest"
            
            print(f"[deployment] Tagging image {image_name} as {registry_tag}")
            
            tag_result = subprocess.run(
                ['docker', 'tag', image_name, registry_tag],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if tag_result.returncode != 0:
                error_msg = tag_result.stderr if tag_result.stderr else 'Tag failed'
                return jsonify({
                    'status': 'error',
                    'message': f'Failed to tag image: {error_msg}'
                }), 500
            
            print(f"[deployment] Pushing image {registry_tag} to DockerHub")
            
            # Push the image
            push_result = subprocess.run(
                ['docker', 'push', registry_tag],
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes timeout for push
            )
            
            stdout_msg = push_result.stdout if push_result.stdout else ''
            stderr_msg = push_result.stderr if push_result.stderr else ''
            
            print(f"[deployment] Push return code: {push_result.returncode}")
            
            if push_result.returncode == 0:
                return jsonify({
                    'status': 'success',
                    'message': f'Image pushed successfully to DockerHub: {registry_tag}',
                    'registry_tag': registry_tag,
                    'output': stdout_msg[-1000:] if len(stdout_msg) > 1000 else stdout_msg
                })
            else:
                # Check if login is required
                if 'denied' in stderr_msg.lower() or 'unauthorized' in stderr_msg.lower():
                    return jsonify({
                        'status': 'error',
                        'message': 'Push failed: Please login to DockerHub first. Run "docker login" in terminal.',
                        'error': stderr_msg[-2000:] if len(stderr_msg) > 2000 else stderr_msg
                    }), 500
                else:
                    return jsonify({
                        'status': 'error',
                        'message': 'Push failed',
                        'error': stderr_msg[-2000:] if len(stderr_msg) > 2000 else stderr_msg,
                        'output': stdout_msg[-1000:] if len(stdout_msg) > 1000 else stdout_msg
                    }), 500
                
        except subprocess.TimeoutExpired:
            return jsonify({
                'status': 'error',
                'message': 'Push timed out after 10 minutes'
            }), 500
        except Exception as e:
            print(f"[deployment] Error pushing Docker image: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'status': 'error',
                'message': f'Unexpected error: {str(e)}'
            }), 500
    
    
    @app.route('/api/deployment/deploy_container', methods=['POST'])
    def deploy_container():
        """Deploy Docker container locally."""
        data = request.get_json()
        ws = data.get('workspace_id')
        image_name = data.get('image_name', 'nlu-tool:latest')
        container_name = data.get('container_name', 'nlu-tool-container')
        port_mapping = data.get('port_mapping', '8080:5000')
        
        if not ws:
            return jsonify({'error': 'missing workspace_id'}), 400
        
        try:
            import subprocess
            
            # Stop and remove existing container if it exists
            print(f"[deployment] Checking for existing container: {container_name}")
            stop_result = subprocess.run(
                ['docker', 'stop', container_name],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            remove_result = subprocess.run(
                ['docker', 'rm', container_name],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Run new container
            print(f"[deployment] Deploying container: {container_name} from image: {image_name}")
            print(f"[deployment] Port mapping: {port_mapping}")
            
            run_result = subprocess.run(
                ['docker', 'run', '-d', '--name', container_name, '-p', port_mapping, image_name],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            stdout_msg = run_result.stdout if run_result.stdout else ''
            stderr_msg = run_result.stderr if run_result.stderr else ''
            
            print(f"[deployment] Deploy return code: {run_result.returncode}")
            
            if run_result.returncode == 0:
                container_id = stdout_msg.strip()[:12] if stdout_msg else 'unknown'
                
                # Save deployment history
                import os
                import json
                from datetime import datetime
                
                ws_dir = get_workspace_dir(ws)
                deploy_file = os.path.join(ws_dir, 'deployment_history.json')
                
                timestamp = datetime.now().isoformat()
                
                deployment_record = {
                    'timestamp': timestamp,
                    'image_name': image_name,
                    'container_name': container_name,
                    'container_id': container_id,
                    'port_mapping': port_mapping,
                    'status': 'success'
                }
                
                # Load existing history
                deployment_data = {
                    'version': '1.0.0',
                    'last_deployed': timestamp,
                    'state': 'deployed',
                    'message': f'Container {container_name} is running',
                    'history': []
                }
                
                if os.path.exists(deploy_file):
                    try:
                        with open(deploy_file, 'r', encoding='utf-8') as f:
                            deployment_data = json.load(f)
                    except:
                        pass
                
                # Update deployment data
                deployment_data['last_deployed'] = timestamp
                deployment_data['state'] = 'deployed'
                deployment_data['message'] = f'Container {container_name} is running on port {port_mapping}'
                deployment_data['history'].insert(0, deployment_record)  # Add to beginning
                
                # Keep only last 10 deployments
                deployment_data['history'] = deployment_data['history'][:10]
                
                # Save to file
                os.makedirs(ws_dir, exist_ok=True)
                with open(deploy_file, 'w', encoding='utf-8') as f:
                    json.dump(deployment_data, f, indent=2)
                
                return jsonify({
                    'status': 'success',
                    'message': f'Container deployed successfully: {container_name}',
                    'container_name': container_name,
                    'container_id': container_id,
                    'port_mapping': port_mapping,
                    'output': f'Container ID: {container_id}\\nPort: {port_mapping}\\nAccess at: http://localhost:{port_mapping.split(":")[0]}'
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'Deployment failed',
                    'error': stderr_msg[-2000:] if len(stderr_msg) > 2000 else stderr_msg,
                    'output': stdout_msg[-1000:] if len(stdout_msg) > 1000 else stdout_msg
                }), 500
                
        except subprocess.TimeoutExpired:
            return jsonify({
                'status': 'error',
                'message': 'Deployment timed out'
            }), 500
        except Exception as e:
            print(f"[deployment] Error deploying container: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'status': 'error',
                'message': f'Unexpected error: {str(e)}'
            }), 500
    
    print("[MODULE4] Active Learning, Admin & Deployment routes registered successfully")
    
except Exception as e:
    print(f"[MODULE4] Error registering Module 4 routes: {e}")
    import traceback
    traceback.print_exc()


# Root route for API info
@app.route('/')
def index():
    """Root route - API information and status"""
    return jsonify({
        "message": "NLU Annotation Tool API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "auth": {
                "login": "POST /api/auth/login",
                "register": "POST /api/auth/register"
            },
            "workspaces": {
                "list": "GET /api/workspaces",
                "create": "POST /api/workspaces",
                "select": "GET /api/workspace/select?id=<workspace_id>"
            },
            "annotations": {
                "list": "GET /api/annotations",
                "save": "POST /api/annotations"
            },
            "training": {
                "train": "POST /api/train",
                "status": "GET /api/train/status"
            },
            "models": {
                "list": "GET /api/models",
                "predict": "POST /api/models/predict"
            },
            "admin": {
                "stats": "GET /api/admin/stats?workspace_id=<id>",
                "users": "GET /api/admin/users",
                "model_health": "GET /api/admin/model_health?workspace_id=<id>"
            },
            "active_learning": {
                "uncertain_samples": "GET /api/active_learning/uncertain_samples?workspace_id=<id>",
                "retrain": "POST /api/active_learning/retrain",
                "avg_accuracy": "GET /api/active_learning/avg_accuracy"
            },
            "deployment": {
                "status": "GET /api/deployment/status?workspace_id=<id>",
                "build_docker": "POST /api/deployment/build_docker",
                "push_docker": "POST /api/deployment/push_docker",
                "deploy_container": "POST /api/deployment/deploy_container"
            }
        },
        "documentation": "Visit /api/docs for detailed API documentation"
    })


if __name__ == '__main__':
    # Run on port 5000 as specified
    app.run(host='0.0.0.0', port=5000, debug=True)
