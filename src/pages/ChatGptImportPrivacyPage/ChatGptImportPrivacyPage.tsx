export function ChatGptImportPrivacyPage() {
  return (
    <main id="main-content">
      <h1>Confidentialité — import depuis ChatGPT</h1>
      <p>
        Dans ce flux, la photo ou le PDF est traité dans ChatGPT. Le fichier
        original n’est pas envoyé à Quiz TSI.
      </p>
      <p>
        Après ton aperçu et ta confirmation, Quiz TSI reçoit uniquement le
        contenu structuré des questions, leur classification, la couverture
        d’analyse et les incertitudes signalées.
      </p>
      <p>
        Ton compte Quiz TSI est lié à l’action par OAuth. L’import crée
        seulement des brouillons privés, jamais une publication automatique.
      </p>
      <p>
        Tu peux relire, corriger puis archiver ces brouillons depuis la Banque
        de questions. Quiz TSI ne reçoit ni token OAuth, ni conversation ChatGPT
        complète, ni fichier source dans les données de question.
      </p>
    </main>
  );
}
