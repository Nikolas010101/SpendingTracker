import sqlite3

conn = sqlite3.connect("db/tracker.db")
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    value NUMERIC(10, 2) NOT NULL
)
''')

conn.commit()
conn.close()