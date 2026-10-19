# Importer Blue Chili dans un autre environnement Codex

Ce dossier contient le code source de la **version 13 publiée**, incluant les adaptations mobiles, les comptes privés et l’administration de Karima.

## Ce que contient l’archive

- Application : `ui/tool.html` et modèles/modules JavaScript dans `ui/`.
- Mobile : `ui/mobile-ui.js` et `public/mobile.css`.
- Interface servie : `app/route.ts` assemble ces fichiers dans la page.
- API et sécurité : `app/api/`, `lib/password-auth.ts`, `lib/accounts.ts` et `lib/phone-auth.ts`.
- Base : `db/schema.ts` et les trois migrations dans `drizzle/`.
- Logos, icônes iPhone, styles et manifeste dans `public/`.
- Dépendances verrouillées dans `pnpm-lock.yaml`, scripts de compilation et tests.
- `PROVENANCE_SOURCE.json` identifie la publication et liste les empreintes des fichiers d’origine.

Les mots de passe de production, les clés, les historiques personnels, les justificatifs, les dépendances installées et les caches ne sont pas dans ce dossier. Les données en ligne restent dans la base et le stockage du site existant. Les mots de passe présents dans les tests sont des exemples synthétiques.

## Importer dans le dépôt « personal »

1. Décompresser le ZIP sur l’ordinateur.
2. Ouvrir le dossier `Blue_Chili_Source_v13` et importer son **contenu** dans le dépôt ciblé, en incluant `.openai/hosting.json`, `.gitignore` et `.npmrc`. Le fichier `package.json` doit être à la racine du projet ouvert dans Codex.
3. Enregistrer les fichiers dans ce dépôt et les pousser sur la branche de travail. Ce ZIP ne contient aucun historique Git et ne remplace pas la configuration Git du dépôt cible.
4. Ouvrir ou relancer Codex avec ce dépôt et cette branche. Le dépôt `personal` n’est pas rempli automatiquement par le téléchargement de l’archive.

L’URL du site est une adresse de consultation ; elle ne donne pas à Codex le code source ni les accès de publication.

## Installation et vérifications

Le projet déclare Node.js **22.13.0 minimum** et **pnpm 11.25.0**. Utiliser une version de Node compatible avec ces deux exigences. Avec Node et Corepack disponibles :

```bash
corepack pnpm install --frozen-lockfile
node tests/ui.cjs
node tests/backend.cjs
node tests/repas-model.mjs
node tests/caisse-model.mjs
node node_modules/typescript/bin/tsc --noEmit
corepack pnpm run build
```

Pour développer :

```bash
corepack pnpm run dev
```

Le lancement portable utilise le port 5173. Un clone propre choisit déjà le profil `portable` ; il n’a pas besoin des dossiers privés de l’ancien environnement. Les dépendances OCR et PDF sont préparées lors de la compilation par `scripts/prepare-caisse-assets.mjs`.

Une copie locale complète nécessite la base D1 locale, ses migrations et des identifiants de développement. Les tests utilisent une base isolée et des identifiants fictifs ; ils ne nécessitent pas les secrets du site en production. Ne pas interpréter l’absence de données ou d’identifiants dans une copie locale comme une suppression de l’historique en ligne.

## Réseau de l’environnement Codex

Dans les paramètres de **l’environnement qui signale le 403**, vérifier que l’accès Internet est activé et ajouter ce nom d’hôte aux domaines autorisés :

```text
blue-chili-deplacements.bluechili-4586.chatgpt.site
```

Autoriser GET pour consulter le site. Pour tester une connexion par mot de passe et les sauvegardes, POST est également nécessaire ; l’envoi d’un justificatif utilise PUT. Les restrictions se configurent par environnement. Enregistrer les réglages et reprendre une tâche utilisant la configuration mise à jour. Si l’interface de cet environnement demande de publier sa configuration, finaliser cette étape dans cet environnement.

La disponibilité du site au public et l’autorisation réseau de Codex sont deux réglages distincts. Le site ne doit pas être republié seulement pour autoriser son domaine dans un autre environnement.

Documentation officielle consultée le 19 octobre 2026 :
https://learn.chatgpt.com/docs/cloud/internet-access

Pour installer les dépendances, l’environnement doit aussi pouvoir joindre son registre de paquets. Les tests cartographiques peuvent nécessiter les domaines listés dans `lib/maps.ts` ; le site distant suffit pour une simple revue de son écran de connexion.

## Configuration serveur et publication existante

- Projet Sites existant : `appgprj_6acf7533288481918099e0db62d603ce`.
- URL : https://blue-chili-deplacements.bluechili-4586.chatgpt.site
- Dernière version exportée : 13.
- Commit source : `844976a3e7e04caaf8bc39406e25d143f8791e18`.
- Données D1 : liaison `DB`. Justificatifs R2 : liaison `BUCKET`.
- Connexion obligatoire : `REQUIRE_PROFILE_PASSWORD=1`.
- Secrets existants : `AUTH_PASSWORD_HASHES_JSON` et `AUTH_PASSWORD_HASH_AMINE_JSON`.
- SMS non activés ; aucun service génératif d’IA n’est connecté.

Conserver l’identifiant du projet si l’objectif est de mettre à jour le site existant via Sites. Le transfert du code dans GitHub ne transfère pas automatiquement son hébergement, sa base, ses justificatifs ou ses secrets. Le déploiement sur un autre hébergeur demande une configuration adaptée à son environnement Workers/D1/R2.

Une nouvelle installation de développement doit recevoir ses propres secrets, jamais les copier dans Git. Le détail des variables et des calculs se trouve dans `README.md` et les modules serveur.

## État de vérification de la version exportée

106 tests d’interface ont passé avant la publication, avec contrôle TypeScript et compilation réussis. Le code et les styles ont été vérifiés sur l’URL publique. Le contrôle visuel en navigateur mobile n’était pas disponible dans l’environnement de création ; le rendu Safari, le clavier et les zones de sécurité restent à essayer sur un iPhone réel. Cette archive ne contient pas de captures inventées.

## Brief à donner à Codex

> L’archive contient les sources de Blue Chili Déplacements, version 13. Lis `LIRE_AVANT_IMPORT.md` et `README.md`, puis analyse l’UX mobile depuis `ui/tool.html`, `ui/mobile-ui.js`, `public/mobile.css`, `ui/repas-ui.js` et `ui/caisse-ui.js`. Préserve les historiques, la séparation des comptes, l’administration Karima et les calculs. Commence dans le dépôt de travail importé. Utilise des données fictives pour les tests locaux. L’URL du site est publique, mais l’accès réseau de ton environnement et la connexion aux sessions sont des contrôles distincts. N’annonce pas de captures ou de tests sur iPhone réel si tu ne les as pas réalisés.
