# Plan d'optimisation pour Tchap

## Constat
- Les messages sont envoyés avec un délai fixe de 1 seconde entre chaque segment, ce qui ralentit fortement les conversations longues.
- Chaque envoi refait plusieurs appels réseau (récupération des salons rejoints, découverte du salon direct), ce qui ajoute de la latence côté Tchap/Matrix.
- Les erreurs liées à des salons invalides ne purgent pas toujours les caches internes, ce qui force des requêtes répétées.

## Actions mises en œuvre
1. **Réduction du throttling** : passage du délai fixe par message à 200 ms tout en conservant la logique d'exponentiel backoff sur `M_LIMIT_EXCEEDED` pour rester compatible avec le rate-limit du serveur.
2. **Caching des salons rejoints** : ajout d'un cache court (60 s) sur la liste des salons rejoints afin d'éviter un appel `getJoinedRooms` par message tout en limitant la staleness.
3. **Caching des salons directs** : mise en place d'un cache de 5 minutes pour la découverte du salon direct (`m.direct`), avec purge proactive lorsque le salon devient invalide ou qu'un blocage est détecté.
4. **Amélioration des parcours d'erreur** : nettoyage des caches lorsqu'un utilisateur bloque le bot ou lorsqu'un salon enregistré n'existe plus, afin d'éviter des recherches coûteuses.

## Prochaines étapes (facultatives)
- Instrumenter les temps d'envoi/réponse côté Tchap pour confirmer le gain et surveiller d'éventuels nouveaux `M_LIMIT_EXCEEDED`.
- Ajuster dynamiquement le délai (200 ms) en fonction des statistiques de rate-limit remontées par le serveur Tchap.
- Enrichir les tests automatisés pour couvrir les cas de cache périmé et de recréation de salons directs.
