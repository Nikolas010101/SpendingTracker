import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
from pathlib import Path
import sqlite3
import joblib

base_dir = Path(__file__).resolve().parent
db_path = base_dir.parents[0] / "db" / "tracker.db"
model_path = base_dir / "transaction_classifier.pkl"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
df = pd.read_sql(
    "SELECT * FROM transactions",
    conn,
    dtype={"description": "string", "category": "string"},
)
df["date"] = pd.to_datetime(df["date"])

X_train, X_test, y_train, y_test = train_test_split(
    df["description"], df["category"], test_size=0.2, random_state=42
)

pipeline = Pipeline(
    [
        ("tfidf", TfidfVectorizer()),
        ("classifier", RandomForestClassifier(n_estimators=100, random_state=42)),
    ]
)

pipeline.fit(X_train, y_train)

y_pred = pipeline.predict(X_test)
print(classification_report(y_test, y_pred))

joblib.dump(pipeline, model_path)
