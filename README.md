# Blue Chili · Déplacements & frais

Application hébergée sur Sites, avec les profils Karima, Wijdane, Samir, Reda (Chef de projet) et Amine (Chef de projet junior).

Le choix du profil apparaît à l'ouverture. Chaque profil possède son mot de passe, vérifié côté serveur. Karima est administratrice et peut consulter tous les profils depuis le menu déroulant ; les autres ne reçoivent que leurs propres missions et récupérations. Les données sont conservées dans D1 et se retrouvent après reconnexion sur un autre appareil. Les copies temporaires du navigateur sont propres au compte et retirées à la déconnexion. L'ancien historique local peut être repris et synchronisé lors de la première connexion administratrice.

## Administration de l’équipe

Dans la session Karima, **Administration → Créer une session** crée un compte de chef de projet avec nom, civilité et poste. Le compte est ajouté au choix initial et au menu de l’administratrice. L’identifiant est un UUID serveur ; les références des missions utilisent un préfixe propre au compte. Chaque chef de projet ne reçoit que ses données. Seule l’identité Karima est administratrice, indépendamment des champs envoyés par le navigateur.

Le mot de passe aléatoire (100 bits) est affiché une seule fois, avec un bouton de copie pour transmission manuelle. Il n’est jamais enregistré dans le profil ou la copie locale. Seuls un sel et un hash PBKDF2 sont conservés dans la table D1 `project_accounts`. La création du compte et de son état initial est atomique. Les cinq mots de passe existants restent valides. Les nouveaux profils commencent avec Blue Chili et peuvent compléter leurs informations dans Paramètres. La règle de congés reste réservée aux trois profils déjà éligibles. L’API `/api/admin/accounts` refuse les visiteurs non connectés, les comptes personnels et les créations provenant d’une autre origine.

## iPhone

Le manifeste et les icônes permettent d’ouvrir la plateforme depuis l’écran d’accueil, en fenêtre autonome. Dans Safari : **Partager → Sur l’écran d’accueil → Ouvrir comme app web (si proposé) → Ajouter**. Une aide est présente sur la connexion et dans les paramètres. Les champs et boutons sont adaptés au tactile et aux zones de sécurité iPhone. Internet est nécessaire pour charger et synchroniser les données ; aucun service worker ne met en cache les API privées. Le contrôle d’accès Sites actuel est conservé ; une connexion ChatGPT peut être demandée avant la session personnelle. L’installation et le rendu sur un iPhone physique restent à vérifier sur l’appareil.

## Ergonomie mobile

La navigation mobile (écrans jusqu’à 900 px) utilise une barre inférieure Accueil, Missions, Créer, Caisse et Plus. Le menu secondaire regroupe calendrier, congés, paramètres, administration et déconnexion. Le tiroir peut être fermé au clavier et conserve les restrictions de droits. La connexion sur téléphone utilise un choix de session et un champ mot de passe directement sur la page, avec affichage/masquage ; aucun mot de passe n’est conservé par ce formulaire.

Les tableaux d’historique, de caisse et de reconnaissance deviennent des fiches avec intitulés. Les tableaux de bureau conservent leurs colonnes et leurs actions. Les mois sans activité sont masqués sur téléphone ; un mois comprenant un remboursement reste visible même sans départ de mission. Les repas sont présentés par jour avec trois grandes zones à cocher. Les formulaires se lisent en colonne, et les étapes d’un déplacement sont accessibles par des liens directs. Une barre affiche le reste à rembourser ou l’avance à restituer et mène au récapitulatif/PDF. La navigation fixe s’efface pendant la saisie au clavier. Le calendrier complète sa grille par une liste des missions du mois, y compris celles qui chevauchent deux mois.

Le fichier mobile est chargé après les styles de bureau et utilise une URL versionnée. Les parcours de connexion, conservation des saisies, menus, calculs et listes sont vérifiés par les tests d’interface. Le navigateur de contrôle n’est pas disponible dans cet environnement ; le rendu et le clavier doivent encore être essayés sur un iPhone réel. L’accès public à la page de connexion est conservé, avec données protégées par les mots de passe personnels.

## En-têtes des documents

Samir utilise **Apollo Prod** et Wijdane **Brendz Agency**, à partir des deux modèles Word transmis le 19 octobre 2026. Le nouveau logo Apollo fourni séparément est placé en haut à gauche sur fond blanc, avec les dates et références à droite. Le PNG original est conservé sans retouche ; son cadrage est réalisé à la mise en page PDF. Le logo Brendz et les mentions légales reprennent les modèles. La configuration est appliquée côté serveur aux profils de Samir et Wijdane, y compris leurs anciens documents. Un ancien navigateur ou import ne peut pas rétablir le précédent en-tête. Les informations de mission, les montants, les congés et les caisses restent conservés.

Les ordres de mission, notes de frais, détails de trajets, récapitulatifs mensuels, tableaux de bord et états de caisse utilisent ce choix, y compris lorsqu'ils sont générés depuis un ancien déplacement. Les pages suivantes répètent le logo avec des marges réservées et un pied de page lisible. Les autres profils conservent leur en-tête actuel. Les PDF déjà téléchargés peuvent être remplacés en régénérant les exports depuis l'historique.

## Mots de passe et accès

- `REQUIRE_PROFILE_PASSWORD=1` : connexion par mot de passe (activée également si la variable est absente, pour échouer en mode fermé).
- `AUTH_PASSWORD_HASHES_JSON` : secret serveur associant les quatre identifiants à `{ "salt": "hexadecimal-16-octets", "hash": "hexadecimal-32-octets" }` ; PBKDF2 SHA-256, 100 000 itérations. Les mots de passe générés possèdent 100 bits d'aléa et ne sont pas présents dans le code ni dans les données de profil.
- `AUTH_PASSWORD_HASH_AMINE_JSON` : secret distinct `{ "salt": "…", "hash": "…" }` pour Amine ; sa configuration préserve les quatre mots de passe existants. Il peut aussi être inclus dans le secret agrégé.
- Cookie HttpOnly, Secure, SameSite=Lax, expiration 24 heures, jeton stocké haché et tentatives limitées. La rotation d'un mot de passe invalide ses sessions existantes. Aucun mot de passe ne peut donner les droits de Karima à un autre profil.

Le contrôle d'accès Sites est distinct : tant que le site reste privé au propriétaire, les autres personnes ne peuvent pas ouvrir l'écran de connexion. L'élargissement de cet accès demande une instruction explicite du propriétaire. Les API de données restent protégées par mot de passe.

## Repas par jour

Les nouveaux déplacements démarrent avec tous les repas décochés. Chaque jour permet de choisir le petit-déjeuner (50 DH), le déjeuner (100 DH) et le dîner (100 DH), soit au maximum 250 DH par jour. Les montants alimentent les remboursements, les historiques et la note de frais PDF (sous-totaux par repas et détail journalier). Les jours retirés des dates de mission ne sont pas facturés ; leurs choix sont conservés si la période est rétablie. La duplication décale les choix avec les dates.

Les anciens déplacements conservent leur forfait enregistré. Le bouton **Choisir les repas par jour** permet une conversion explicite ; **Revenir au forfait historique** restitue le montant initial. La synchronisation préserve les nouveaux champs lors des sauvegardes provenant des anciens navigateurs.

- `node tests/repas-model.mjs` : barème, dates, forfaits historiques et fusion.

## Gestion de caisse

L’entrée **Gestion de caisse** est disponible pour les cinq profils. Une caisse se rattache à un déplacement existant ou directement à un projet (y compris à Casablanca). Depuis un déplacement enregistré, **Ouvrir la caisse** donne accès à sa caisse. Les avances reçues, dépenses et restitutions forment un journal ; le solde est calculé en centimes entiers. Les six typologies sont : Achat fourniture, Service client, Pourboire, Course, Main d’œuvre et Autre. Un état PDF présente la synthèse par catégorie et le journal ; un CSV reprend les mouvements. Une caisse clôturée reste consultable et peut être rouverte.

La reconnaissance utilise Tesseract.js (réseau neuronal OCR, modèles français, anglais et arabe), puis des règles de détection des montants, dates et catégories. Elle ne fait pas d’appel à un modèle génératif ni à un fournisseur payant. Les images et PDF sont lus dans le navigateur ; tous les scripts, modèles et fichiers WASM sont servis par le Site. PDF.js lit le texte des PDF numériques et les pages scannées passent par l’OCR. Les propositions doivent être vérifiées et validées dans un tableau modifiable. Le mode ticket retient le total TTC une seule fois ; le mode liste prépare une dépense par ligne. Les montants absents/ambigus et devises étrangères demandent une correction. Les doublons possibles sont décochés. Limites : 5 fichiers, 8 Mo par fichier, 8 pages par PDF et 100 lignes par import.

Les lignes et caisses sont conservées dans D1 ; les justificatifs validés sont conservés dans R2 (`BUCKET`) et téléchargés par une API contrôlant le profil connecté. Karima peut consulter les cinq profils. Les mots de passe et le périmètre de partage Sites sont inchangés. Les anciennes sauvegardes et anciens clients préservent les nouvelles données. Les données de caisse ne sont pas ajoutées automatiquement aux notes de frais de déplacement, pour éviter de réclamer deux fois les mêmes dépenses.

**Texte → tableau** ouvre un parcours distinct pour la saisie en phrases, sans justificatif obligatoire. Exemple : « Hier, j’ai payé 250 DH de fournitures chez Bricoma, 40 DH pour une course InDrive et 20 DH de pourboire. Aujourd’hui, 600 DH pour la main d’œuvre à Ahmed. » L’analyse locale prépare quatre lignes modifiables, reprend les dates et bénéficiaires explicites et propose les catégories. Elle accepte aussi les listes, les dates en français et les quantités explicites. Les totaux récapitulatifs et avances/restitutions identifiés ne sont pas comptés comme dépenses ; les montants manquants, négatifs, ambigus ou étrangers restent à corriger. Le texte est limité à 12 000 caractères et le tableau à 100 lignes. La validation enregistre uniquement les lignes cochées. Ce parcours utilise des règles locales ; aucun modèle génératif n’est connecté. L’activation d’une IA générative nécessite une connexion de service distincte via OpenAI Developers et sa configuration sécurisée côté serveur.

- `node tests/caisse-model.mjs` : centimes, catégories, soldes et propositions de reconnaissance.
- `node tests/ui.cjs` : saisie, sauvegarde, import, doublons, exports PDF et CSV.
- `node tests/backend.cjs` : validation, fusion concurrente et accès aux justificatifs privés.
- `node tests/caisse-ocr.cjs` : lecture OCR réelle d’un ticket synthétique, sans données personnelles ni API externe.
- `node tests/caisse-pdf.mjs` (après le test UI) : lecture réelle d’un ticket PDF synthétique.

## Congés et autres vérifications

Le suivi des congés payés s'applique uniquement à Karima, Wijdane et Samir : début au 1er septembre 2026, 1,5 jour acquis à chaque fin de mois. Au 14 octobre 2026, 1,5 jour est acquis avant déduction des jours pris ; le compteur passe à 3 jours le 31 octobre et à 6 jours le 31 décembre. Les jours sont saisis par demi-journée, conservés séparément des récupérations et reportés d'une année à l'autre. Les dates futures restent dans les congés prévus. Le même calcul est utilisé par l'interface et le serveur. La sauvegarde/import et la fusion concurrente incluent les congés, tout en restant compatibles avec les anciens clients et sauvegardes.

- `node tests/ui.cjs` : calculs, duplication, report de récupération, paiements partiels, export personnel, génération PDF.
- `node tests/backend.cjs` : migrations SQLite, fusion concurrente, contrôle d'accès OTP, limites d'envoi et révocation des sessions. Les appels SMS de ces tests sont simulés ; aucun SMS n'est envoyé.
- `node node_modules/typescript/bin/tsc --noEmit` : types.

## SMS OTP facultatifs

Le parcours SMS est conservé comme alternative. Pour le sélectionner, définir `REQUIRE_PROFILE_PASSWORD=0` et connecter le projet Descope du propriétaire. Aucun envoi n'est activé actuellement. Définir les variables d'environnement Sites :

- `SMS_PROVIDER=descope`
- `DESCOPE_PROJECT_ID` : Project ID du projet Descope personnel, conservé côté serveur.
- `AUTH_PHONES_JSON` : un objet contenant `karima`, `wijdane`, `samir` et `reda` avec des numéros distincts au format international. Le numéro de Reda reste à renseigner avant de lui activer les SMS.
- `REQUIRE_SMS_OTP=1` pour imposer le code SMS.

Un code approuvé par le prestataire ouvre un cookie sécurisé de 24 heures. Seul le profil associé au numéro autorisé peut lire ou écrire ses données. Le compteur de tentatives est conservé en D1 ; l'application bloque après 100 demandes Descope dans le mois et ne déclenche pas de prestataire payant. La livraison effective vers les numéros marocains doit être vérifiée une fois le projet connecté. La politique d'accès Sites reste un contrôle distinct : une connexion SMS ne donne pas à elle seule accès à un Site privé ChatGPT. Twilio Verify reste un adaptateur facultatif si configuré explicitement à la place de Descope.

L'ancien historique Claude se récupère en important une sauvegarde JSON dans Paramètres, depuis le profil correspondant. Le fichier HTML seul ne contient pas cet historique.

Quatre choix de transport : Voiture (kilomètres × barème et péages), Train (montant saisi), InDrive (montant saisi), Sans transport (aucun frais de trajet). L'aller et le retour ont des montants distincts ; chaque trajet sur place peut utiliser un autre mode. Aucune grille de tarifs ferroviaires n'est nécessaire. Les totaux, notes de frais, détails PDF et exports tiennent compte des quatre modes. Sans transport masque les champs du trajet, ignore ses anciens kilomètres et montants, et conserve les repas, l’hébergement et les autres frais.

La saisie d'un nom, de coordonnées GPS ou d'un lien Google Maps lance la reconnaissance automatique. Les liens courts sont résolus côté serveur, avec une liste de domaines Google autorisés. Les adresses utilisent Photon / OpenStreetMap avec cache ; les distances routières utilisent OSRM et un serveur de secours. Ces distances peuvent différer de Google Maps. Les services cartographiques gratuits ne garantissent pas la disponibilité ; la saisie manuelle reste possible. Les péages sont des estimations modifiables issues de la grille du fichier fourni. Pas de recherche automatique de tarifs de train.

La vérification comprend les calculs métier, les contrôles serveur, les types, la compilation et la lecture des PDF générés. La vérification en navigateur n'était pas disponible dans cet environnement.

Le profil Karima possède deux favoris préconfigurés avec coordonnées : Résidence Al Yassamine, Jawhara Casablanca, et Bureau Blue Chili, Villa Brion, 7 Rue Khadija Bent Khouailid, Casablanca 20130. Les coordonnées proviennent des fiches cartographiques Waze correspondant aux adresses. Le domicile reste dans les données serveur du profil Karima, derrière les contrôles d'accès. Une migration conserve ces favoris en D1, sans doublons, et retire les anciennes données APFE. Les nouveaux favoris restent modifiables dans les paramètres.

Le calcul réutilise les positions des favoris et des lieux déjà visités. Un lien Maps avec coordonnées ou une paire GPS ne nécessite plus de géocodage inverse. Le message d'erreur identifie le départ ou la destination à localiser ; la position peut être mémorisée depuis ce message. Un bouton permet de relancer le calcul. Le routage direct depuis le navigateur sert de secours si le serveur de routage ne répond pas depuis l'hébergement.
