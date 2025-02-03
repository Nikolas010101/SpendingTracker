from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pathlib import Path
import pandas as pd
import os
import joblib
import sqlite3

app = Flask(__name__)
CORS(app)

app.config["UPLOAD_FOLDER"] = "uploads"

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

base_dir = Path(__file__).resolve().parent
db_path = base_dir.parents[0] / "db" / "tracker.db"
frontend_path = base_dir.parents[0] / "frontend"
model_path = base_dir / "transaction_classifier.pkl"

pipeline = joblib.load(model_path)

progress = {"current": 0, "total": 0}


@app.route("/")
def serve_frontend():
    return send_from_directory(frontend_path, "index.html")


@app.route("/history")
def serve_data_page():
    return send_from_directory(frontend_path, "history.html")


@app.route("/dataviz")
def serve_dataviz_page():
    return send_from_directory(frontend_path, "dataviz.html")


@app.route("/admin")
def serve_admin_page():
    return send_from_directory(frontend_path, "admin.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(frontend_path, path)


@app.route("/upload", methods=["POST"])
def upload_file():
    file = request.files["file"]

    if not file:
        return jsonify({"error": "no file"}), 500

    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(file_path)

    try:
        df = (
            pd.read_excel(
                file_path,
                skiprows=8,
                dtype={"valor (R$)": "string", "lançamento": "string"},
            )
            .dropna(axis=0, subset=["valor (R$)"])
            .drop(axis=1, labels=["ag./origem", "saldos (R$)"])
        )
        df.columns = ["date", "description", "value"]
        df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y").dt.date

        write_transactions_to_db(df)

        return jsonify({"message": "Data recorded successfully", "num_rows": len(df)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/data", methods=["GET"])
def get_data():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM transactions")
    rows = cursor.fetchall()

    columns = [description[0] for description in cursor.description]

    data = [dict(zip(columns, row)) for row in rows]

    conn.close()
    return jsonify({"data": data})


@app.route("/agg_data", methods=["GET"])
def get_agg_data():
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    group_by = request.args.get("group_by")
    transaction_type = request.args.get("transaction_type")

    print(f"start_date: {start_date}, end_date: {end_date}, group_by: {group_by}")

    conn = sqlite3.connect(db_path)
    df = pd.read_sql(
        """SELECT *
        FROM transactions
        WHERE date BETWEEN ? AND ?""",
        conn,
        params=[start_date, end_date],
        dtype={"description": "string", "category": "string"},
    )
    df["date"] = pd.to_datetime(df["date"])
    if transaction_type != "both":
        df = (
            df[df["value"] > 0] if transaction_type == "credit" else df[df["value"] < 0]
        )
    match group_by:
        case "day":
            df_grouped = df.groupby(["category", "date"])
        case "week":
            df_grouped = df.groupby(["category", pd.Grouper(key="date", freq="W")])
        case "month":
            df_grouped = df.groupby(["category", pd.Grouper(key="date", freq="ME")])
        case "trimester":
            df_grouped = df.groupby(["category", pd.Grouper(key="date", freq="QE")])
        case "year":
            df_grouped = df.groupby(["category", pd.Grouper(key="date", freq="YE")])
        case _:
            return jsonify({"error": "Invalid group_by parameter"}), 400

    df_grouped = df_grouped["value"].agg(("sum", "count")).reset_index()
    df_grouped["date"] = df_grouped["date"].dt.strftime("%d/%m/%Y")
    result = df_grouped.to_dict("records")
    return jsonify({"data": result})


@app.route("/admin/delete-all", methods=["POST"])
def delete_all_transactions():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("DELETE FROM transactions")

        cursor.execute("DELETE FROM sqlite_sequence WHERE name='transactions'")

        conn.commit()
        conn.close()

        return jsonify({"message": "All transactions deleted successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/edit/<int:id>", methods=["POST"])
def edit_transaction(id):
    try:
        data = request.get_json()
        new_category = data.get("category")

        if not new_category:
            return jsonify({"error": "Category is required"}), 400

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE transactions SET category = ? WHERE id = ?",
            (new_category, id),
        )

        cursor.execute("SELECT * FROM transactions WHERE id = ?", (id,))
        updated_row = cursor.fetchone()

        conn.commit()
        conn.close()

        if updated_row:
            columns = ["id", "date", "description", "category", "value"]
            updated_row_dict = dict(zip(columns, updated_row))
            return jsonify(updated_row_dict)
        else:
            return jsonify({"error": "Transaction not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/delete/<int:id>", methods=["DELETE"])
def delete_transaction(id):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("DELETE FROM transactions WHERE id = ?", (id,))

        conn.commit()
        conn.close()

        return jsonify({"message": "Transaction deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/categorize-transactions", methods=["POST"])
def categorize_transactions():
    global progress
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, description FROM transactions WHERE category IS NULL"
        )
        transactions = cursor.fetchall()

        progress["total"] = len(transactions)
        progress["current"] = 0

        if not transactions:
            return jsonify({"message": "No transactions to categorize."})

        descriptions = [t[1] for t in transactions]
        predicted_categories = pipeline.predict(descriptions)

        for (transaction_id, _), category in zip(transactions, predicted_categories):
            cursor.execute(
                "UPDATE transactions SET category = ? WHERE id = ?",
                (category, transaction_id),
            )
            progress["current"] += 1

            if progress["current"] % 10 == 0:
                conn.commit()

        conn.commit()
        conn.close()

        return jsonify({"message": f"Categorized {progress['current']} transactions."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/categorize-progress", methods=["GET"])
def get_progress():
    return jsonify(progress)


def write_transactions_to_db(df: pd.DataFrame) -> None:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    for _, row in df.iterrows():
        cursor.execute(
            """
            INSERT INTO transactions (date, description, value)
            VALUES (?, ?, ?)
        """,
            (row["date"], row["description"], row["value"]),
        )

    conn.commit()
    conn.close()


if __name__ == "__main__":
    app.run(debug=True)
