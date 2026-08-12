export const AUTOMATION_TAXONOMY_VERSION = 1;

const mapping = (notionId, rule) => ({ notionId, rule });

export function automationNotionMapping(row) {
  const family = row.Famille;
  switch (row.Categorie) {
    case 'DOMAINES':
      return mapping('FON-F01', 'category:DOMAINES');
    case 'DEVELOPPEMENTS_LIMITES':
      return mapping('ANA-F04', 'category:DEVELOPPEMENTS_LIMITES');
    case 'HYPERBOLIQUES':
      if (family.startsWith('Dérivée'))
        return mapping('DER-F01', 'HYPERBOLIQUES:Dérivée');
      if (family.startsWith('Primitive'))
        return mapping('INT-F01', 'HYPERBOLIQUES:Primitive');
      return mapping('FON-F02', 'HYPERBOLIQUES:Définition');
    case 'DERIVEES':
      if (family.startsWith('Règle produit'))
        return mapping('DER-F02', 'DERIVEES:Règle produit');
      if (family.startsWith('Règle quotient'))
        return mapping('DER-F03', 'DERIVEES:Règle quotient');
      if (
        family.startsWith('Règle ') ||
        family.startsWith('Composition affine')
      )
        return mapping('DER-F04', 'DERIVEES:Composition');
      return mapping('DER-F01', 'DERIVEES:Usuelle');
    case 'PRIMITIVES':
      if (
        family.includes("u'/") ||
        family.includes("u'e") ||
        family.includes("u'u") ||
        family.includes('ajustement') ||
        family.includes('affine')
      )
        return mapping('INT-F02', 'PRIMITIVES:Composition');
      return mapping('INT-F01', 'PRIMITIVES:Usuelle');
    case 'TRIGONOMETRIE':
      if (family === "Longueur d'arc")
        return mapping('MES-F01', 'TRIGONOMETRIE:Longueur arc');
      if (
        family.startsWith('Développer une formule') ||
        family.startsWith('Reconnaître une formule')
      )
        return mapping('TRI-F03', 'TRIGONOMETRIE:Addition différence');
      if (family.startsWith('Transformer a cos'))
        return mapping('TRI-F05', 'TRIGONOMETRIE:Sinusoïde');
      return mapping('TRI-F01', 'TRIGONOMETRIE:Valeurs et identités');
    case 'FONCTIONS_REFERENCE':
      if (family.startsWith('Domaine'))
        return mapping('FON-F01', 'FONCTIONS_REFERENCE:Domaine');
      if (family === 'Reconnaître une sinusoïde')
        return mapping('TRI-F05', 'FONCTIONS_REFERENCE:Sinusoïde');
      return mapping('FON-F02', 'FONCTIONS_REFERENCE:Propriété ou image');
    default:
      return null;
  }
}
