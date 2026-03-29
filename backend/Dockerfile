# Dockerfile for FastAPI Application

# Use the official Python 3.11 image
FROM python:3.11

# Set the working directory to /app
WORKDIR /app

# Copy requirements.txt
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . .

# Expose port 8000
EXPOSE 8000

# Run the FastAPI app with uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]