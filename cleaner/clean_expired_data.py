import os
import psycopg2
import datetime

# 從環境變數載入資料庫配置
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "fileseedshare"),
    "user": os.getenv("DB_USER", "user"),
    "password": os.getenv("DB_PASSWORD", "password"),
    "host": os.getenv("DB_HOST", "db"),
    "port": int(os.getenv("DB_PORT", 5432)),
}

# 過期天數
EXPIRATION_DAYS = 1

def delete_expired_records():
    try:
        # 與資料庫建立連線
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # 設定過期日期
        now = datetime.datetime.now()
        expiration_date = now - datetime.timedelta(days=EXPIRATION_DAYS)

        # 查詢過期的檔案路徑
        query_select = """
        SELECT seed_code, file_path
        FROM files
        WHERE upload_time < %s;
        """
        cursor.execute(query_select, (expiration_date,))
        expired_files = cursor.fetchall()

        # 刪除對應的檔案
        for seed_code, file_path in expired_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)  # 刪除檔案
                    print(f"Deleted file: {file_path}")
                else:
                    print(f"File not found: {file_path}")
            except Exception as e:
                print(f"Error deleting file {file_path}: {e}")

        # 刪除資料庫中的記錄
        query_delete = """
        DELETE FROM files
        WHERE upload_time < %s;
        """
        cursor.execute(query_delete, (expiration_date,))
        conn.commit()

        print(f"Deleted {cursor.rowcount} expired records.")
    except Exception as e:
        print(f"Error during cleanup: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    delete_expired_records()
