# Soutenance — V-Secure & Collaborate
## Structure 10 min présentation + 5 min Q&A

---

## Minutage proposé

| Temps | Contenu |
|---|---|
| 0:00 – 1:00 | Accroche + contexte du projet |
| 1:00 – 2:30 | Architecture (vue d'ensemble, 1 schéma) |
| 2:30 – 7:30 | Démo live (le cœur de la présentation) |
| 7:30 – 9:00 | Limites assumées + pistes d'innovation |
| 9:00 – 10:00 | Conclusion + transition Q&A |

---

## 1. Accroche (1 min)

> "Une plateforme vidéo B2B sans protection, c'est un PDF sans mot de passe :
> n'importe qui peut le copier, le diffuser, l'exploiter. On a construit
> V-Secure & Collaborate pour répondre à 3 besoins en une seule plateforme :
> collaborer, sécuriser, valoriser."

Présenter rapidement l'équipe et préciser : "Nous avons traité les 3 pôles
obligatoires, avec une attention particulière sur l'intégration entre eux —
ce n'est pas 3 projets côte à côte, c'est un seul flux utilisateur."

## 2. Architecture (1 min 30)

Montrer le schéma View / Core / Engine (disponible dans
`docs/DEMARCHE-INGENIERIE.md`). Insister sur un point clé :

> "Tout passe par une seule identité. L'utilisateur se connecte une fois,
> et cette identité traverse l'authentification, la protection anti-scraping,
> et le watermark forensic."

## 3. Démo live (5 min) — LE plus important

**Scénario à suivre dans l'ordre, testé et fiable :**

1. **Connexion** (alice/password) → montrer le JWT obtenu
2. **Chargement de la vidéo protégée** → la vraie vidéo se joue, watermark visible en overlay ("alice · timestamp · hash")
   - Dire : *"Ce watermark est unique à cette session. Si cette vidéo fuite, on sait qui, quand."*
3. **Bouton "Simuler une attaque"** → montrer les requêtes passer de ✅ à 🚫 BLOQUÉ en direct
   - Dire : *"15 requêtes légitimes passent, la 16e déclenche le blocage automatique. Fenêtre glissante, pas de contournement par simple attente."*
4. **Dashboard Streamlit Pôle 3** → montrer la courbe de rétention de la vidéo, la zone d'ennui surlignée en rouge, et les métriques précision/rappel
   - Dire : *"On ne prétend pas une détection parfaite. On la mesure : ici 100% de rappel, 50% de précision sur cette vidéo — donc honnête sur ses limites."*

**Conseil pratique** : se reconnecter juste avant la démo (le JWT expire vite), et avoir un deuxième onglet déjà ouvert sur le dashboard Streamlit pour ne pas perdre de temps à le relancer en live.

## 4. Limites assumées (1 min 30)

> "On a fait un choix d'honnêteté technique plutôt que de prétendre à
> l'impossible. Détecter une capture d'écran dans un navigateur n'est pas
> fiable — on le dit clairement dans notre doc, et on mise sur la
> dissuasion via le watermark plutôt que sur une fausse promesse de blocage."

Citer aussi : stockage en mémoire (pas Redis, assumé pour le scope hackathon), liste VPN statique (à remplacer par une vraie API en production).

## 5. Conclusion (1 min)

> "En résumé : une plateforme où authentification, sécurité et analyse de
> données forment un seul parcours, pas trois briques juxtaposées. Le code
> est sur notre repo, documenté, avec [N] commits tracés montrant la
> progression du travail."

---

## Anticipation des questions du jury

**Q : Pourquoi pas de vraie détection de capture d'écran ?**
> R : Techniquement non fiable côté navigateur (pas d'accès aux raccourcis OS ni aux outils tiers). On l'assume explicitement plutôt que de mentir sur les capacités du système, et on compense par la traçabilité (watermark).

**Q : Que se passe-t-il si plusieurs serveurs tournent en parallèle (scalabilité) ?**
> R : Actuellement stockage en mémoire (Map), donc état non partagé entre instances. Limite assumée et documentée — en production on migrerait vers Redis pour un état partagé.

**Q : Comment avez-vous évité les faux positifs sur le rate-limiting ?**
> R : Fenêtre glissante de 10s à 15 requêtes, calibrée pour laisser passer un usage humain normal tout en bloquant un script. On documente aussi le cas limite (réseau d'entreprise partagé) dans `docs/POLE2-anti-scraping-regles.md`.

**Q : Le watermark peut-il être retiré par l'attaquant ?**
> R : Oui en théorie (capture vidéo puis recadrage), c'est une limite assumée — mais la dissuasion fonctionne déjà bien en pratique, et on pourrait évoluer vers un watermark imperceptible (stéganographie) en V2.

**Q : Pourquoi NestJS plutôt que faire un microservice à part ?**
> R : Le repo officiel impose une architecture Core unique pour cohérence (un seul point d'entrée API, auth déjà mutualisée). Un microservice à part aurait dupliqué l'authentification et cassé l'intégration entre pôles.

**Q : Quelle est la fiabilité réelle de votre modèle de prédiction ?**
> R : R²=0.32, ce qui est modeste mais honnête pour un modèle avec seulement 4 features simples et sans fuite de cible. On le présente comme un point de départ, pas une solution finale — la priorité a été l'intégrité méthodologique (pas de fuite de cible) plutôt que la performance brute.

**Q : Combien de temps avez-vous eu, et qui a fait quoi ?**
> R : [Adapter selon la réalité de l'équipe au moment de la soutenance]

---

## Checklist avant la soutenance

- [ ] Backend (`npm run start:dev`) lancé et testé juste avant
- [ ] Frontend (`npm run dev`) lancé et testé juste avant
- [ ] Dashboard Streamlit lancé dans un onglet séparé déjà prêt
- [ ] Connexion fraîche (alice/password) pour avoir un token valide
- [ ] Connexion internet stable (pas de dépendance cloud, tout est en local donc pas de risque ici)
- [ ] Repo GitHub à jour, dernier commit poussé
- [ ] Ce document imprimé ou ouvert sur un second écran pour suivre le fil
