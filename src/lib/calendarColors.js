// Cores de evento do Google Agenda. Os ids são fixos do Google — os hex são os
// que ele usa para desenhar, então o quadradinho no Perfil bate com o que a
// pessoa vê na agenda.
//
// A cor identifica QUEM MARCOU o horário: o evento é criado na agenda do
// vendedor (para o horário contar como ocupado de verdade), então sem a cor
// não daria para saber de quem partiu a marcação.
export const GOOGLE_EVENT_COLORS = {
  '1':  { nome: 'Lavanda',    hex: '#7986CB' },
  '2':  { nome: 'Sálvia',     hex: '#33B679' },
  '3':  { nome: 'Uva',        hex: '#8E24AA' },
  '4':  { nome: 'Flamingo',   hex: '#E67C73' },
  '5':  { nome: 'Banana',     hex: '#F6BF26' },
  '6':  { nome: 'Tangerina',  hex: '#F4511E' },
  '7':  { nome: 'Pavão',      hex: '#039BE5' },
  '8':  { nome: 'Grafite',    hex: '#616161' },
  '9':  { nome: 'Mirtilo',    hex: '#3F51B5' },
  '10': { nome: 'Manjericão', hex: '#0B8043' },
  '11': { nome: 'Tomate',     hex: '#D50000' },
}

export const colorInfo = (id) => GOOGLE_EVENT_COLORS[String(id)] || null
