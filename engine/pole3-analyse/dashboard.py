"""
Pôle 3 - Sujet B : Dashboard d'analyse d'audience.

Lancer avec : streamlit run dashboard.py
"""

import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt

from analysis import (
    load_data,
    retention_curve,
    detect_hotspots,
    evaluate_hotspot_detection,
    build_session_features,
    train_retention_model,
)

st.set_page_config(page_title="Analyse d'audience - Pôle 3", layout="wide")
st.title("📊 Analyse d'audience & prédiction de rétention")
st.caption("Pôle 3 — Sujet B — Hackathon 42c × ESTIAM 2026")

logs, videos, hotspots_truth = load_data()

st.sidebar.header("Sélection")
query_video = st.query_params.get("video_id")
video_list = videos["video_id"].tolist()
default_index = video_list.index(query_video) if query_video in video_list else 0
video_id = st.sidebar.selectbox("Choisir une vidéo", video_list, index=default_index)
if query_video:
    st.info(f"Vidéo présélectionnée depuis le lecteur : {query_video}")
video_title = videos.loc[videos["video_id"] == video_id, "title"].iloc[0]
video_category = videos.loc[videos["video_id"] == video_id, "category"].iloc[0]

st.sidebar.metric("Vidéo sélectionnée", video_title)
st.sidebar.metric("Catégorie", video_category)

col1, col2 = st.columns([2, 1])

with col1:
    st.subheader(f"Courbe de rétention — {video_title}")
    curve = retention_curve(logs, video_id)
    hotspots = detect_hotspots(curve)

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(curve["position_sec"], curve["retention_pct"], marker="o", color="#1C7293")
    ax.set_xlabel("Position dans la vidéo (secondes)")
    ax.set_ylabel("% de spectateurs encore présents")
    ax.set_ylim(0, 105)
    ax.grid(alpha=0.3)

    # surligner les zones d'ennui détectées
    for h in hotspots:
        ax.axvspan(h["start"], h["end"], color="red", alpha=0.2)

    st.pyplot(fig)
    st.caption("Zones rouges = zones d'ennui détectées (chute de rétention)")

with col2:
    st.subheader("Zones d'ennui détectées")
    if hotspots:
        for h in hotspots:
            st.warning(f"⏱️ {h['start']}s → {h['end']}s  (chute de {h['drop_pct']} pts)")
    else:
        st.info("Aucune zone d'ennui significative détectée.")

    st.subheader("Évaluation (vs vérité terrain)")
    eval_result = evaluate_hotspot_detection(hotspots, hotspots_truth, video_id)
    if eval_result["precision"] is not None:
        c1, c2 = st.columns(2)
        c1.metric("Précision", f"{eval_result['precision']*100:.0f}%")
        c2.metric("Rappel", f"{eval_result['recall']*100:.0f}%")
        st.caption(
            f"{eval_result['true_positives']} zone(s) correctement détectée(s) "
            f"sur {eval_result['truth_count']} réelle(s)"
        )
    else:
        st.info("Pas de vérité terrain disponible pour cette vidéo.")

st.divider()

st.subheader("📈 Comparaison entre vidéos")
comparison_rows = []
for vid in videos["video_id"]:
    c = retention_curve(logs, vid)
    final_retention = c["retention_pct"].iloc[-1]
    comparison_rows.append(
        {
            "Vidéo": videos.loc[videos["video_id"] == vid, "title"].iloc[0],
            "Catégorie": videos.loc[videos["video_id"] == vid, "category"].iloc[0],
            "Rétention finale (%)": final_retention,
        }
    )
comparison_df = pd.DataFrame(comparison_rows).sort_values(
    "Rétention finale (%)", ascending=False
)
st.dataframe(comparison_df, use_container_width=True, hide_index=True)

st.divider()

st.subheader("🤖 Modèle de prédiction de rétention")
st.caption(
    "Prédit le score de rétention d'une session à partir de signaux précoces "
    "(catégorie, durée, pauses, retours en arrière, engagement initial) — "
    "sans utiliser la position finale ni le statut d'abandon (pas de fuite de cible)."
)

with st.spinner("Entraînement du modèle..."):
    features = build_session_features(logs, videos)
    model, metrics, feature_cols = train_retention_model(features)

c1, c2, c3 = st.columns(3)
c1.metric("MAE (erreur moyenne)", metrics["MAE"])
c2.metric("R² (qualité du modèle)", metrics["R2"])
c3.metric("Sessions utilisées", metrics["n_train"] + metrics["n_test"])

st.caption(
    "MAE proche de 0 = bonnes prédictions. R² proche de 1 = le modèle explique "
    "bien la variance observée (0.3 est correct pour un modèle simple avec peu de features)."
)
