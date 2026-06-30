# Pôle 2 — Sujet B : Détection des menaces & Anti-Scraping

## Règles de détection implémentées

### 1. Rate limiting comportemental (fenêtre glissante)
- Seuil : 15 requêtes par fenêtre de 10 secondes, par IP
- Méthode : fenêtre glissante (sliding window), pas de compteur fixe — évite l'effet de bord où un attaquant attend juste le reset d'une fenêtre fixe
- Action : blocage de l'IP pendant 60 secondes
- Faux positifs possibles : un utilisateur légitime sur réseau partagé (NAT d'entreprise/université) avec plusieurs personnes actives simultanément. Limite assumée.

### 2. Détection VPN / Proxy
- Méthode : comparaison à une liste de plages IP connues comme VPN/datacenter
- Limite assumée : liste statique pour la démo (en production, on utiliserait une vraie API de réputation IP type IPQualityScore ou une base CIDR/ASN à jour, type FireHOL ou IP2Proxy)
- Faux positifs possibles : utilisateurs légitimes derrière un VPN d'entreprise

### 3. Sessions simultanées anormales (partage de compte)
- Méthode : un même compte (`account_id`) ne doit pas avoir de requêtes actives depuis plus d'une IP sur une fenêtre de 30 secondes
- Action : blocage de la nouvelle IP en surnombre
- Faux positifs possibles : utilisateur changeant de réseau (wifi → 4G) en cours de session

## Limite assumée explicitement : détection de capture d'écran

Détecter de façon fiable une capture d'écran dans un navigateur est
quasi impossible : les APIs navigateur n'ont pas accès aux raccourcis
clavier OS (Cmd+Shift+4 sur Mac, Win+Shift+S sur Windows) ni aux
outils tiers de capture. Toute prétention de détection à 100% serait
trompeuse.

**Notre choix** : plutôt que de prétendre bloquer la capture, on mise
sur la dissuasion et la traçabilité via un **watermark forensic** :
chaque session de lecture affiche un identifiant visible et unique
(utilisateur + timestamp + hash de session). En cas de fuite, l'origine
est immédiatement identifiable.

## Vrais positifs vs faux positifs — analyse

| Règle | Vrai positif typique | Faux positif possible | Mitigation |
|---|---|---|---|
| Rate limit | Bot scraper en boucle | Réseau d'entreprise partagé | Seuil ajustable, fenêtre glissante |
| VPN | Contournement de restriction géo | VPN d'entreprise légitime | Liste blanche possible pour IP connues |
| Sessions multiples | Compte revendu/partagé | Changement de réseau en cours d'usage | TTL de 30s avant de considérer une session comme active |

## Architecture

Le contrôle est implémenté comme un **Guard NestJS** (`AntiScrapingGuard`),
intercepteur officiel du framework, appliqué sur les routes vidéo
sensibles. Toute la logique vit dans le Core (`backend/`), conformément
à l'architecture View/Core/Engine du projet.

## Pistes d'amélioration (non implémentées, par manque de temps)

- Remplacer le stockage en mémoire par Redis pour un déploiement multi-instance
- Géolocalisation incohérente (IP qui change de pays entre deux requêtes rapprochées)
- Détection de patterns séquentiels sur les segments HLS (scraping méthodique)
