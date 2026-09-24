import os
import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv

def init_database():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url or not db_url.startswith("postgres"):
        print("❌ Error: DATABASE_URL must be set and must be a PostgreSQL connection string.")
        print("Example: postgresql://user:pass@localhost:5432/dbname")
        return

    print("🔌 Connecting to PostgreSQL...")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        sql_dir = os.path.join(os.path.dirname(__file__), "sql")
        schemas_path = os.path.join(sql_dir, "01_schemas.sql")
        triggers_path = os.path.join(sql_dir, "02_audit_triggers.sql")
        
        print("📜 Executing 01_schemas.sql...")
        with open(schemas_path, "r", encoding="utf-8") as f:
            cursor.execute(f.read())
            
        print("🛡️ Executing 02_audit_triggers.sql...")
        with open(triggers_path, "r", encoding="utf-8") as f:
            cursor.execute(f.read())
            
        cursor.close()
        conn.close()
        print("✅ Database Initialization Successful!")
        print("All schemas, tables, and immutable audit triggers have been created.")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")

if __name__ == "__main__":
    init_database()
