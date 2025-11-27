NLU Training Platform + Rasa Chatbot

A complete end-to-end system for NLU annotation, active learning, model training, workspace management, and chatbot interaction, combining:

Flask – Backend API, authentication, workspace handling

Rasa NLU – Intent classification & entity extraction

spaCy – Custom NER training

Active Learning – Detect uncertain predictions & re-annotation

Admin Dashboard – Model health, stats, and workspace overview

Deployment Pipeline UI – Visual CI/CD simulation

Chatbot UI (E-commerce) – Interactive bot interface

This platform supports the full workflow:
Annotate → Train → Review → Retrain → Deploy → Chat.

📌 Table of Contents

Overview

Features

Project Workflow

Project Structure

Installation

How It Works

Active Learning Cycle

Chatbot UI (E-Commerce)

API Endpoints

Screenshots

Future Enhancements

Overview

The platform provides a multi-workspace NLU training system where each workspace maintains its own:

annotations.json

NLU training data

Rasa and spaCy model versions

Uncertain sample set

Metadata files

With this, you can manage multiple projects independently.

Features
1. 🔐 Authentication (JWT-Based)

User registration & login

Secure JWT tokens

Redirects to login if unauthenticated

Automatic session validation

2. 🗂 Workspace Management

Each workspace stores its own:

Training dataset

Trained model versions

Metadata history

Uncertain samples for active learning

Workspaces allow project isolation.

3. ✍️ Annotation Tool

A full annotation interface where users can:

Enter text

Add intent

Add entity spans ([text](ENTITY))

Preview JSON format

Save annotations to selected workspace

Example annotation format:

{
  "text": "Book a table at Leela Palace",
  "intent": "book_restaurant",
  "entities": [
    { "start": 17, "end": 29, "label": "RESTAURANT" }
  ]
}

4. 🤖 Model Training

Supports training of:

spaCy NER

Custom entity training

Stores models under models/spacy_model/

Rasa NLU

Converts annotations → nlu.yml

Runs rasa train nlu

Saves .tar.gz model files

Generates metadata per version

5. 🔁 Active Learning Module

Detects low-confidence predictions (< 0.6):

Stores them in uncertain_samples.json

Allows user to re-annotate and retrain

Integrates seamlessly with existing training pipeline

Active learning improves the dataset automatically over time.

6. 🛠 Admin Dashboard

Shows:

Total annotations

Entity types

Intent list

Model versions

Last trained time

Workspace-specific statistics

User accounts

Includes actions:

Retrain spaCy

Retrain Rasa

Retrain both models

Open Active Learning module

7. 🚀 Deployment Pipeline UI

A visual representation of deployment steps:

Docker Build → Container Registry → Cloud Deploy → Live Service


All buttons are placeholders for future CI/CD integration.

8. 🛒 Custom Chatbot UI (E-commerce)

Includes:

Chat interface

Order-tracking intent

Product suggestion intents

Fallback handling

Example conversation:

You: show me laptops  
Bot: Here are trending laptops right now...

Project Workflow
Login → Workspace Selection → Annotation Page → Train Models →
Active Learning → Admin Dashboard → Deployment → Chatbot UI

Project Structure
project/
│── backend/
│   ├── app.py
│   ├── auth/
│   │   └── jwt_utils.py
│   ├── api/
│   │   ├── auth_api.py
│   │   ├── workspace_api.py
│   │   ├── models_api.py
│   │   ├── train_api.py
│   │   └── admin_api.py
│   ├── utils/
│   │   ├── model_utils.py
│   │   ├── tokenizer.py
│   │   └── active_learning.py
│   └── data/
│       └── uncertain_samples.json
│
│── frontend/
│   ├── templates/
│   │   ├── auth.html
│   │   ├── workspace.html
│   │   ├── annotation.html
│   │   ├── active_learning.html
│   │   ├── admin_dashboard.html
│   │   └── deployment.html
│   ├── static/js/
│   ├── static/css/
│   └── chatbot-ui/
│
│── models/
│   ├── metadata/
│   ├── spacy_models/
│   └── rasa_models/
│
├── README.md
└── requirements.txt

Installation
1. Clone Repo
git clone https://github.com/<your-repo>.git
cd project

2. Create Virtual Environment
python -m venv venv
source venv/bin/activate   # macOS/Linux
venv\Scripts\activate      # Windows

3. Install Dependencies
pip install -r requirements.txt

4. Start Backend
python backend/app.py

5. Open Frontend

Open frontend/index.html or use Live Server.

API Endpoints
Authentication
POST /api/auth/register
POST /api/auth/login
GET /api/auth/users

Annotation
POST /api/annotations
GET /api/annotations?workspace_id=

Model Training
POST /api/train   { "backend": "spacy" | "rasa" }

Active Learning
GET /api/active_learning/uncertain_samples
POST /api/active_learning/retrain

Admin
GET /api/admin/stats
GET /api/admin/users
GET /api/admin/model_health

Future Enhancements

Live deployment to Docker Hub + Render

Real-time chatbot model switching

Automatic confidence threshold tuning

Multi-user collaboration inside workspace

License

This project is licensed under the MIT License.
