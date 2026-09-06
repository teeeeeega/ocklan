export type Service = {
  id: string
  name: string
  eyebrow: string
  description: string
  price: string
  cadence: string
  tone: 'cyan' | 'blue' | 'stone'
}

export const services: Service[] = [
  { id: 'online', name: 'Coaching online', eyebrow: 'Il tuo metodo', description: 'Programmazione personalizzata, tecnica e supporto costante per trasformare il tuo allenamento.', price: '89', cadence: '/ mese', tone: 'cyan' },
  { id: 'pt', name: 'Personal training', eyebrow: 'A Perugia', description: 'Sessioni 1:1 per costruire forza, controllo e skill con feedback in tempo reale.', price: '40', cadence: '/ sessione', tone: 'blue' },
  { id: 'call', name: 'Consulenza', eyebrow: 'Il primo passo', description: 'Una sessione mirata per analizzare obiettivi, tecnica e direzione del tuo percorso.', price: '30', cadence: '/ call', tone: 'stone' },
]

export const upcomingAppointments = [
  { day: '12', month: 'SET', title: 'Check-in coaching', time: '18:30 - 19:00', type: 'Video call', status: 'Confermato' },
  { day: '15', month: 'SET', title: 'Personal training', time: '10:00 - 11:00', type: 'Parco Chico Mendez', status: 'Da confermare' },
]

export const demoMetrics = [
  { label: 'Clienti attivi', value: '47', change: '+8 questo mese' },
  { label: 'Appuntamenti oggi', value: '6', change: '2 ancora da iniziare' },
  { label: 'Vendite questo mese', value: '1.240', change: '+18,4% vs agosto' },
  { label: 'Pagamenti pending', value: '3', change: 'Da verificare' },
]
