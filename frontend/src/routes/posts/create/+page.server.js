/** @type {import('./$types').PageServerLoad} */
export const ssr = false;

export async function load() {
  return {
    locations: [
      'Neo Tokyo',
      'Estudio VTuber',
      'Valhalla Café',
      'Akihabara Virtual',
      'La Luna',
      'Habitación Gamer',
      'Distrito Cyberpunk',
      'Estación Virtual'
    ]
  };
}
