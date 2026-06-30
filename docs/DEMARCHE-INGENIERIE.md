# Démarche d'ingénierie — V-Secure & Collaborate

**Équipe :** Henoc Kague (pilote technique) + équipe ESTIAM
**Hackathon 42c × ESTIAM 2026**

---

## 1. Analyse du besoin

### 1.1 Contexte

42c souhaite une plateforme vidéo B2B permettant aux entreprises de diffuser,
sécuriser et exploiter leurs contenus vidéo internes. Trois besoins coexistent
et doivent former une seule plateforme cohérente :

- **Collaborer** sur du contenu vidéo (revue, présentation partagée)
- **Sécuriser** la diffusion contre le piratage et les abus
- **Valoriser** le contenu grâce à l'analyse des données d'usage

### 1.2 Problème à résoudre

Diffuser une vidéo en clair sur le web revient à perdre tout contrôle sur sa
distribution : téléchargement, partage de compte, scraping automatisé. Une
plateforme B2B doit garantir qu'un contenu vidéo n'est consultable que par
les utilisateurs autorisés, et idéalement tracer toute fuite jusqu'à sa
source.

### 1.3 Parties prenantes et cas d'usage

| Acteur | Besoin |
|---|---|
| Collaborateur visionnant une vidéo | Accès fluide, identité vérifiée |
| Administrateur sécurité | Visibilité sur les tentatives d'abus |
| Équipe produit | Comprendre où l'audience décroche |

### 1.4 Périmètre retenu (notre équipe)

Sur les 3 pôles obligatoires, nous avons choisi :
- **Pôle 1** : Sujet A — authentification + lecteur vidéo
- **Pôle 2** : Sujet B — détection des menaces & anti-scraping (pilier de notre contribution)
- **Pôle 3** : Sujet B — analyse d'audience & prédiction de rétention

---

## 2. Architecture

### 2.1 Vue d'ensemble (View / Core / Engine)

```
┌─────────────────────────────────────────────────┐
│  VIEW (frontend/, React)                         │
│  - Login (auth fournie)                          │
│  - VideoShield : lecteur vidéo protégé           │
│  - Watermark affiché en overlay                  │
└───────────────────┬───────────────────────────────┘
                     │ HTTPS + JWT
┌────────────────────▼──────────────────────────────┐
│  CORE (backend/, NestJS)                          │
│  - AuthModule : login, JWT (fourni)               │
│  - AntiScrapingModule (notre contribution) :      │
│      • ThreatDetectorService (rate-limit, VPN,    │
│        sessions multiples)                        │
│      • AntiScrapingGuard (intercepteur de routes) │
│      • WatermarkService (traçabilité forensic)    │
│      • Streaming vidéo protégé (range HTTP)       │
└────────────────────┬──────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────┐
│  ENGINE (engine/pole3-analyse/, Python)           │
│  - Analyse de rétention par vidéo                 │
│  - Détection de zones d'ennui (hotspots)          │
│  - Modèle de prédiction (RandomForest)            │
│  - Dashboard Streamlit                            │
└─────────────────────────────────────────────────┘
```

### 2.2 Flux d'authentification → sécurité → vidéo

1. L'utilisateur se connecte (`POST /auth/login`) → reçoit un JWT
2. Le frontend demande le manifest vidéo (`GET /video/:id/manifest`) avec le token
3. Le `AuthGuard` valide le JWT et expose `req.user`
4. Le `AntiScrapingGuard` évalue la requête (IP, fréquence, sessions) en s'appuyant sur l'identité réelle de `req.user`
5. Si autorisé : le `WatermarkService` génère un identifiant unique lié à `userId + videoId + timestamp`
6. Le manifest retourné inclut l'URL de streaming et le watermark
7. Le lecteur `<video>` charge le flux (`GET /video/:id/stream`), protégé par les mêmes Guards

### 2.3 Choix techniques justifiés

| Choix | Justification |
|---|---|
| Guard NestJS plutôt que middleware Express brut | Intégration native avec le système de routes et l'injection de dépendances déjà en place (AuthModule) |
| Stockage en mémoire (Map) plutôt que Redis | Suffisant pour la démo single-instance du hackathon ; limite assumée et documentée pour la scalabilité |
| Fenêtre glissante plutôt que compteur fixe | Évite l'effet de bord où un attaquant attend simplement le reset d'une fenêtre fixe |
| Watermark plutôt que détection de capture d'écran | La détection est techniquement quasi impossible côté navigateur (limite assumée explicitement, voir `docs/POLE2-anti-scraping-regles.md`) ; la dissuasion/traçabilité est une réponse honnête |
| Token JWT en query param pour le streaming vidéo | La balise HTML `<video>` ne peut pas envoyer de headers personnalisés ; repli nécessaire et documenté dans le code |
| RandomForest plutôt que régression linéaire simple | Capture des interactions non linéaires entre catégorie/durée/engagement sans sur-ingénierie pour un MVP hackathon |

### 2.4 Modèle de menace (Pôle 2)

**Ce qu'on protège** : l'accès aux flux vidéo et l'intégrité de l'attribution d'un visionnage à un utilisateur identifié.

**Contre quoi** : scraping automatisé (bots), partage de compte à grande échelle, accès via VPN/proxy pour contourner des restrictions.

**Hypothèses** : l'attaquant dispose d'un compte valide ou d'un accès réseau, mais agit en dehors d'un usage normal (volume, simultanéité, origine suspecte).

**Limites assumées** : pas de détection fiable de capture d'écran (limite physique des APIs navigateur) ; liste VPN statique pour la démo (à remplacer par une vraie API de réputation en production) ; stockage en mémoire non distribué.

---

## 3. Plan de réalisation

### 3.1 Séquencement réel (ce qui a été fait)

| Phase | Contenu | Statut |
|---|---|---|
| 1. Setup | Fork du repo officiel, environnement backend/frontend | ✅ |
| 2. Pôle 2 — cœur | ThreatDetectorService (rate-limit, VPN, sessions) | ✅ |
| 3. Pôle 2 — intégration | Guard branché sur AuthModule existant | ✅ |
| 4. Pôle 2 — traçabilité | WatermarkService + documentation des règles | ✅ |
| 5. Pôle 1 — lecteur | Streaming vidéo réel avec range HTTP, watermark overlay | ✅ |
| 6. Pôle 3 — analyse | Pipeline pandas (courbe de rétention, hotspots) | ✅ |
| 7. Pôle 3 — prédiction | Modèle RandomForest sans fuite de cible | ✅ |
| 8. Pôle 3 — visualisation | Dashboard Streamlit interactif | ✅ |
| 9. Intégration finale | Parcours utilisateur unique à travers les 3 pôles | ✅ |
| 10. Documentation | Ce document + doc des règles Pôle 2 | ✅ |
| 11. Soutenance | Pitch + démo live | 🔲 |

### 3.2 Répartition des rôles

Travail piloté techniquement de bout en bout sur les 3 pôles, avec coordination de l'équipe élargie sur les compléments éventuels.

### 3.3 Risques identifiés et mitigation

| Risque | Mitigation appliquée |
|---|---|
| Conflits Git en travail parallèle | Commits fréquents et atomiques (12 commits sur le projet) |
| Token JWT expirant pendant les démos | Connexion juste avant la démo live |
| Dataset volumineux ralentissant l'analyse | Filtrage par vidéo, mise en cache via Streamlit |
| `.venv` versionné par erreur | Détecté et corrigé immédiatement, `.gitignore` renforcé |

---

## 4. Pistes d'innovation au-delà du minimum

- **Watermark forensic** lié à l'identité réelle de l'utilisateur authentifié (au-delà du minimum demandé)
- **Streaming vidéo réel** avec support HTTP range (lecture fluide, pas juste un placeholder)
- **Évaluation quantitative** de la détection de hotspots (précision/rappel mesurés, pas juste affirmés)
- **Intégration croisée réelle** : un seul flux utilisateur authentifié traverse Pôle 1 → Pôle 2 → (et données pour Pôle 3)
