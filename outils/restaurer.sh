#!/bin/bash
# Restaurer la progression d’un utilisateur à partir de l’historique des versions (30 jours).
#   ./outils/restaurer.sh <id-utilisateur>                 → liste les versions
#   ./outils/restaurer.sh <id-utilisateur> <versionId>     → remet cette version comme version actuelle
# Prérequis : az login sur l’abonnement du projet.
set -euo pipefail
SA=jlptetude6e6657; RG=rg-jlpt-etude; C=jlpt
UID_="${1:?id utilisateur requis}"; BLOB="users/$UID_/progress-${NIVEAU:-N1}.json"
CONN=$(az storage account show-connection-string -n $SA -g $RG -o tsv)
if [ -z "${2:-}" ]; then
  az storage blob list --connection-string "$CONN" -c $C --prefix "$BLOB" --include v \
    --query "[].{version:versionId, actuelle:isCurrentVersion, modifiee:properties.lastModified, taille:properties.contentLength}" -o table
  exit 0
fi
URL=$(az storage blob url --connection-string "$CONN" -c $C -n "$BLOB" -o tsv)
SAS=$(az storage blob generate-sas --connection-string "$CONN" -c $C -n "$BLOB" --permissions r --expiry "$(date -u -v+1H +%FT%TZ 2>/dev/null || date -u -d '+1 hour' +%FT%TZ)" -o tsv)
az storage blob copy start --connection-string "$CONN" -c $C -b "$BLOB" --source-uri "$URL?versionid=$2&$SAS" -o none
echo "Version $2 restaurée pour $UID_ ($BLOB)."
