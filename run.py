import os
import sys

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend path is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    print("=" * 70)
    print("SOKXAY LAO LOTTERY PLATFORM")
    print("Enterprise 3-Tier Web & Mobile App for Android and iOS")
    print(f"Access Application: http://localhost:{port}")
    print(f"API Documentation: http://localhost:{port}/docs")
    print("=" * 70)
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)

