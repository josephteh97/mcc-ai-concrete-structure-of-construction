# MCC AI Concrete Structure Backend

## Setup & Installation

To ensure reproducibility and handle binary dependencies correctly, we use a hybrid installation approach (Conda + Pip).

### 1. Create Conda Environment
First, create a fresh Conda environment with Python 3.10:

```bash
conda create -n mcc-backend python=3.10.19
conda activate mcc-backend
```

### 2. Install Conda Dependencies
Some libraries (like `ifcopenshell`) rely on heavy system dependencies (C++, geometry kernels) and are best installed via Conda to avoid compilation issues.

```bash
# Install IfcOpenShell (v0.8.4+)
conda install -c conda-forge ifcopenshell
```

### 3. Install Pip Dependencies
The rest of the Python ecosystem libraries are managed via `pip`.

```bash
pip install -r requirements.txt
```

> **Note:** `requirements.txt` contains specific versions for `fastapi`, `ultralytics`, `paddlepaddle`, etc. Ensure you install `ifcopenshell` via Conda *before* running pip install to prevent dependency conflicts.

## Running the Application

```bash
# Start the FastAPI server
python main.py
```

##### for agentic programming
```bash
# Install Git LFS first if you haven't
git lfs install

# Clone the model to a local folder named 'qwen-vl-model'
# Note: This is a large download (~5GB+)
# We recommend creating a 'models' directory at the project root
mkdir -p ../models
cd ../models
git clone https://huggingface.co/Qwen/Qwen2-VL-2B-Instruct

# The backend code is configured to look for the model at:
# ../models/Qwen2-VL-2B-Instruct
# You can override this by setting the QWEN_MODEL_PATH environment variable.
```