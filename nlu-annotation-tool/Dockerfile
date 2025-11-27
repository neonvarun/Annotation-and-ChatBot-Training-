# NLU Annotation Tool - Sample Docker Image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy and install dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ /app/backend/

# Copy frontend files (optional - for serving static content)
COPY frontend/ /app/frontend/

# Create necessary directories
RUN mkdir -p /app/backend/workspaces /app/backend/models /app/backend/data

# Expose port
EXPOSE 5000

# Health check to verify container is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/').read()" || exit 1

# Set environment variables
ENV FLASK_APP=backend/app.py
ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python", "backend/app.py"]
