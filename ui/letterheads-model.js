// Legal text from the supplied Word letterheads; Apollo uses the newly supplied PNG at the left.
const PROFILE_LETTERHEADS = {
  samir: {
    id: 'apollo-v2', nom: 'Apollo Prod', logo: '@apollo',
    footer: ['Apollo Prod S.A.R.L au Capital de 100.000,00 Dirhams',
      'RC: 603819 - IF: 60114680 - TP: 33202633 - ICE: 003379948000071',
      '7, rue Ahmed Touki 2ème étage Appt 10, Casablanca - Maroc'],
    image: { x: 20, y: 12.5, width: 64, height: 64 * 262 / 895,
      crop: { x: 294, y: 391, width: 895, height: 262, fullWidth: 1491, fullHeight: 1055 } },
    footerFont: 'times', footerSize: 12, footerY: 269, footerStep: 4.8,
    dateX: 195, dateAlign: 'right', dateWidth: 105
  },
  wijdane: {
    id: 'brendz-v1', nom: 'Brendz Agency', logo: '@brendz',
    footer: ['Brendz Agency SARL au Capital Social de 100 000,00 Dhs',
      'RC : 670965, IF : 66256933, TP : 34213592, ICE : 003688600000028',
      '5 Rue Ennoussour RDC Casablanca', 'email : contact@brendz.ma'],
    image: { x: 24.99, y: 12.47, width: 33.27, height: 30.69 },
    footerFont: 'helvetica', footerSize: 11, footerY: 269, footerStep: 4.8,
    dateX: 195, dateAlign: 'right'
  }
};
export function letterheadFor(profileId) {
  const value = PROFILE_LETTERHEADS[profileId];
  return value ? { ...value, image: { ...value.image, ...(value.image.crop ? { crop: { ...value.image.crop } } : {}) }, footer: [...value.footer] } : null;
}
export function letterheadSociete(profileId, current) {
  const value = letterheadFor(profileId);
  if (!value) return current;
  return { ...current, nom: value.nom, logo: value.logo, footer: value.footer, letterhead: value.id };
}
