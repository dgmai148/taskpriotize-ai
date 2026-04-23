"""
TaskPrio ML Service — Priority prediction with SHAP explanations.

Uses a GradientBoosting model trained on synthetic task data to predict
priority scores (0-100). SHAP values provide per-feature explanations.
"""

import os
import numpy as np
from flask import Flask, request, jsonify
from sklearn.ensemble import GradientBoostingRegressor
import shap

app = Flask(__name__)

# Feature names used by the model
FEATURE_NAMES = [
    "story_points",
    "manual_priority",
    "dependency_count",
    "blocked_tasks_count",
    "days_until_due",
    "status_progress",
    "age_days",
]

# Human-readable labels for SHAP display
FEATURE_LABELS = {
    "story_points": "Story Points",
    "manual_priority": "Manual Priority",
    "dependency_count": "Dependencies",
    "blocked_tasks_count": "Blocking Others",
    "days_until_due": "Days Until Due",
    "status_progress": "Status Progress",
    "age_days": "Task Age",
}


def generate_training_data(n=500):
    """Generate synthetic training data that captures realistic priority patterns."""
    rng = np.random.RandomState(42)

    story_points = rng.choice([1, 2, 3, 5, 8, 13], size=n).astype(float)
    manual_priority = rng.choice([0.2, 0.5, 0.8, 1.0], size=n, p=[0.2, 0.4, 0.3, 0.1])
    dependency_count = rng.poisson(1.5, size=n).astype(float)
    blocked_tasks_count = rng.poisson(1.0, size=n).astype(float)
    days_until_due = rng.exponential(15, size=n)
    status_progress = rng.choice([0, 0.3, 0.7, 1.0, 0.1], size=n, p=[0.3, 0.25, 0.15, 0.15, 0.15])
    age_days = rng.exponential(10, size=n)

    X = np.column_stack([
        story_points, manual_priority, dependency_count,
        blocked_tasks_count, days_until_due, status_progress, age_days,
    ])

    # Priority formula: higher = more urgent
    # - High manual priority increases score
    # - Closer deadline increases score
    # - Blocking many other tasks increases score
    # - Already-done tasks decrease score
    # - Older unfinished tasks increase score
    y = (
        manual_priority * 30
        + np.clip(30 - days_until_due, 0, 30)
        + blocked_tasks_count * 8
        + story_points * 1.5
        + dependency_count * 3
        + age_days * 0.5
        - status_progress * 25
        + rng.normal(0, 3, size=n)  # noise
    )
    y = np.clip(y, 0, 100)

    return X, y


def build_model():
    """Train a GradientBoosting model and create SHAP explainer."""
    print("[ML] Training model on synthetic data...")
    X, y = generate_training_data(n=1000)

    model = GradientBoostingRegressor(
        n_estimators=100, max_depth=4, learning_rate=0.1,
        random_state=42, min_samples_leaf=5,
    )
    model.fit(X, y)

    # Create TreeExplainer for SHAP
    explainer = shap.TreeExplainer(model)
    print("[ML] Model trained. Ready for predictions.")
    return model, explainer


# Train on startup
MODEL, EXPLAINER = build_model()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "gradient_boosting"})


@app.route("/predict", methods=["POST"])
def predict():
    """
    Predict priority scores with SHAP explanations.

    Expects JSON body:
    {
      "tasks": [
        {
          "id": "uuid",
          "features": {
            "story_points": 5, "manual_priority": 0.8,
            "dependency_count": 2, "blocked_tasks_count": 3,
            "days_until_due": 7, "status_progress": 0.3, "age_days": 14
          }
        }
      ]
    }
    """
    data = request.get_json()
    if not data or "tasks" not in data:
        return jsonify({"error": "Missing 'tasks' in request body"}), 400

    tasks = data["tasks"]
    if len(tasks) == 0:
        return jsonify({"results": []})

    # Build feature matrix
    ids = []
    X = []
    for task in tasks:
        ids.append(task["id"])
        feat = task["features"]
        X.append([
            feat.get("story_points", 0),
            feat.get("manual_priority", 0.5),
            feat.get("dependency_count", 0),
            feat.get("blocked_tasks_count", 0),
            feat.get("days_until_due", 30),
            feat.get("status_progress", 0),
            feat.get("age_days", 0),
        ])

    X = np.array(X, dtype=float)

    # Predict scores
    raw_scores = MODEL.predict(X)
    scores = np.clip(raw_scores, 0, 100).round(2)

    # SHAP explanations
    shap_values = EXPLAINER.shap_values(X)

    results = []
    for i, task_id in enumerate(ids):
        # Build per-feature explanation
        explanation = []
        for j, fname in enumerate(FEATURE_NAMES):
            sv = float(shap_values[i][j])
            explanation.append({
                "feature": fname,
                "label": FEATURE_LABELS[fname],
                "shap_value": round(sv, 3),
                "feature_value": float(X[i][j]),
                "impact": "positive" if sv > 0 else "negative",
            })

        # Sort by absolute SHAP value (most important first)
        explanation.sort(key=lambda e: abs(e["shap_value"]), reverse=True)

        results.append({
            "id": task_id,
            "score": float(scores[i]),
            "explanation": explanation,
        })

    return jsonify({"results": results})


if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=False)
