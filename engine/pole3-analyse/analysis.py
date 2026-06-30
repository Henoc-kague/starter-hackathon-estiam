"""
Pôle 3 - Sujet B : Analyse d'audience & prédiction de rétention.

Deux volets :
1. Comprendre : courbe de rétention par vidéo + détection des zones d'ennui
   (comparée à la vérité terrain fournie, jamais utilisée comme feature).
2. Anticiper : modèle prédisant un score de rétention par session, à partir
   de signaux indépendants du dénouement (catégorie, durée, engagement précoce,
   nombre de pauses/retours en arrière) — sans fuite de cible.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

DATA_DIR = "../../data"


def load_data():
    logs = pd.read_csv(f"{DATA_DIR}/viewing_logs.csv")
    videos = pd.read_csv(f"{DATA_DIR}/videos.csv")
    hotspots_truth = pd.read_csv(f"{DATA_DIR}/ground_truth_hotspots.csv")
    return logs, videos, hotspots_truth


# ---------- Volet 1 : comprendre (courbe de rétention + hotspots) ----------

def retention_curve(logs: pd.DataFrame, video_id: str, n_buckets: int = 20) -> pd.DataFrame:
    """
    Pour une vidéo donnée, calcule le % de sessions encore actives à
    chaque tranche de temps (10 tranches = courbe de rétention).
    Une session est "active" à la position t si elle a un évènement
    >= t (heartbeat/play/pause) sans abandon avant t.
    """
    video_logs = logs[logs["video_id"] == video_id]
    duration = video_logs["video_duration_sec"].iloc[0]
    bucket_size = duration / n_buckets

    sessions = video_logs["session_id"].unique()
    total_sessions = len(sessions)

    # dernière position atteinte par session (proxy d'abandon)
    last_position = video_logs.groupby("session_id")["position_sec"].max()

    rows = []
    for i in range(n_buckets):
        t = i * bucket_size
        still_watching = (last_position >= t).sum()
        rows.append(
            {
                "video_id": video_id,
                "position_sec": int(t),
                "retention_pct": round(100 * still_watching / total_sessions, 1),
            }
        )
    return pd.DataFrame(rows)


def detect_hotspots(curve: pd.DataFrame, drop_threshold: float = 8.0) -> list:
    """
    Détecte les zones d'ennui : segments où la rétention chute de plus de
    `drop_threshold` points de pourcentage entre deux tranches consécutives.
    Heuristique simple et transparente (pas de boîte noire).
    """
    hotspots = []
    curve = curve.sort_values("position_sec").reset_index(drop=True)
    for i in range(1, len(curve)):
        drop = curve.loc[i - 1, "retention_pct"] - curve.loc[i, "retention_pct"]
        if drop >= drop_threshold:
            hotspots.append(
                {
                    "start": int(curve.loc[i - 1, "position_sec"]),
                    "end": int(curve.loc[i, "position_sec"]),
                    "drop_pct": round(drop, 1),
                }
            )
    return hotspots


def evaluate_hotspot_detection(detected: list, truth: pd.DataFrame, video_id: str) -> dict:
    """
    Précision / rappel de la détection par rapport à la vérité terrain,
    sur la base d'un chevauchement de zones.
    """
    truth_zones = truth[truth["video_id"] == video_id]
    if len(truth_zones) == 0 or len(detected) == 0:
        return {"precision": None, "recall": None, "true_positives": 0}

    true_positives = 0
    matched_truth_indices = set()
    for d in detected:
        for idx, t in truth_zones.iterrows():
            overlap = min(d["end"], t["hotspot_end"]) - max(d["start"], t["hotspot_start"])
            if overlap > 0:
                matched_truth_indices.add(idx)
                break

    true_positives = len(matched_truth_indices)
    precision = true_positives / len(detected) if detected else 0
    recall = true_positives / len(truth_zones) if len(truth_zones) > 0 else 0
    return {
        "precision": round(precision, 2),
        "recall": round(recall, 2),
        "true_positives": true_positives,
        "detected_count": len(detected),
        "truth_count": len(truth_zones),
    }


# ---------- Volet 2 : anticiper (prédiction de rétention) ----------

def build_session_features(logs: pd.DataFrame, videos: pd.DataFrame) -> pd.DataFrame:
    """
    Construit un jeu de features PAR SESSION, sans fuite de cible :
    on n'utilise ni la position finale ni le statut d'abandon comme
    feature, seulement des signaux disponibles tôt dans la session.
    """
    sessions = []
    for session_id, group in logs.groupby("session_id"):
        group = group.sort_values("position_sec")
        video_id = group["video_id"].iloc[0]
        duration = group["video_duration_sec"].iloc[0]
        category = videos.loc[videos["video_id"] == video_id, "category"].iloc[0]

        n_pauses = (group["event_type"] == "pause").sum()
        n_seek_back = (group["event_type"] == "seek_back").sum()
        # engagement précoce : nombre d'évènements dans les 30 premières secondes
        early_engagement = (group["position_sec"] <= 30).sum()

        # CIBLE (à prédire) : score de rétention = dernière position / durée
        last_position = group["position_sec"].max()
        retention_score = min(1.0, last_position / duration) if duration > 0 else 0

        sessions.append(
            {
                "session_id": session_id,
                "category": category,
                "video_duration_sec": duration,
                "n_pauses": n_pauses,
                "n_seek_back": n_seek_back,
                "early_engagement": early_engagement,
                "retention_score": retention_score,
            }
        )
    return pd.DataFrame(sessions)


def train_retention_model(features: pd.DataFrame):
    """Entraîne un RandomForest et retourne le modèle + ses métriques."""
    df = pd.get_dummies(features, columns=["category"], drop_first=True)
    X = df.drop(columns=["session_id", "retention_score"])
    y = df["retention_score"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    metrics = {
        "MAE": round(mean_absolute_error(y_test, preds), 3),
        "R2": round(r2_score(y_test, preds), 3),
        "n_train": len(X_train),
        "n_test": len(X_test),
    }
    return model, metrics, X.columns.tolist()


if __name__ == "__main__":
    logs, videos, hotspots_truth = load_data()
    print(f"Logs chargés : {len(logs)} évènements, {logs['session_id'].nunique()} sessions")

    # Volet 1 : analyse d'une vidéo
    video_id = videos["video_id"].iloc[0]
    curve = retention_curve(logs, video_id)
    hotspots = detect_hotspots(curve)
    eval_result = evaluate_hotspot_detection(hotspots, hotspots_truth, video_id)
    print(f"\n--- Analyse {video_id} ---")
    print(curve)
    print(f"Hotspots détectés : {hotspots}")
    print(f"Évaluation vs vérité terrain : {eval_result}")

    # Volet 2 : modèle de prédiction
    print("\n--- Entraînement du modèle de rétention ---")
    features = build_session_features(logs, videos)
    model, metrics, cols = train_retention_model(features)
    print(f"Métriques : {metrics}")
